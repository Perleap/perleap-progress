/**
 * Normalize hard_skills JSON: legacy string[] or structured { domain, skill }[]
 */

export type HardSkillPair = { domain: string; skill: string };

function isPair(x: unknown): x is HardSkillPair {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  const d = typeof o.domain === 'string' ? o.domain.trim() : '';
  if (!d) return false;
  const sk =
    typeof o.skill === 'string'
      ? o.skill
      : typeof o.skill_component === 'string'
        ? o.skill_component
        : '';
  return sk.trim().length > 0;
}

/** Parse raw DB or form value into normalized pairs */
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

/** Serialize pairs for assignments.hard_skills column */
export function stringifyHardSkillsForDb(pairs: HardSkillPair[]): string {
  return JSON.stringify(pairs);
}

/** Distinct non-empty domains */
export function distinctDomains(pairs: HardSkillPair[]): string[] {
  const s = new Set<string>();
  for (const p of pairs) {
    if (p.domain.trim()) s.add(p.domain.trim());
  }
  return [...s];
}

/** For hard_skill_domain column: single domain or null if none / multiple */
export function deriveSingleDomainField(pairs: HardSkillPair[]): string | null {
  const d = distinctDomains(pairs);
  if (d.length === 1) return d[0]!;
  return null;
}

/** Persisted DB value for assignments.hard_skill_domain */
export function resolveHardSkillDomainForDb(
  pairs: HardSkillPair[],
  manualDomain: string,
): string | null {
  const single = deriveSingleDomainField(pairs);
  if (single) return single;
  if (pairs.length === 0) return manualDomain.trim() || null;
  return null;
}

export function pairKey(p: HardSkillPair): string {
  return `${p.domain.trim()}\0${p.skill.trim()}`;
}

export function pairsEqual(a: HardSkillPair, b: HardSkillPair): boolean {
  return pairKey(a) === pairKey(b);
}
