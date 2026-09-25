import type { BanSets } from '@/markdown/scan'

/**
 * Single characters `markdown.md` bans under `## Punctuation`.
 *
 * The parenthetical-aside ban in that section is absent because it quotes a
 * whole clause, and a literal match built from a clause reports the compliant
 * text and reaches none of the violations.
 */
const CHARACTERS = ['—', ';'] as const

/**
 * The one closed set the audit measures, owned here rather than harvested
 * from the standard stating it.
 *
 * Parsing the prose was the alternative and it put a parser contract on a
 * document authored for people. The set is closed rather than extensible,
 * since a character is the one class a literal match settles. A word is left
 * to `write-human` as guidance and a spelling to cspell, because a word ban
 * catches the token and misses the habit behind it.
 */
export const BAN_SETS: BanSets = {
  characters: CHARACTERS,
}

/**
 * Names the set when it arrived empty, so a run measuring nothing says so.
 *
 * Empty is not the same state as finding no hit. A scan with no terms reports
 * a clean file having looked for nothing, which is the silence the audit
 * refused to ship back when a standard could go missing. The set ships with
 * the package now, so the only way it empties is an edit to this file, and
 * the guard is what keeps that edit loud rather than quiet.
 */
export function emptyBanSets(sets: BanSets = BAN_SETS): string[] {
  return (['characters'] as const).filter((name) => sets[name].length === 0)
}
