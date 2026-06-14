import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  buildChatCompletionsPayload,
  buildResponsesApiPayload,
  createChatCompletionFromPayload,
  createResponseFromPayload,
  getOpenAIConfig,
  handleOpenAIError,
  InvalidPreviousResponseIdError,
} from '../shared/openai.ts';
import {
  getTeacherNameByAssignment,
  getOrCreateConversation,
  saveConversation,
  getTeacherProfile,
  getStudentProfile,
  getAssignmentDetails,
  getAssignmentModuleActivityContextText,
  getClassroomResources,
  getTeacherIdFromAssignment,
  getValidatedPriorAssignmentChatExcerpt,
  getPriorSubmissionIdsInSameSection,
  getPriorSubmissionIdsForCourseRecall,
  isAppAdmin,
} from '../shared/supabase.ts';
import type { Message } from '../shared/types.ts';
import { generateEnhancedChatSystemPrompt } from '../_shared/prompts.ts';
import {
  explainTaskAppend,
  postExplainTutorAppend,
  companionExplainTaskAppend,
  companionPostExplainAppend,
} from '../_shared/composeSystemPrompt.ts';
import { mergeStreamingTextChunk, normalizeAssistantDashes } from './typography.ts';
import {
  createInitialWelcomeStreamStripper,
  stripRedundantInitialWelcome,
} from './stripRedundantInitialWelcome.ts';
import {
  persistEdgeFunctionLog,
  errorToMessage,
  errorToStack,
} from '../shared/persistEdgeFunctionLog.ts';
import { authorizePerleapChat } from './authorize.ts';
import {
  parseAssignmentTasks,
  resolveAssignmentTutorText,
  wrapTrustedAssignmentInstructionsBlock,
} from './assignmentText.ts';
import {
  PRIOR_MERGE_GREETING_BUDGET_FRACTION,
  PRIOR_MERGE_PER_SUBMISSION_CEILING_CHARS,
  PRIOR_EXPLICIT_RECALL_PER_SUBMISSION_CEILING_CHARS,
  PRIOR_COURSE_RECALL_MERGE_MAX_CHARS,
  PRIOR_MERGE_SEP,
  PRIOR_MERGE_TOTAL_MAX,
  MAX_UNIT_PRIOR_SUBMISSION_IDS_CHAT,
  PRIOR_VERBATIM_COUNT_CHAT,
  PRIOR_MIN_CHUNK_BODY_CHARS,
  dedupeAssistantLinesAcrossPriors,
  stripPerleapGreetingPrefixesFromExcerpt,
  isCourseRecallRequest,
} from '../shared/perleapPriorContext.ts';
import { COURSE_RECALL_MAX_PRIOR_SUBMISSIONS } from '../shared/courseRecall.ts';
import {
  extractKeywordSet,
  hasKeywordOverlap,
  overlappingKeywords,
} from '../_shared/topicOverlap.ts';
import { getCourseMemoryForPrompt, getUnitMemoryForPrompt } from '../shared/unitMemory.ts';
import { createMarkerSink } from './markerSink.ts';
import { createProgressSink, extractProgressFromFullText } from './progressSink.ts';
import { consumeChatCompletionsStream, consumeResponsesApiStream } from './streamOpenAI.ts';
import { queueOpikTrace, uuidv7 } from '../shared/opikTrace.ts';

const CHAT_TEMPERATURE = 0.2;
const CHAT_MAX_TOKENS_DEFAULT = 500;
const CHAT_MAX_TOKENS_GREETING = 800;
/** Course-recall turns quote full prior prompts from <prior_context>. */
const CHAT_MAX_TOKENS_COURSE_RECALL = 2_800;
/** Suppress hallucinated next-turn role tags. Chat Completions only; Responses API also accepts `stop`. */
const CHAT_STOP_SEQUENCES = ['\n\nStudent:', '\n\nUser:'];
const COMPLETION_MARKER = '[CONVERSATION_COMPLETE]';

/** When true, use OpenAI Responses API (developer role + previous_response_id chaining). */
function isResponsesApiEnabled(): boolean {
  return Deno.env.get('PERLEAP_CHAT_USE_RESPONSES_API') === 'true';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers':
    'X-Perleap-Prior-N, X-Perleap-Prior-Parts, X-Perleap-Prior-Parts-Pre, X-Perleap-Prior-Verbatim, X-Perleap-Prior-Summary, X-Perleap-Prior-Section-Len, X-Perleap-Prior-Section-Db, X-Perleap-Prior-Client, X-Perleap-Unit-Memory-Facts, X-Perleap-Course-Memory-Facts',
};

/** Budget for merged prior excerpts (characters), after accounting for separators between submissions. */
function computePerPriorMergeCap(
  submissionCount: number,
  mergedPriorMaxChars: number,
  separator: string,
  ceilingPerSubmission: number,
): number {
  if (submissionCount <= 0 || mergedPriorMaxChars <= 0) return 0;
  const separatorCharsTotal = Math.max(0, submissionCount - 1) * separator.length;
  const available = Math.max(0, mergedPriorMaxChars - separatorCharsTotal);
  const fairShare = Math.floor(available / submissionCount);
  return Math.min(ceilingPerSubmission, fairShare);
}

/**
 * After dedupe + slicing, some prior chunks reduce to nothing but the JSON-artifact
 * placeholder and section headers. Wrapping those in `<prior_submission>` tags wastes
 * tokens and tempts the model to imitate boilerplate. Returns false for chunks whose
 * visible content (after stripping the placeholder and standard headers) is < 30 chars.
 */
function isMeaningfulPriorChunk(chunk: string): boolean {
  if (!chunk) return false;
  const stripped = chunk
    .replace(/\[Prior written work:[^\]]+\]/gi, '')
    .replace(/^Submitted written work\s*(?:\(prior assignment\))?:\s*$/gim, '')
    .replace(/^Prior assignment test responses:\s*$/gim, '')
    .replace(/^---\s*$/gim, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return stripped.length >= 30;
}

/** Synthetic user turn for initial streaming (real policy lives in system prompt). Locale-aware. */
const SESSION_START_USER_CUE_EN = 'Greet me briefly and ask about the first task.';
const SESSION_START_USER_CUE_HE = 'ברך אותי בקצרה ושאל על המשימה הראשונה.';

const TASK_EXPLAIN_USER_CUE_EN =
  "I don't understand the assignment yet. Please explain what I need to do.";
const TASK_EXPLAIN_USER_CUE_HE =
  'עדיין לא הבנתי את המטלה. בבקשה הסבירו מה נדרש ממני.';

type InitialGreetingMode = 'default' | 'explain_task';

function sessionStartUserCueForLanguage(
  language: string | undefined,
  mode: InitialGreetingMode = 'default',
): string {
  const isHe = (language ?? 'en').toLowerCase() === 'he';
  if (mode === 'explain_task') {
    return isHe ? TASK_EXPLAIN_USER_CUE_HE : TASK_EXPLAIN_USER_CUE_EN;
  }
  return isHe ? SESSION_START_USER_CUE_HE : SESSION_START_USER_CUE_EN;
}

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** CRLF normalization + tame runaway blank lines before sending system prompt to OpenAI */
function normalizeSystemPromptWhitespace(system: string): string {
  let s = system.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trimEnd();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' });
  }

  const submissionIdRaw = typeof body.submissionId === 'string' ? body.submissionId.trim() : '';
  const assignmentIdFromClient = typeof body.assignmentId === 'string' ? body.assignmentId.trim() : '';

  let authResult;
  try {
    authResult = await authorizePerleapChat(req, submissionIdRaw, assignmentIdFromClient);
  } catch (err) {
    const message = handleOpenAIError(err);
    await persistEdgeFunctionLog(
      {
        functionName: 'perleap-chat',
        level: 'error',
        httpStatus: 500,
        message,
        stack: errorToStack(err),
        context: { phase: 'authorize' },
      },
      req,
    );
    return jsonResponse(500, { error: message });
  }

  if ('status' in authResult) {
    return new Response(authResult.body, {
      status: authResult.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { learnerUserId, assignmentId } = authResult;
  const viewerUserId = authResult.user.id;

  try {
    const {
      message,
      isInitialGreeting,
      language = 'en',
      fileContext,
    } = body as {
      message?: string;
      isInitialGreeting?: boolean;
      initialGreetingMode?: InitialGreetingMode;
      language?: string;
      fileContext?: { name: string; content: string };
    };

    const initialGreetingMode: InitialGreetingMode =
      (body as { initialGreetingMode?: InitialGreetingMode }).initialGreetingMode === 'explain_task'
        ? 'explain_task'
        : 'default';

    const isExplainTaskGreeting =
      Boolean(isInitialGreeting) && initialGreetingMode === 'explain_task';

    const postExplainTutoring =
      body.postExplainTutoring === true || body.postExplainTutoring === 'true';

    const companionMode = body.companionMode === true || body.companionMode === 'true';

    const debugChatRequested = body.debugChat === true || body.debugChat === 'true';
    const allowAdminDebug = Boolean(
      debugChatRequested && viewerUserId && (await isAppAdmin(viewerUserId)),
    );

    const orderedPriorIds: string[] = [];
    if (Array.isArray(body.priorSubmissionIds)) {
      for (const x of body.priorSubmissionIds) {
        if (typeof x === 'string' && x.trim()) orderedPriorIds.push(x.trim());
      }
    }
    const legacyPrior =
      typeof body.priorSubmissionId === 'string' ? body.priorSubmissionId.trim() : '';
    if (legacyPrior && !orderedPriorIds.includes(legacyPrior)) {
      orderedPriorIds.push(legacyPrior);
    }
    const priorSeen = new Set<string>();
    const dedupedPriorIds = orderedPriorIds.filter((id) => {
      if (priorSeen.has(id)) return false;
      priorSeen.add(id);
      return true;
    });

    const stream = body.stream === true || body.stream === 'true';
    const effectiveStream = stream && !allowAdminDebug;

    // Fetch all context data in parallel for performance
    const [
      teacherName,
      conversation,
      teacherId,
      assignmentDetails,
      moduleActivityContextText,
      sectionPriorIds,
    ] = await Promise.all([
      getTeacherNameByAssignment(assignmentId),
      getOrCreateConversation(submissionIdRaw),
      getTeacherIdFromAssignment(assignmentId),
      getAssignmentDetails(assignmentId),
      getAssignmentModuleActivityContextText(assignmentId),
      getPriorSubmissionIdsInSameSection(learnerUserId, assignmentId),
    ]);

    const mergeSeen = new Set<string>();
    const mergedPriorIds: string[] = [];
    for (const id of sectionPriorIds) {
      if (mergeSeen.has(id)) continue;
      mergeSeen.add(id);
      mergedPriorIds.push(id);
    }
    for (const id of dedupedPriorIds) {
      if (mergeSeen.has(id)) continue;
      mergeSeen.add(id);
      mergedPriorIds.push(id);
    }
    let cappedPriorIds = mergedPriorIds.length > MAX_UNIT_PRIOR_SUBMISSION_IDS_CHAT
      ? mergedPriorIds.slice(-MAX_UNIT_PRIOR_SUBMISSION_IDS_CHAT)
      : mergedPriorIds;

    const priorMetaHeaders: Record<string, string> = {
      'X-Perleap-Prior-N': String(cappedPriorIds.length),
      'X-Perleap-Prior-Section-Db': String(sectionPriorIds.length),
      'X-Perleap-Prior-Client': String(dedupedPriorIds.length),
      'X-Perleap-Prior-Parts': '0',
      'X-Perleap-Prior-Section-Len': '0',
      'X-Perleap-Unit-Memory-Facts': '0',
      'X-Perleap-Course-Memory-Facts': '0',
    };

    // Fetch teacher profile, student profile, and classroom resources in parallel
    const [
      teacherProfile,
      studentProfile,
      classroomResources,
    ] = await Promise.all([
      teacherId ? getTeacherProfile(teacherId) : Promise.resolve(null),
      getStudentProfile(learnerUserId),
      assignmentDetails?.classroom_id ? getClassroomResources(assignmentDetails.classroom_id) : Promise.resolve(null),
    ]);

    const messages: Message[] = conversation.messages;

    let userMessageContent = typeof message === 'string' ? message : '';
    if (isInitialGreeting) {
      userMessageContent =
        userMessageContent.trim() ||
        sessionStartUserCueForLanguage(language, initialGreetingMode);
    }
    if (fileContext?.content) {
      userMessageContent += `\n\n--- Attached File: ${fileContext.name} ---\n${fileContext.content}`;
    }

    if (!isInitialGreeting) {
      messages.push({ role: 'user', content: userMessageContent });
    }

    const courseRecall = isCourseRecallRequest(userMessageContent);
    if (courseRecall) {
      cappedPriorIds = await getPriorSubmissionIdsForCourseRecall(
        learnerUserId,
        assignmentId,
        userMessageContent,
        COURSE_RECALL_MAX_PRIOR_SUBMISSIONS,
      );
      priorMetaHeaders['X-Perleap-Prior-N'] = String(cappedPriorIds.length);
    }

    // Resolve the canonical assignment tutor text once - used both for the <assignment>
    // block downstream and as the relevance reference for prior-context + course-materials gating.
    const assignmentTutorTextRaw = resolveAssignmentTutorText(assignmentDetails);
    const assignmentKeywords = extractKeywordSet(assignmentTutorTextRaw);

    const [unitMemoryResult, courseMemoryResult] = await Promise.all([
      getUnitMemoryForPrompt(
        learnerUserId,
        assignmentId,
        assignmentTutorTextRaw,
        submissionIdRaw,
      ),
      getCourseMemoryForPrompt(
        learnerUserId,
        assignmentId,
        assignmentTutorTextRaw,
        submissionIdRaw,
        courseRecall ? userMessageContent : undefined,
        courseRecall,
      ),
    ]);
    priorMetaHeaders['X-Perleap-Unit-Memory-Facts'] = String(unitMemoryResult.factCount);
    priorMetaHeaders['X-Perleap-Course-Memory-Facts'] = String(courseMemoryResult.factCount);

    let priorContextExcerpt = '';
    if (cappedPriorIds.length > 0) {
      const separator = PRIOR_MERGE_SEP;
      const mergedPriorMax = courseRecall
        ? PRIOR_COURSE_RECALL_MERGE_MAX_CHARS
        : Math.floor(
          PRIOR_MERGE_TOTAL_MAX *
            (isInitialGreeting ? PRIOR_MERGE_GREETING_BUDGET_FRACTION : 1),
        );
      const perSubmissionCeiling = courseRecall
        ? PRIOR_EXPLICIT_RECALL_PER_SUBMISSION_CEILING_CHARS
        : PRIOR_MERGE_PER_SUBMISSION_CEILING_CHARS;
      const perPriorCap = computePerPriorMergeCap(
        cappedPriorIds.length,
        mergedPriorMax,
        separator,
        perSubmissionCeiling,
      );
      const priorExcerptOpts = courseRecall
        ? {
          includeShortWrittenWork: true,
          preferWrittenWorkFirst: true,
          relaxedChat: true,
          expandedBudget: true,
        }
        : undefined;
      const excerpts = await Promise.all(
        cappedPriorIds.map((pid) =>
          getValidatedPriorAssignmentChatExcerpt(
            pid,
            learnerUserId,
            assignmentId,
            priorExcerptOpts,
          ),
        ),
      );
      const parts: string[] = [];
      for (const excerpt of excerpts) {
        if (excerpt?.trim() && perPriorCap > 0) {
          parts.push(
            stripPerleapGreetingPrefixesFromExcerpt(excerpt.trim()).slice(0, perPriorCap),
          );
        }
      }
      priorMetaHeaders['X-Perleap-Prior-Parts-Pre'] = String(parts.length);
      if (parts.length > 0) {
        let cleaned = courseRecall
          ? parts.filter((c) => c.trim().length > 0)
          : dedupeAssistantLinesAcrossPriors(parts)
            .filter((c) => c.trim().length > 0)
            .filter(isMeaningfulPriorChunk);

        // B.3/B.4: on course-recall turns, keep all loaded priors (already ranked by the student's question).
        if (!courseRecall) {
          if (assignmentKeywords.size > 0) {
            cleaned = cleaned.filter((c) => hasKeywordOverlap(c, assignmentTutorTextRaw));
          }
          cleaned = cleaned.filter((c) => c.trim().length >= PRIOR_MIN_CHUNK_BODY_CHARS);
        } else {
          cleaned = cleaned.filter((c) => {
            if (c.includes('Submitted written work')) return true;
            if (c.includes('Prior assignment test responses')) return true;
            return c.trim().length >= PRIOR_MIN_CHUNK_BODY_CHARS;
          });
        }

        // B.6: newest-first ordering. `parts` arrives in chronological order so the last item is newest.
        cleaned = [...cleaned].reverse();

        // B.5: verbatim for the most recent N; summary-compress everything older.
        const wrapped: string[] = [];
        let verbatimCount = 0;
        let summaryCount = 0;
        const verbatimLimit = courseRecall
          ? cleaned.length
          : PRIOR_VERBATIM_COUNT_CHAT;
        for (let i = 0; i < cleaned.length; i++) {
          const chunk = cleaned[i];
          const n = i + 1;
          if (i < verbatimLimit) {
            wrapped.push(`<prior_submission n="${n}">\n${chunk.trim()}\n</prior_submission>`);
            verbatimCount++;
          } else {
            const topics = overlappingKeywords(chunk, assignmentKeywords, 3);
            const summary = topics.length > 0 ? topics.join('; ') : 'related earlier work';
            const escaped = summary.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
            wrapped.push(`<prior_submission n="${n}" summary="${escaped}"/>`);
            summaryCount++;
          }
        }

        priorMetaHeaders['X-Perleap-Prior-Parts'] = String(wrapped.length);
        priorMetaHeaders['X-Perleap-Prior-Verbatim'] = String(verbatimCount);
        priorMetaHeaders['X-Perleap-Prior-Summary'] = String(summaryCount);

        let combined = wrapped.join('\n\n');
        if (combined.length > mergedPriorMax) {
          combined = courseRecall
            ? combined.slice(0, mergedPriorMax)
            : combined.slice(0, mergedPriorMax);
        }
        priorContextExcerpt = combined;
      } else {
        priorMetaHeaders['X-Perleap-Prior-Parts'] = '0';
      }
      priorMetaHeaders['X-Perleap-Prior-Section-Len'] = String(priorContextExcerpt.length);
    }

    const authoritativeAssignmentForPrompt = wrapTrustedAssignmentInstructionsBlock(
      assignmentTutorTextRaw,
    );

    // Server-tracked task progress: union of previously-completed indexes (persisted) with any
    // new indexes emitted by the model in this turn (sink fills `newProgressIndexes` below).
    const parsedTasks = parseAssignmentTasks(authoritativeAssignmentForPrompt);
    const completedTaskIndexes = conversation.completedTaskIndexes ?? [];

    const taskProgressForPrompt =
      parsedTasks.length === 0
        ? undefined
        : parsedTasks.map((text, i) => ({
            index: i + 1,
            text,
            done: completedTaskIndexes.includes(i + 1),
          }));

    let systemPrompt = await generateEnhancedChatSystemPrompt(
      authoritativeAssignmentForPrompt,
      teacherName,
      teacherProfile,
      studentProfile,
      assignmentDetails,
      classroomResources,
      Boolean(isInitialGreeting),
      language,
      moduleActivityContextText || undefined,
      priorContextExcerpt || undefined,
      taskProgressForPrompt,
      assignmentTutorTextRaw || undefined,
      unitMemoryResult.body || undefined,
      courseMemoryResult.body || undefined,
    );

    if (isExplainTaskGreeting) {
      systemPrompt += '\n\n' + (
        companionMode
          ? companionExplainTaskAppend(language)
          : (await explainTaskAppend(language))
      ).trim();
    }

    const hasPriorAssistantTurn = messages.some((m) => m.role === 'assistant');
    const applyPostExplainTutor =
      postExplainTutoring &&
      !isExplainTaskGreeting &&
      (hasPriorAssistantTurn || !isInitialGreeting);
    if (applyPostExplainTutor) {
      systemPrompt += '\n\n' + (
        companionMode
          ? companionPostExplainAppend(language)
          : (await postExplainTutorAppend(language))
      ).trim();
    }

    if (courseRecall) {
      systemPrompt += language === 'he'
        ? `

COURSE_RECALL_QUOTE (גובר על TUTOR_TURN_PROTOCOL לתור זה)
- משפט מבוא קצר אחד בלבד, ואז הציטוט המלא בטקסט רגיל (אותו סגנון כמו שאר הצ'אט).
- אל תשתמש בבלוקי קוד (\`\`\`) — אין רקע כחול ואין גופן מונוספייס.
- העתק את הפרומפט/ההגשה המלאים מ-<prior_context>; אל תקצר. אפשר שורות ריקות בין פסקאות, אבל הכל ברצף אחד.
- אחרי הציטוט מותר משפט אחד קצר על המשימה הבאה שטרם הושלמה.`
        : `

COURSE_RECALL_QUOTE (overrides TUTOR_TURN_PROTOCOL for this turn)
- One short intro sentence, then the FULL quote as normal chat prose (same style as your other messages).
- Do NOT use markdown code fences (\`\`\`) — no blue background, no monospace font.
- Copy the complete prompt/submission from <prior_context>; do not truncate. Use blank lines between paragraphs but keep it as one continuous reply.
- After the quote you may add one short sentence about the next incomplete task.`;
    }
    systemPrompt = normalizeSystemPromptWhitespace(systemPrompt);

    /**
     * Union previously-persisted indexes with newly-emitted ones, clamped to the valid range
     * `1..parsedTasks.length`. Out-of-range and non-positive indexes are silently dropped.
     */
    const mergeCompletedIndexes = (newIndexes: number[]): number[] => {
      const max = parsedTasks.length;
      if (max === 0) return completedTaskIndexes;
      const set = new Set<number>(completedTaskIndexes.filter((n) => n >= 1 && n <= max));
      for (const n of newIndexes) {
        if (Number.isFinite(n) && n >= 1 && n <= max) set.add(n);
      }
      return [...set].sort((a, b) => a - b);
    };

    const openAIMessages: Message[] = isInitialGreeting
      ? [{ role: 'user', content: userMessageContent }]
      : [...messages];

    // Transform user messages: extract image URLs and convert to OpenAI Vision format
    const formattedOpenAIMessages = openAIMessages.map((msg) => {
      if (msg.role !== 'user' || typeof msg.content !== 'string') return msg;

      const imageRegex = /\[File:\s*([^\]]+)\]\s*URL:\s*(https?:\/\/[^\s]+)/g;
      let match: RegExpExecArray | null;
      const imageUrls: string[] = [];

      while ((match = imageRegex.exec(msg.content)) !== null) {
        if (match[1].match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
          imageUrls.push(match[2]);
        }
      }

      if (imageUrls.length > 0) {
        const contentParts: Array<
          | { type: 'text'; text: string }
          | { type: 'image_url'; image_url: { url: string; detail: string } }
        > = [{ type: 'text', text: msg.content }];
        for (const url of imageUrls) {
          contentParts.push({ type: 'image_url', image_url: { url, detail: 'high' } });
        }
        return { role: msg.role, content: contentParts };
      }

      return msg;
    });

    const greetingPrefix =
      isInitialGreeting
        ? language === 'he'
          ? `שלום! אני Perleap, עוזר ההוראה של ${teacherName}.\n\n`
          : `Hello! I am Perleap, ${teacherName}'s AI teaching assistant.\n\n`
        : '';

    const maxTokens = isInitialGreeting
      ? CHAT_MAX_TOKENS_GREETING
      : courseRecall
        ? CHAT_MAX_TOKENS_COURSE_RECALL
        : CHAT_MAX_TOKENS_DEFAULT;
    const useResponses = isResponsesApiEnabled();

    /**
     * Build a Responses-API payload. With chaining enabled, OpenAI already has the prior turns
     * (via `previous_response_id`), so we send only the newest user message as `input` — that's
     * what realizes the cost/latency win. When chaining is off (first turn, or after a stale-ID
     * fallback), we replay the full formatted history.
     */
    const buildResponsesPayloadFor = (opts: { withChaining: boolean }) => {
      const lastMsg = formattedOpenAIMessages[formattedOpenAIMessages.length - 1];
      return buildResponsesApiPayload({
        developerInstructions: systemPrompt,
        input: opts.withChaining && lastMsg ? [lastMsg] : formattedOpenAIMessages,
        previousResponseId: opts.withChaining ? conversation.lastResponseId : null,
        stream: effectiveStream,
        modelTier: 'smart',
        temperature: CHAT_TEMPERATURE,
        maxOutputTokens: maxTokens,
        stop: CHAT_STOP_SEQUENCES,
      });
    };

    /**
     * Issue the Responses-API call with `previous_response_id` chaining when we have a stored
     * id; on the specific "stale/invalid previous_response_id" failure, transparently retry once
     * with chaining disabled (replays full history). Returns the result, the actually-sent
     * payload (post-fallback), and a `chainingFellBack` flag for admin debug visibility.
     */
    type ResponseCallResult = {
      result: { content: string; responseId?: string; usage?: unknown } | Response;
      payload: Record<string, unknown>;
      chainingFellBack: boolean;
    };
    const callResponsesWithFallback = async (): Promise<ResponseCallResult> => {
      const canChain = !isInitialGreeting && !!conversation.lastResponseId;
      let payload = buildResponsesPayloadFor({ withChaining: canChain });
      try {
        const result = await createResponseFromPayload(payload);
        return { result, payload, chainingFellBack: false };
      } catch (err) {
        if (err instanceof InvalidPreviousResponseIdError && canChain) {
          payload = buildResponsesPayloadFor({ withChaining: false });
          const result = await createResponseFromPayload(payload);
          return { result, payload, chainingFellBack: true };
        }
        throw err;
      }
    };

    // Build the OpenAI request payload exactly once - reuse it for both the admin snapshot
    // and the actual HTTP call to avoid building twice. For Responses API the payload may be
    // rebuilt inside `callResponsesWithFallback` on stale-id retry; we capture the actually-sent
    // payload from the call result so the admin snapshot reflects what OpenAI received.
    let requestPayload = useResponses
      ? buildResponsesPayloadFor({
          withChaining: !isInitialGreeting && !!conversation.lastResponseId,
        })
      : buildChatCompletionsPayload(
          systemPrompt,
          formattedOpenAIMessages,
          CHAT_TEMPERATURE,
          maxTokens,
          'smart',
          effectiveStream,
          'text',
          CHAT_STOP_SEQUENCES,
        );
    let chainingFellBack = false;

    if (!effectiveStream) {
      const opikClientTraceId = uuidv7();
      const traceStartMs = Date.now();
      let result: { content: string; responseId?: string; usage?: unknown };
      if (useResponses) {
        const r = await callResponsesWithFallback();
        result = r.result as { content: string; responseId?: string; usage?: unknown };
        requestPayload = r.payload;
        chainingFellBack = r.chainingFellBack;
      } else {
        result = (await createChatCompletionFromPayload(requestPayload)) as {
          content: string;
          usage?: unknown;
        };
      }

      const aiMessageRaw = result.content;
      const responseIdToPersist = useResponses ? (result as { responseId?: string }).responseId ?? null : null;

      const { cleaned: aiMessageRawNoProgress, indexes: newProgressIndexes } =
        extractProgressFromFullText(aiMessageRaw);

      let aiMessage = normalizeAssistantDashes(aiMessageRawNoProgress);

      if (isInitialGreeting) {
        aiMessage = stripRedundantInitialWelcome(aiMessage, language);
      }

      let shouldEnd = false;
      let endReason = '';
      let cleanedMessage = greetingPrefix + aiMessage;

      const markerIndex = aiMessage.toUpperCase().indexOf(COMPLETION_MARKER);
      if (markerIndex !== -1) {
        shouldEnd = true;
        endReason = 'ai_detected';
        cleanedMessage =
          aiMessage.substring(0, markerIndex) +
          aiMessage.substring(markerIndex + COMPLETION_MARKER.length);
        cleanedMessage = cleanedMessage.trim();
      }

      const assistantMessageNonStream: Message = {
        role: 'assistant',
        content: cleanedMessage,
        raw_model_text: aiMessageRaw,
        openai_chat_request_snapshot: requestPayload,
        opik_client_trace_id: opikClientTraceId,
      };
      messages.push(assistantMessageNonStream);

      const mergedCompletedIndexes = mergeCompletedIndexes(newProgressIndexes);

      await saveConversation(
        conversation.id,
        submissionIdRaw,
        learnerUserId,
        assignmentId,
        messages,
        responseIdToPersist,
        parsedTasks.length > 0 ? mergedCompletedIndexes : undefined,
      );

      const traceEndMs = Date.now();
      const smartModel = getOpenAIConfig().model;
      void queueOpikTrace({
        traceName: 'perleap-chat.reply',
        tags: ['perleap-chat', 'student'],
        threadId: conversation.id,
        clientTraceId: opikClientTraceId,
        traceStartMs,
        traceEndMs,
        userMessage: userMessageContent,
        assistantMessage: cleanedMessage,
        openaiUsage: result.usage,
        llmModel: (requestPayload.model as string | undefined) ?? smartModel,
        metadata: {
          edge_function: 'perleap-chat',
          assignmentId,
          submissionId: submissionIdRaw,
          learnerUserId,
          stream: false,
          api: useResponses ? 'responses' : 'chat_completions',
          isInitialGreeting: Boolean(isInitialGreeting),
          model: smartModel,
          useResponses,
          chainingFellBack: useResponses ? chainingFellBack : null,
        },
      }).catch(() => undefined);

      const userMessageCount = messages.filter((m) => m.role === 'user').length;
      const assistantMessageCount = messages.filter((m) => m.role === 'assistant').length;
      const turnCount = Math.min(userMessageCount, assistantMessageCount);

      const jsonBody: Record<string, unknown> = {
        message: cleanedMessage,
        turnCount,
        shouldEnd,
        endReason,
      };
      if (allowAdminDebug) {
        jsonBody.debug = {
          rawModelText: aiMessageRaw,
          afterPostprocess: aiMessage,
          finalClientMessage: cleanedMessage,
          model: smartModel,
          temperature: CHAT_TEMPERATURE,
          maxTokens,
          api: useResponses ? 'responses' : 'chat_completions',
          previousResponseId: useResponses ? conversation.lastResponseId ?? null : null,
          chainingFellBack: useResponses ? chainingFellBack : null,
          parsedTaskCount: parsedTasks.length,
          newProgressIndexes,
          completedTaskIndexes: parsedTasks.length > 0 ? mergedCompletedIndexes : null,
        };
      }

      const resHeaders: Record<string, string> = {
        ...corsHeaders,
        ...priorMetaHeaders,
        'Content-Type': 'application/json',
      };
      if (allowAdminDebug) {
        resHeaders['X-Perleap-Chat-Debug'] = '1';
      }

      return new Response(JSON.stringify(jsonBody), { headers: resHeaders });
    }

    // Streaming branch (unified Chat Completions + Responses API via markerSink).
    const opikClientTraceId = uuidv7();
    const traceStartMs = Date.now();
    let upstream: Response;
    if (useResponses) {
      const r = await callResponsesWithFallback();
      upstream = r.result as Response;
      requestPayload = r.payload;
      chainingFellBack = r.chainingFellBack;
    } else {
      upstream = (await createChatCompletionFromPayload(requestPayload)) as Response;
    }

    const encoder = new TextEncoder();
    const welcomeStrip = createInitialWelcomeStreamStripper(
      Boolean(isInitialGreeting),
      language,
    );

    const readableStream = new ReadableStream({
      async start(controller) {
        let modelAccum = '';
        let capturedResponseId: string | null = null;
        let fullContent = '';

        if (greetingPrefix) {
          controller.enqueue(encoder.encode(greetingPrefix));
          fullContent += greetingPrefix;
        }

        const sink = createMarkerSink({
          marker: COMPLETION_MARKER,
          onChunk: (text) => {
            fullContent += text;
            controller.enqueue(encoder.encode(text));
          },
          onMarker: () => {
            controller.enqueue(encoder.encode('__CONVERSATION_END__'));
          },
        });

        // Progress sink: detects the hidden <<<PROGRESS:[...]>>> trailer and forwards everything
        // BEFORE it to the completion-marker sink. Chained: progressSink -> markerSink -> client.
        let capturedProgressIndexes: number[] = [];
        const progressSink = createProgressSink({
          onChunk: (text) => {
            sink.push(text);
          },
          onProgress: (idxs) => {
            capturedProgressIndexes = idxs;
          },
        });

        try {
          let streamUsage: unknown;
          let firstModelTokenMs: number | null = null;
          let streamForwardBuf = '';
          const onModelDelta = (delta: string) => {
            if (delta && firstModelTokenMs === null) {
              firstModelTokenMs = Date.now();
            }
            modelAccum += delta;
            const piece = normalizeAssistantDashes(delta);
            const merged = mergeStreamingTextChunk(streamForwardBuf, piece);
            const incremental = merged.slice(streamForwardBuf.length);
            streamForwardBuf = merged;
            const emitted = welcomeStrip.push(incremental);
            if (emitted) progressSink.push(emitted);
          };

          if (useResponses) {
            await consumeResponsesApiStream(upstream, {
              onDelta: onModelDelta,
              onResponseId: (id) => {
                capturedResponseId = id;
              },
              onUsage: (u) => {
                streamUsage = u;
              },
            });
          } else {
            await consumeChatCompletionsStream(upstream, {
              onDelta: onModelDelta,
              onUsage: (u) => {
                streamUsage = u;
              },
            });
          }

          const tail = welcomeStrip.flush();
          if (tail) progressSink.push(tail);

          progressSink.flush();
          sink.flush();

          const { markerHit } = sink.result();
          const cleanedContent = markerHit ? fullContent.trim() : fullContent;

          messages.push({
            role: 'assistant',
            content: cleanedContent,
            raw_model_text: modelAccum,
            openai_chat_request_snapshot: requestPayload,
            opik_client_trace_id: opikClientTraceId,
          });

          const mergedCompletedIndexes = mergeCompletedIndexes(capturedProgressIndexes);

          await saveConversation(
            conversation.id,
            submissionIdRaw,
            learnerUserId,
            assignmentId,
            messages,
            useResponses ? capturedResponseId : null,
            parsedTasks.length > 0 ? mergedCompletedIndexes : undefined,
          );

          const traceEndMs = Date.now();
          const smartModelStream = getOpenAIConfig().model;
          const ttftMs =
            firstModelTokenMs !== null ? firstModelTokenMs - traceStartMs : undefined;
          void queueOpikTrace({
            traceName: 'perleap-chat.reply',
            tags: ['perleap-chat', 'student'],
            threadId: conversation.id,
            clientTraceId: opikClientTraceId,
            traceStartMs,
            traceEndMs,
            ttftMs,
            userMessage: userMessageContent,
            assistantMessage: cleanedContent,
            openaiUsage: streamUsage,
            llmModel: (requestPayload.model as string | undefined) ?? smartModelStream,
            metadata: {
              edge_function: 'perleap-chat',
              assignmentId,
              submissionId: submissionIdRaw,
              learnerUserId,
              stream: true,
              api: useResponses ? 'responses' : 'chat_completions',
              isInitialGreeting: Boolean(isInitialGreeting),
              model: smartModelStream,
              useResponses,
              chainingFellBack: useResponses ? chainingFellBack : null,
            },
          }).catch(() => undefined);

          controller.close();
        } catch (error) {
          await persistEdgeFunctionLog(
            {
              functionName: 'perleap-chat',
              level: 'error',
              httpStatus: 500,
              message: errorToMessage(error),
              stack: errorToStack(error),
              context: {
                submissionId: submissionIdRaw,
                assignmentId,
                learnerUserId,
                viewerUserId,
              },
            },
            req,
          );
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        ...corsHeaders,
        ...priorMetaHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const message = handleOpenAIError(error);
    await persistEdgeFunctionLog(
      {
        functionName: 'perleap-chat',
        level: 'error',
        httpStatus: 500,
        message,
        stack: errorToStack(error),
      },
      req,
    );
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
