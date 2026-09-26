import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AUDITS } from '@/audits/catalog'
import { listSkills } from '@/claude/skills-list'
import { buildGovCatalog } from '@/gov/list'
import { listStandards } from '@/standards/read'

export interface Catalog {
  readonly id: string
  /** The noun form a prose sentence carries, singular first. */
  readonly nouns: readonly [string, string]
  /**
   * `undefined` means this tree carries nothing this catalog reads, which is
   * ordinary for every catalog but `commands`: a target installing this CLI
   * has no `src/cli.ts` of its own, and reading that as zero would report a
   * finding against every project stating its command count as anything but
   * zero, forever.
   */
  readonly count: (root: string) => number | undefined
}

/** One line per registered top-level command. */
const REGISTER_IMPORT = /^import \{ register as /gm

/**
 * Every top-level `canon` command, read off the CLI entry point rather than a
 * catalog verb, because a command carries no `--json` listing of its own
 * siblings. `regen-hero.sh` reads its own `COMMAND_COUNT` through `gov counts`
 * rather than a second regex on `src/cli.ts`, so this is the one place that
 * pattern is written.
 *
 * This is the one catalog with no meaning outside this repository, the way
 * `regen-hero.sh` documents itself as clone-only for the same reason.
 */
function countCommands(root: string): number | undefined {
  const cli = join(root, 'src', 'cli.ts')
  if (!existsSync(cli)) return undefined
  return [...readFileSync(cli, 'utf8').matchAll(REGISTER_IMPORT)].length
}

/**
 * The closed set of catalogs this sweep counts a document against.
 *
 * Closed rather than derived from every list command this CLI ships, on the
 * design the plan settled on: a wider set widens the false-positive class
 * before the first run has measured how large that class already is. Each
 * reader here walks the filesystem directly rather than shelling out to its
 * own `canon` verb, since this module already runs inside the process that
 * would spawn it.
 */
export const CATALOGS: readonly Catalog[] = [
  {
    id: 'skills',
    nouns: ['skill', 'skills'],
    count: (root) => listSkills(root).length,
  },
  {
    id: 'rules',
    nouns: ['rule', 'rules'],
    count: (root) => buildGovCatalog(root).rules.length,
  },
  {
    id: 'standards',
    nouns: ['standard', 'standards'],
    count: (root) => listStandards(root).length,
  },
  {
    id: 'commands',
    nouns: ['command', 'commands'],
    count: countCommands,
  },
  {
    id: 'audits',
    nouns: ['audit', 'audits'],
    // Reads the registered set living in this same process, so the count this
    // row reports is the tree's own audit surface rather than a stale copy of
    // it, this entry included.
    count: () => AUDITS.length,
  },
]
