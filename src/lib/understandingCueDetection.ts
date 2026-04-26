/**
 * Heuristic, privacy-preserving: detects student phrasing that suggests confusion
 * or a need for re-explanation. Does not send message text to the server — only
 * codes are emitted in nuance event metadata.
 */

export type UnderstandingCueLocale = 'he' | 'en' | 'unknown';

const STRONG_PATTERNS_EN = [
  /\b(don't|do not) understand\b/i,
  /\b(don't|dont|do not)\s+know\b/i,
  /\b(dunno|idk)\b/i,
  /\b(i\s+)?(don't|dont)\s+get( it| this)?\b/i,
  /\bwhat (do you|this|does this) mean\??/i,
  /\bwhat (does|do) (this|it) mean\??/i,
  /\bconfus(ed|ing)\b/i,
  /\b(lost|stuck)\b/i,
  /\bnot sure (what|how|if)\b/i,
  /\bwhat do you mean\b/i,
  /\bcan (you|u) explain\b/i,
  /\bexplain (again|more)\b/i,
  /\bexplain (this|it) to me\b/i,
  /\b(in other words|simpler|step by step)\b/i,
  /\b(huh|hmm\??)\b/i,
  /\bi need help\b/i,
  /\bi need (an )?explanation\b/i,
  /\bcould (you|u) elaborate\b/i,
  /\bclarif(y|ication)\b/i,
];

const STRONG_PATTERNS_HE = [
  /לא מבינ[ה|ים|ות]?/u,
  /מבו?לבל( אות[י|ך])?/u,
  /ת(סביר|עשה) (שוב|עוד|יותר|באנגלית)/u,
  /אפשר (דוג|להסביר)/u,
  /מה (זה|המטרה|אני צריך|אמור|צריך)/u,
  /אני (אבוד|תקוע|לחוץ\?*)/u,
  /זה (לא ברור|מסתורי)/u,
  /לא הבנתי?/u,
  /(ת)?סביר(י)?\s*שוב/u,
  /בקש(ה|תי) (להסביר|הסבר)/u,
  /למה( זה\??)?$/u,
];

const WEAK_PATTERNS_EN = [/\bhelp\b/i, /\bwhy\b/i, /\bhow (does|do|is)\b/i];
const WEAK_PATTERNS_HE = [/\?{2,}/, /איך( זה| עושים)?\??$/u];

const HEBREWS_CHAR_RE = /[\u0590-\u05FF]/;

export interface UnderstandingCueResult {
  hit: boolean;
  reasonCodes: string[];
  localeHint: UnderstandingCueLocale;
}

function isMostlyHebrew(s: string): boolean {
  const letters = s.replace(/[\s\p{P}0-9]/gu, '');
  if (letters.length < 2) return false;
  const he = (letters.match(/[\u0590-\u05FF]/g) || []).length;
  return he / letters.length > 0.4;
}

/**
 * @param text trimmed non-empty user message
 */
export function detectUnderstandingCue(text: string): UnderstandingCueResult {
  const t = text.trim();
  if (t.length < 2) {
    return { hit: false, reasonCodes: [], localeHint: 'unknown' };
  }

  const locale: UnderstandingCueLocale = isMostlyHebrew(t) ? 'he' : HEBREWS_CHAR_RE.test(t) ? 'he' : 'en';
  const reasonCodes: string[] = [];

  for (const re of STRONG_PATTERNS_EN) {
    if (re.test(t)) reasonCodes.push('en:strong');
  }
  for (const re of STRONG_PATTERNS_HE) {
    if (re.test(t)) reasonCodes.push('he:strong');
  }
  if (reasonCodes.length === 0) {
    for (const re of WEAK_PATTERNS_EN) {
      if (re.test(t)) reasonCodes.push('en:weak');
    }
    for (const re of WEAK_PATTERNS_HE) {
      if (re.test(t)) reasonCodes.push('he:weak');
    }
  }

  // Require at least one strong, or 2+ weak, or 1 weak with very short message (likely direct ask)
  const hasStrong = reasonCodes.some((c) => c.endsWith('strong'));
  const weakCount = reasonCodes.filter((c) => c.endsWith('weak')).length;
  const wordCount = t.split(/\s+/).length;
  const hit =
    hasStrong || weakCount >= 2 || (weakCount === 1 && t.length < 50 && (/\?/.test(t) || wordCount <= 8));

  const deduped = [...new Set(reasonCodes)];
  if (!hit) {
    return { hit: false, reasonCodes: [], localeHint: locale };
  }
  if (t.length < 200) {
    return { hit, reasonCodes: deduped.slice(0, 4), localeHint: locale };
  }
  // Long messages: need strong to reduce false positives
  if (hasStrong) {
    return { hit, reasonCodes: deduped.filter((c) => c.includes('strong')).slice(0, 4), localeHint: locale };
  }
  return { hit: false, reasonCodes: [], localeHint: locale };
}
