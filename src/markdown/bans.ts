import type { BanSets } from '@/markdown/scan'

/**
 * Single characters `markdown.md` bans under `## Punctuation`. The
 * parenthetical-aside ban is absent because it quotes a whole clause, and a
 * literal match built from one reports compliant text and reaches no violation.
 */
const CHARACTERS = ['—', ';'] as const

/**
 * The one closed set the audit measures, owned here rather than harvested from
 * the standard, which would put a parser contract on a document for people. A
 * character is the one class a literal match settles, and a word ban misses the habit.
 */
export const BAN_SETS: BanSets = {
  characters: CHARACTERS,
}

/**
 * Names the set when it arrived empty, so a run measuring nothing says so. A scan
 * with no terms reports a clean file having looked for nothing, and the set ships
 * with the package, so an edit to this file is the only way it empties.
 */
export function emptyBanSets(sets: BanSets = BAN_SETS): string[] {
  return (['characters'] as const).filter((name) => sets[name].length === 0)
}
