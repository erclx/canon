import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { $ } from 'bun'
import { gitEnv } from '@/git/env'
import { resolveBaseRef } from '@/git/files'
import { INDEX_FILE, standardsSourceDir } from '@/standards/read'

/** Returned when a standard new to this branch states no success criterion under either heading `CRITERION_HEADING` accepts, the gating check. */
export const EXIT_MISSING_CRITERION = 2

/**
 * Matched at any casing, level-2 only, in either heading the corpus writes a
 * criterion under.
 *
 * `standards/standard.md` states the rule under `## Success criterion` and
 * templates the section itself as `## What a working <document type> looks
 * like`, and the template wins where the two disagree, which that file says in
 * as many words. Reading the rule group's own heading as the one to match is
 * what the first spelling here did, and no standard in the corpus carries a
 * criterion under it: 12 of 28 use the templated form and `standard.md` alone
 * carries the literal words, over its rules about criteria rather than over its
 * own. Nothing caught that, because the gate reads a standard new since the
 * merge base and none had arrived since it shipped.
 */
const CRITERION_HEADING =
  /^##\s+(?:success criterion|what a working .+ looks like)\s*$/im

/**
 * The reasons an audit produces no reading. `no-corpus` is the ordinary state
 * of a target that authors no standards of its own, the same absence the
 * skills audit reads as its own `no-corpus`. The other two are a broken git
 * invocation rather than a project stating nothing.
 */
export type StandardsAuditRefusal =
  | 'no-corpus'
  | 'no-base'
  | 'unreadable-arrivals'

export type StandardsAudit =
  | {
      readonly kind: 'measured'
      readonly base: string
      readonly standards: readonly string[]
      readonly withCriterion: readonly string[]
      readonly withoutCriterion: readonly string[]
      readonly arrivals: readonly string[]
      readonly arrivalsWithoutCriterion: readonly string[]
    }
  | { readonly kind: 'refused'; readonly reason: StandardsAuditRefusal }

/**
 * Measures the corpus authored at `standards/` under `root` against the
 * `## Success criterion` gate `standards/standard.md` states, and names which
 * of those files are new since the branch's merge base.
 *
 * Reads the working-root corpus alone, never the packaged fallback
 * `src/standards/read.ts` falls through to for a name lookup, since a target
 * with no authored standards of its own has nothing here to gate.
 */
export async function auditStandards(root: string): Promise<StandardsAudit> {
  const dir = standardsSourceDir(root)
  if (!existsSync(dir)) return { kind: 'refused', reason: 'no-corpus' }

  const standards = readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        entry.name !== INDEX_FILE,
    )
    .map((entry) => entry.name)
    .sort()

  const withCriterion: string[] = []
  const withoutCriterion: string[] = []
  for (const name of standards) {
    const body = readFileSync(join(dir, name), 'utf8')
    ;(CRITERION_HEADING.test(body) ? withCriterion : withoutCriterion).push(
      name,
    )
  }

  const base = await resolveBaseRef(root)
  if (base === undefined) return { kind: 'refused', reason: 'no-base' }

  const arrived = await arrivedStandards(root, base)
  if (arrived === undefined) {
    return { kind: 'refused', reason: 'unreadable-arrivals' }
  }

  const arrivals = standards.filter((name) => arrived.has(name))
  const arrivalsWithoutCriterion = arrivals.filter((name) =>
    withoutCriterion.includes(name),
  )

  return {
    kind: 'measured',
    base,
    standards,
    withCriterion,
    withoutCriterion,
    arrivals,
    arrivalsWithoutCriterion,
  }
}

/**
 * Only an arrival missing the section sets a failing code. Every other
 * standard without one is a known gap `standards/standard.md` names rather
 * than a violation, so failing the push on the 26 already there teaches
 * contributors to route around the stage.
 */
export function auditExitCode(audit: StandardsAudit): number {
  if (audit.kind === 'refused') return 1
  return audit.arrivalsWithoutCriterion.length > 0 ? EXIT_MISSING_CRITERION : 0
}

/**
 * Filenames under `standards/` present in the working tree and absent at
 * `base`: a plain add, with rename detection forced off so a standard moved
 * into the corpus from elsewhere counts the same as one authored fresh.
 */
async function arrivedStandards(
  root: string,
  base: string,
): Promise<Set<string> | undefined> {
  const [added, untracked] = await Promise.all([
    $`git -C ${root} diff --no-renames --name-only --diff-filter=A ${base} -- standards`
      .env(gitEnv())
      .quiet()
      .nothrow(),
    $`git -C ${root} ls-files --others --exclude-standard -- standards`
      .env(gitEnv())
      .quiet()
      .nothrow(),
  ])

  if (added.exitCode !== 0 || untracked.exitCode !== 0) return undefined

  const paths = [
    ...added.text().split('\n'),
    ...untracked.text().split('\n'),
  ].filter(Boolean)

  return new Set(paths.map((path) => basename(path)))
}
