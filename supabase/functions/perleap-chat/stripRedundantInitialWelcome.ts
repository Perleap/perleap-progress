/**
 * After a fixed greetingPrefix ("Hello! I am Perleap…"), the model often emits a redundant
 * "Welcome." clause. Strip only from the start of the model's segment (first assistant turn).
 */

const EN_LEADING_WELCOME = /^\s*Welcome\b[!.…,]?\s*/iu;

/** Hebrew opener sometimes used after the fixed intro (parity with EN). */
const HE_LEADING_BRUCHIM = /^\s*ברוך\s+הבא\b[!.…,]?\s*/u;

export function stripRedundantInitialWelcome(text: string, language: string): string {
  if (language === 'he') {
    return text.replace(HE_LEADING_BRUCHIM, '');
  }
  return text.replace(EN_LEADING_WELCOME, '');
}

const MAX_STRIP_BUFFER = 48;

function cannotBecomeLeadingWelcome(buf: string, language: string): boolean {
  const t = buf.replace(/^\s+/, '');
  if (!t) return false;

  if (language === 'he') {
    const p = 'ברוך הבא';
    const head = t.slice(0, Math.min(t.length, p.length + 4));
    if (p.startsWith(head) || head.startsWith(p)) return false;
    if (/^ברוך\s+הבא\b/u.test(t)) return false;
    return t.length > 2;
  }

  if (/^welcome\b/i.test(t)) return false;
  const m = t.match(/^([a-z]+)/i);
  const firstWord = (m?.[1] ?? '').toLowerCase();
  if (!firstWord.length) return false;
  if (firstWord !== 'welcome' && firstWord.startsWith('welcome')) {
    return true; // e.g. welcoming
  }
  if (firstWord.length < 7 && 'welcome'.startsWith(firstWord)) {
    return false;
  }
  return true;
}

export function createInitialWelcomeStreamStripper(
  active: boolean,
  language: string,
): { push: (piece: string) => string; flush: () => string } {
  if (!active) {
    return {
      push: (piece) => piece,
      flush: () => '',
    };
  }

  let buf = '';

  const push = (piece: string): string => {
    buf += piece;
    const stripped = stripRedundantInitialWelcome(buf, language);
    if (stripped !== buf) {
      buf = '';
      return stripped;
    }
    if (buf.length >= MAX_STRIP_BUFFER || cannotBecomeLeadingWelcome(buf, language)) {
      const out = buf;
      buf = '';
      return out;
    }
    return '';
  };

  const flush = (): string => {
    if (!buf) return '';
    const out = stripRedundantInitialWelcome(buf, language);
    buf = '';
    return out;
  };

  return { push, flush };
}
