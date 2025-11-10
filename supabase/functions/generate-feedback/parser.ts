/**
 * Feedback Parser
 * Parse AI-generated feedback into structured format
 */

import { logWarn, logError } from '../shared/logger.ts';

interface ParsedFeedback {
  studentFeedback: string;
  teacherFeedback: string | null;
}

/**
 * Clean feedback text (remove emojis, framework terminology, and extra whitespace)
 */
const cleanFeedbackText = (text: string): string => {
  let cleaned = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, ''); // Remove emojis
  
  // Remove references to Quantum Education Doctrine and Student Wave Function
  cleaned = cleaned.replace(/Quantum Education Doctrine/gi, '');
  cleaned = cleaned.replace(/Student Wave Function/gi, '');
  cleaned = cleaned.replace(/\bSWF\b/g, ''); // Remove SWF acronym (whole word only)
  
  // Clean up any resulting double spaces or awkward punctuation
  cleaned = cleaned.replace(/\s+/g, ' '); // Multiple spaces to single space
  cleaned = cleaned.replace(/\s+([.,;:!?])/g, '$1'); // Remove space before punctuation
  cleaned = cleaned.replace(/([.,;:!?])\s*([.,;:!?])/g, '$1$2'); // Remove duplicate punctuation
  
  return cleaned.trim();
};

/**
 * Parse feedback using new distinctive markers
 */
export const parseFeedback = (feedbackText: string): ParsedFeedback => {
  const cleanedText = cleanFeedbackText(feedbackText);

  const studentStartMarker = '===STUDENT_FEEDBACK_START===';
  const studentEndMarker = '===STUDENT_FEEDBACK_END===';
  const teacherStartMarker = '===TEACHER_FEEDBACK_START===';
  const teacherEndMarker = '===TEACHER_FEEDBACK_END===';

  const studentStart = cleanedText.indexOf(studentStartMarker);
  const studentEnd = cleanedText.indexOf(studentEndMarker);
  const teacherStart = cleanedText.indexOf(teacherStartMarker);
  const teacherEnd = cleanedText.indexOf(teacherEndMarker);

  // Try new format first
  if (studentStart !== -1 && studentEnd !== -1 && teacherStart !== -1 && teacherEnd !== -1) {
    return {
      studentFeedback: cleanedText
        .substring(studentStart + studentStartMarker.length, studentEnd)
        .trim(),
      teacherFeedback: cleanedText
        .substring(teacherStart + teacherStartMarker.length, teacherEnd)
        .trim(),
    };
  }

  // Fallback to old format
  logWarn('New markers not found, trying old format');
  return parseFeedbackFallback(cleanedText);
};

/**
 * Fallback parser for old format
 */
const parseFeedbackFallback = (cleanedText: string): ParsedFeedback => {
  const patterns = [
    /\*\*\s*Feedback for\s+([^\*]+?)\s*\*\*\s*([\s\S]*?)\s*\*\*\s*End of Feedback\s*\*\*/gi,
    /Feedback for\s+([^\n]+?)\s*\n([\s\S]*?)End of Feedback/gi,
    /Feedback for\s+(.+?)\s+([\s\S]*?)\s+End of Feedback/gi,
  ];

  for (const pattern of patterns) {
    const matches = Array.from(cleanedText.matchAll(pattern));
    if (matches.length >= 2) {
      return {
        studentFeedback: matches[0][2]?.trim() || '',
        teacherFeedback: matches[1][2]?.trim() || null,
      };
    }
  }

  // Ultra-fallback
  logWarn('Trying ultra-fallback split method');
  const parts = cleanedText.split(/End of Feedback/i);

  if (parts.length >= 3) {
    return {
      studentFeedback: parts[0].replace(/^.*?Feedback for\s+[^\n]+?\s*/i, '').trim(),
      teacherFeedback: parts[1].replace(/^.*?Feedback for\s+[^\n]+?\s*/i, '').trim(),
    };
  }

  logError('Could not parse feedback format properly', { partsFound: parts.length });
  return {
    studentFeedback: cleanedText,
    teacherFeedback: null,
  };
};

/**
 * Parse 5D scores from AI response
 */
export const parseScores = (scoresText: string): Record<string, number> => {
  try {
    const cleaned = scoresText.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    logError('Failed to parse scores', { scoresText, error });
    return { vision: 5, values: 5, thinking: 5, connection: 5, action: 5 };
  }
};

