-- Cached text extracted from artifact submissions (presentation transcript, project files, etc.)
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS artifact_transcript text;

-- Type-specific evaluation prompt add-ons for artifact assignment types
INSERT INTO ai_prompts (
  prompt_key,
  prompt_name,
  prompt_template,
  description,
  variables,
  version,
  language,
  is_active
) VALUES
(
  'eval_type_langchain',
  'Evaluation Type: Langchain Pipeline',
  E'## Input type: Langchain pipeline
The student work is a visual workflow they built (nodes and connections).
Evidence: quote node labels, prompts, trigger modes, email targets, and how steps connect.
Thinking and Action reflect pipeline design, completeness, and logical flow.
Connection may be not assessable unless collaboration is described — use null if absent.',
  'Type-specific block for langchain pipeline assignments',
  '[]'::jsonb,
  1,
  'en',
  true
),
(
  'eval_type_presentation',
  'Evaluation Type: Presentation',
  E'## Input type: Video presentation
The student work is a transcript of their spoken presentation (extracted from submitted video).
Evidence: quote phrases from the transcript that show reasoning, structure, or communication.
Connection reflects clarity, audience awareness, and how they explain ideas.
Action reflects organization, completeness, and delivery of the presentation task.',
  'Type-specific block for presentation assignments',
  '[]'::jsonb,
  1,
  'en',
  true
),
(
  'eval_type_project',
  'Evaluation Type: Project Files',
  E'## Input type: Project artifact files
The student work is text extracted from uploaded files (code, documents, notes). Images may be noted as unreadable.
Evidence: quote excerpts from the extracted file text.
Thinking reflects problem-solving and technical or creative choices visible in the files.
Action reflects completeness and execution of the project requirements.',
  'Type-specific block for project file submissions',
  '[]'::jsonb,
  1,
  'en',
  true
)
ON CONFLICT (prompt_key, language) DO UPDATE SET
  prompt_template = EXCLUDED.prompt_template,
  prompt_name = EXCLUDED.prompt_name,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  version = ai_prompts.version + 1,
  updated_at = now(),
  is_active = true;
