/**
 * Application Constants
 * Centralized configuration values and magic numbers
 */

// Application Metadata
export const APP_NAME = 'Perleap';
export const APP_DESCRIPTION = 'Educational platform powered by Quantum Education Doctrine';

// Invite Code Configuration
export const INVITE_CODE_LENGTH = 6;

// Assignment Types
export const ASSIGNMENT_TYPES = {
  TEXT_ESSAY: 'text_essay',
  FILE_UPLOAD: 'file_upload',
  QUIZ: 'quiz',
  PROJECT: 'project',
} as const;

// Assignment Status
export const ASSIGNMENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

// Submission Status
export const SUBMISSION_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

// 5D Snapshot Sources
export const SNAPSHOT_SOURCES = {
  ONBOARDING: 'onboarding',
  ASSIGNMENT: 'assignment',
} as const;

// 5D Learning Dimensions
export const LEARNING_DIMENSIONS = {
  COGNITIVE: 'cognitive',
  EMOTIONAL: 'emotional',
  SOCIAL: 'social',
  CREATIVE: 'creative',
  BEHAVIORAL: 'behavioral',
} as const;

// Dimension Labels and Descriptions
export const DIMENSION_CONFIG = {
  cognitive: {
    label: 'Cognitive (White)',
    description: 'Analytical thinking, problem-solving, understanding of concepts',
    color: '#FFFFFF',
  },
  emotional: {
    label: 'Emotional (Red)',
    description: 'Self-awareness, emotional regulation, resilience, growth mindset',
    color: '#EF4444',
  },
  social: {
    label: 'Social (Blue)',
    description: 'Communication skills, collaboration, perspective-taking, empathy',
    color: '#3B82F6',
  },
  creative: {
    label: 'Creative (Yellow)',
    description: 'Innovation, original thinking, curiosity, exploration',
    color: '#EAB308',
  },
  behavioral: {
    label: 'Behavioral (Green)',
    description: 'Task completion, persistence, self-direction, responsibility',
    color: '#22C55E',
  },
} as const;

// Score Ranges
export const SCORE_MIN = 0;
export const SCORE_MAX = 10;
export const DEFAULT_SCORE = 5;

// UI Configuration
export const MIN_MESSAGE_COUNT_FOR_COMPLETION = 2;
export const CHAT_SCROLL_AREA_HEIGHT = 400; // pixels
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Date Formats
export const DATE_FORMAT = 'MM/dd/yyyy';
export const DATETIME_FORMAT = 'MM/dd/yyyy HH:mm';

// API Configuration
export const API_TIMEOUT = 30000; // 30 seconds
export const RETRY_ATTEMPTS = 3;

// Feature Flags (for future use)
export const FEATURES = {
  NOTIFICATIONS: false, // Currently mock data
  FILE_UPLOADS: true,
  ANALYTICS_EXPORT: false,
  REAL_TIME_CHAT: false,
} as const;

// User Roles
export const USER_ROLES = {
  TEACHER: 'teacher',
  STUDENT: 'student',
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_PREFERENCES: 'user_preferences',
  THEME: 'theme',
} as const;

