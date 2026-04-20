/**
 * Normalize hard_skills JSON from DB: legacy string[] or structured { domain, skill }[]
 */

export type HardSkillPair = { domain: string; skill: string };

function isPair(x: unknown): x is HardSkillPair {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  const hasSkill = typeof o.skill === 'string';
  const hasComponent = typeof o.skill_component === 'string';
  const d = typeof o.domain === 'string' ? o.domain.trim() : '';
  if (!d) return false;
  if (hasSkill) return (o.skill as string).trim().length > 0;
  if (hasComponent) return (o.skill_component as string).trim().length > 0;
  return false;
}

/** Parse raw DB value into normalized pairs; legacy strings use fallbackDomain when provided. */
export function parseHardSkillsFromDb(
  raw: unknown,
  fallbackDomain: string | null | undefined,
): HardSkillPair[] {
  let arr: unknown[] = [];
  if (raw == null) return [];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      arr = raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  } else if (Array.isArray(raw)) {
    arr = raw;
  } else {
    return [];
  }

  const fallback = (fallbackDomain ?? '').trim();
  const out: HardSkillPair[] = [];
  for (const item of arr) {
    if (typeof item === 'string') {
      const s = item.trim();
      if (s) out.push({ domain: fallback, skill: s });
    } else if (isPair(item)) {
      const o = item as Record<string, string>;
      const skill = (o.skill ?? o.skill_component ?? '').trim();
      if (skill) out.push({ domain: o.domain.trim(), skill });
    }
  }
  return out;
}

/** Lines for prompts when multiple domains may appear */
export function formatHardSkillPairsForPrompt(pairs: HardSkillPair[], singleDomainLabel?: string | null): string {
  if (pairs.length === 0) return '';
  const distinctDomains = new Set(pairs.map((p) => p.domain).filter(Boolean));
  if (distinctDomains.size <= 1 && singleDomainLabel?.trim()) {
    return pairs.map((p) => p.skill).join(', ');
  }
  return pairs.map((p) => (p.domain ? `${p.domain} — ${p.skill}` : p.skill)).join('; ');
}

/** Flat skill names only (CRA items use skill_component per row; domain passed separately in old flow) */
export function skillNamesFromPairs(pairs: HardSkillPair[]): string[] {
  return pairs.map((p) => p.skill);
}

/** Resolve DB row domain for a CRA skill_component string */
export function domainForSkillComponent(
  pairs: HardSkillPair[],
  skillComponent: string,
  fallbackDomain: string | null | undefined,
): string {
  const t = String(skillComponent ?? '').trim();
  const m = pairs.find((p) => p.skill.trim() === t);
  if (m?.domain.trim()) return m.domain.trim();
  return String(fallbackDomain ?? '').trim();
}
