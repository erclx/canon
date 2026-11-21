import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AUDITS } from '@/audits/catalog'
import { listSkills } from '@/claude/skills-list'
import { buildGovCatalog } from '@/gov/list'

export interface Catalog {
  readonly id: string
  /** The noun form a prose sentence carries, singular first. */
  readonly nouns: readonly [string, string]
  /**
   * `undefined` means this tree carries nothing this catalog reads, which is
   * ordinary for every catalog but `commands`, since a target has no `src/cli.ts`
   * and reading that as zero would report a finding against every project.
   */
  readonly count: (root: string) => number | undefined
}

/** One line per registered top-level command. */
const REGISTER_IMPORT = /^import \{ register as /gm

/**
 * Every top-level `canon` command, read off the CLI entry point since a command
 * carries no `--json` listing of its siblings. Callers import this reader so the
 * pattern on `src/cli.ts` is written once, and it means nothing outside this repository.
 */
export function countCommands(root: string): number | undefined {
  const cli = join(root, 'src', 'cli.ts')
  if (!existsSync(cli)) return undefined
  return [...readFileSync(cli, 'utf8').matchAll(REGISTER_IMPORT)].length
}

/**
 * The closed set of catalogs this sweep counts a document against. A wider set
 * widens the false-positive class before a run has measured it, and each reader
 * walks the filesystem rather than spawning its own `canon` verb.
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
