/** JSON schemas for OpenAI structured outputs (strict). */

const dimensionSchema = {
  type: 'object',
  properties: {
    level: { type: ['integer', 'null'] },
    development: { type: ['integer', 'null'] },
    motivation: { type: ['integer', 'null'] },
    phase: { type: ['string', 'null'], enum: ['up', 'down', null] },
    next: { type: ['string', 'null'] },
    score: { type: ['number', 'null'] },
    notAssessableReason: { type: ['string', 'null'] },
    evidence: {
      type: 'array',
      items: { type: 'string' },
    },
    explanation: { type: 'string' },
  },
  required: [
    'level',
    'development',
    'motivation',
    'phase',
    'next',
    'score',
    'notAssessableReason',
    'evidence',
    'explanation',
  ],
  additionalProperties: false,
} as const;

export const EVALUATION_MAIN_JSON_SCHEMA = {
  name: 'evaluation_main',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      assignmentChecklist: {
        type: 'array',
        items: { type: 'string' },
      },
      dimensions: {
        type: 'object',
        properties: {
          vision: dimensionSchema,
          values: dimensionSchema,
          thinking: dimensionSchema,
          connection: dimensionSchema,
          action: dimensionSchema,
        },
        required: ['vision', 'values', 'thinking', 'connection', 'action'],
        additionalProperties: false,
      },
      studentFeedback: { type: 'string' },
      teacherFeedback: { type: 'string' },
    },
    required: [
      'assignmentChecklist',
      'dimensions',
      'studentFeedback',
      'teacherFeedback',
    ],
    additionalProperties: false,
  },
} as const;

export const EVALUATION_HARD_SKILLS_JSON_SCHEMA = {
  name: 'evaluation_hard_skills',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      hardSkillsAssessment: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            skill_component: { type: 'string' },
            current_level_percent: { type: ['number', 'null'] },
            proficiency_description: { type: 'string' },
            actionable_challenge: { type: 'string' },
            evidence: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: [
            'skill_component',
            'current_level_percent',
            'proficiency_description',
            'actionable_challenge',
            'evidence',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['hardSkillsAssessment'],
    additionalProperties: false,
  },
} as const;
