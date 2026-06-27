/**
 * Shared rubric-based evaluation pipeline for all evaluation edge functions.
 */

import {
  createChatCompletion,
  type ChatResponseFormat,
  type ReasoningEffort,
  resolveChatModel,
} from '../shared/openai.ts';
import { getPrompt, getPromptTemplate } from './prompts.ts';
import {
  formatHardSkillPairsForPrompt,
  type HardSkillPair,
} from './hardSkillsFormat.ts';
import {
  normalizeEvaluationPayload,
  normalizeHardSkillsAssessment,
  type EvalScoresRecord,
  type EvalScoreExplanations,
  type EvalQedMeasuresRecord,
  type RawEvaluationPayload,
  type RawHardSkillAssessment,
} from './evaluationValidation.ts';
import {
  EVALUATION_HARD_SKILLS_JSON_SCHEMA,
  EVALUATION_MAIN_JSON_SCHEMA,
} from './evaluationSchemas.ts';
import { resolveEvaluationTypePromptKey } from './evaluationContext.ts';
import { logError } from '../shared/logger.ts';

export interface RunEvaluationParams {
  language: string;
  studentName: string;
  teacherName: string;
  assignmentTitle: string;
  assignmentType: string;
  assignmentInstructions: string;
  moduleActivityContextText?: string;
  studentWorkText: string;
  mode: 'student_work' | 'teacher_review';
  teacherFeedback?: string;
  sessionContext?: string;
  skillPairs: HardSkillPair[];
  hardSkillDomain?: string | null;
  /** Stable seed derived from submission id for repeatable scoring when model supports it. */
  seed?: number;
}

export interface EvaluationTraceCallbacks {
  onMainTrace?: (payload: {
    traceStartMs: number;
    traceEndMs: number;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    usage?: unknown;
    model: string;
  }) => void;
  onHardSkillsTrace?: (payload: {
    traceStartMs: number;
    traceEndMs: number;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    usage?: unknown;
    model: string;
  }) => void;
}

export interface EvaluationResult {
  assignmentChecklist: string[];
  studentFeedback: string;
  teacherFeedback: string;
  scores: EvalScoresRecord;
  scoreExplanations: EvalScoreExplanations;
  qedMeasures: EvalQedMeasuresRecord;
  evidence: Partial<Record<string, string[]>>;
  hardSkillsAssessment: ReturnType<typeof normalizeHardSkillsAssessment>;
}

function languageLabel(language: string): string {
  return language === 'he' ? 'Hebrew' : 'English';
}

/** Wrap a value in an XML-style tag for the model to anchor on. */
function tag(name: string, value: string): string {
  const v = value.trim();
  if (!v) return `<${name}/>`;
  return `<${name}>\n${v}\n</${name}>`;
}

function buildAssignmentMetadataBlock(params: RunEvaluationParams): string {
  const metadataBody = [
    `Student: ${params.studentName}`,
    `Teacher: ${params.teacherName}`,
    `Assignment: ${params.assignmentTitle}`,
    `Assignment type: ${params.assignmentType || 'questions'}`,
  ].join('\n');

  const sections = [
    tag('assignment_metadata', metadataBody),
    tag('instructions', params.assignmentInstructions || '(none provided)'),
  ];

  const moduleText = params.moduleActivityContextText?.trim();
  if (moduleText) {
    sections.push(tag('module_context', moduleText));
  }

  return sections.join('\n\n');
}

async function composeMainSystemPrompt(params: RunEvaluationParams): Promise<string> {
  const lang = params.language;
  const typeKey = resolveEvaluationTypePromptKey(params.assignmentType, params.mode);

  const [core, typeBlock] = await Promise.all([
    getPrompt(
      'eval_core',
      {
        languageLabel: languageLabel(lang),
      },
      lang,
    ),
    getPromptTemplate(typeKey, lang),
  ]);

  return `${core}\n\n${typeBlock}\n\n${buildAssignmentMetadataBlock(params)}`;
}

async function composeHardSkillsSystemPrompt(
  params: RunEvaluationParams,
): Promise<string> {
  const skillsAssessText = formatHardSkillPairsForPrompt(
    params.skillPairs,
    params.hardSkillDomain,
  );
  return getPrompt(
    'eval_hard_skills',
    {
      hardSkillDomain: params.hardSkillDomain || 'N/A',
      skillsAssessText: skillsAssessText || '(none specified)',
      languageLabel: languageLabel(params.language),
    },
    params.language,
  );
}

function buildMainUserMessage(params: RunEvaluationParams): string {
  if (params.mode === 'teacher_review') {
    const parts = [
      'Evaluate using the teacher feedback below.',
      tag('teacher_feedback', params.teacherFeedback || ''),
    ];
    const sessionText = params.sessionContext?.trim().slice(0, 8000);
    if (sessionText) {
      parts.push(tag('session_context', sessionText));
    }
    return parts.join('\n\n');
  }
  return `Evaluate the student work below.\n\n${tag('student_work', params.studentWorkText)}`;
}

function buildHardSkillsUserMessage(params: RunEvaluationParams): string {
  if (params.mode === 'teacher_review') {
    return `Assess hard skills using the teacher feedback below.\n\n${tag('teacher_feedback', params.teacherFeedback || '')}`;
  }
  return `Assess hard skills in the student work below.\n\n${tag('student_work', params.studentWorkText)}`;
}

const MAIN_JSON_SCHEMA_FORMAT: ChatResponseFormat = {
  type: 'json_schema',
  name: EVALUATION_MAIN_JSON_SCHEMA.name,
  strict: EVALUATION_MAIN_JSON_SCHEMA.strict,
  schema: EVALUATION_MAIN_JSON_SCHEMA.schema as Record<string, unknown>,
};

const HARD_SKILLS_JSON_SCHEMA_FORMAT: ChatResponseFormat = {
  type: 'json_schema',
  name: EVALUATION_HARD_SKILLS_JSON_SCHEMA.name,
  strict: EVALUATION_HARD_SKILLS_JSON_SCHEMA.strict,
  schema: EVALUATION_HARD_SKILLS_JSON_SCHEMA.schema as Record<string, unknown>,
};

async function callWithJsonRetry(
  systemPrompt: string,
  userMessage: string,
  responseFormat: ChatResponseFormat,
  modelTier: 'fast' | 'smart',
  maxTokens: number,
  seed?: number,
  reasoningEffort?: ReasoningEffort,
): Promise<{ content: string; usage?: unknown }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await createChatCompletion(
        systemPrompt,
        userMessage ? [{ role: 'user', content: userMessage }] : [],
        0.4,
        maxTokens,
        modelTier,
        false,
        responseFormat,
        seed,
        reasoningEffort,
      ) as { content: string; usage?: unknown };
      JSON.parse(result.content);
      return result;
    } catch (e) {
      lastError = e;
      logError(`Evaluation JSON parse attempt ${attempt + 1} failed`, e);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to parse evaluation JSON');
}

function sourceTextForValidation(params: RunEvaluationParams): string {
  if (params.mode === 'teacher_review') {
    return `${params.teacherFeedback || ''}\n${params.sessionContext || ''}`;
  }
  return params.studentWorkText;
}

export async function runEvaluation(
  params: RunEvaluationParams,
  callbacks: EvaluationTraceCallbacks = {},
): Promise<EvaluationResult> {
  const mainSystemPromptPromise = composeMainSystemPrompt(params);
  const hardSkillsSystemPromptPromise =
    params.skillPairs.length > 0 ? composeHardSkillsSystemPrompt(params) : Promise.resolve('');

  const [mainSystemPrompt, hsSystemPrompt] = await Promise.all([
    mainSystemPromptPromise,
    hardSkillsSystemPromptPromise,
  ]);

  const mainUserMessage = buildMainUserMessage(params);
  const validationSource = sourceTextForValidation(params);

  const mainTraceStart = Date.now();
  const mainPromise = callWithJsonRetry(
    mainSystemPrompt,
    mainUserMessage,
    MAIN_JSON_SCHEMA_FORMAT,
    'smart',
    3000,
    params.seed,
    'low',
  );

  const hsPromise =
    params.skillPairs.length > 0
      ? (async () => {
          const hsUserMessage = buildHardSkillsUserMessage(params);
          const hsTraceStart = Date.now();
          const hsResult = await callWithJsonRetry(
            hsSystemPrompt,
            hsUserMessage,
            HARD_SKILLS_JSON_SCHEMA_FORMAT,
            'fast',
            1200,
            params.seed,
          );
          const hsTraceEnd = Date.now();

          callbacks.onHardSkillsTrace?.({
            traceStartMs: hsTraceStart,
            traceEndMs: hsTraceEnd,
            input: {
              language: params.language,
              skill_pair_count: params.skillPairs.length,
            },
            output: { raw_json: hsResult.content },
            usage: hsResult.usage,
            model: resolveChatModel('fast'),
          });

          const rawHs = JSON.parse(hsResult.content) as {
            hardSkillsAssessment?: RawHardSkillAssessment[];
          };
          return normalizeHardSkillsAssessment(rawHs.hardSkillsAssessment);
        })()
      : Promise.resolve([] as ReturnType<typeof normalizeHardSkillsAssessment>);

  const [mainResult, hardSkillsAssessment] = await Promise.all([mainPromise, hsPromise]);
  const mainTraceEnd = Date.now();

  callbacks.onMainTrace?.({
    traceStartMs: mainTraceStart,
    traceEndMs: mainTraceEnd,
    input: {
      mode: params.mode,
      language: params.language,
      assignment_type: params.assignmentType,
      work_chars: params.studentWorkText.length,
    },
    output: { raw_json: mainResult.content },
    usage: mainResult.usage,
    model: resolveChatModel('smart'),
  });

  const rawMain = JSON.parse(mainResult.content) as RawEvaluationPayload;
  const normalized = normalizeEvaluationPayload(rawMain, validationSource, {
    isTeacherReview: params.mode === 'teacher_review',
  });

  let studentFeedback = normalized.studentFeedback;
  let teacherFeedback = normalized.teacherFeedback;

  if (params.mode === 'teacher_review' && params.teacherFeedback?.trim()) {
    teacherFeedback = params.teacherFeedback.trim();
  }

  return {
    assignmentChecklist: normalized.assignmentChecklist,
    studentFeedback,
    teacherFeedback,
    scores: normalized.scores,
    scoreExplanations: normalized.scoreExplanations,
    qedMeasures: normalized.qedMeasures,
    evidence: normalized.evidence,
    hardSkillsAssessment,
  };
}

/** Derive a stable numeric seed from a submission id for repeatable scoring. */
export function seedFromSubmissionId(submissionId: string): number {
  let hash = 0;
  for (let i = 0; i < submissionId.length; i++) {
    hash = (hash * 31 + submissionId.charCodeAt(i)) >>> 0;
  }
  return hash % 2_147_483_647;
}
