import type { DensityKind } from '@/markdown/density'

/** The surfaces the retired bullet-stacks stage held, per `ALWAYS_GATED`. */
const BULLET_RUN_SCOPE = [
  /^canon\/context\/.+\.md$/,
  /^docs\/.+\.md$/,
  /^(?:claude|\.claude)\/skills\/[^/]+\/SKILL\.md$/,
  /^(?:claude|\.claude)\/skills\/[^/]+\/references\/.+\.md$/,
]

/**
 * The tracked documents the density limits hold: the context entries, the docs
 * pages, the skill bodies and references of both skill trees, the tooling
 * seeds and stack references, the wiki, and the two root guides.
 *
 * Rules stay out, since a rule is one imperative per bullet. So do
 * `CLAUDE.md`, the requirement and design records, a seed carrying one of
 * those three names, the changelog, the examples, and every `.canon/` record,
 * each with a shape and cap of its own. Named here and nowhere else, so the
 * audit, the gate stage reading its exit, and their tests read one scope.
 */
const DENSITY_SCOPE = [
  ...BULLET_RUN_SCOPE,
  /^tooling\/[^/]+\/seeds\/(?:.+\/)?(?!(?:CLAUDE|REQUIREMENTS|DESIGN)\.md$)[^/]+\.md$/,
  /^tooling\/[^/]+\/reference\.md$/,
  /^wiki\/.+\.md$/,
  /^(?:README|CONTRIBUTING)\.md$/,
]

/**
 * The path prefixes whose density findings fail a run, empty until a rewrite
 * batch brings its folders to zero and adds them here.
 *
 * It describes this repository's rewrite progress and nothing about a target's
 * corpus, which is why the audit reads it only inside a canon checkout.
 */
export const GATED_PATHS: readonly string[] = ['canon/context/claude-plugin/']

/**
 * The limit that gates before any folder is listed, and the surfaces it gates
 * on. A run of more than 5 plain bullets failed the push in the context
 * entries, the docs pages, and the skill bodies and references through a stage
 * of its own before this measure existed, and waiting on `GATED_PATHS` would
 * reopen that hole. The seeds, the stack references, the wiki, and the root
 * guides were never held to it, and seven runs in the stack references would
 * fail the push on the day this lands, so those wait for their batch.
 */
const ALWAYS_GATED: readonly DensityKind[] = ['bullet-run']

/** Whether a path takes density findings at all. */
export function inDensityScope(rel: string): boolean {
  return DENSITY_SCOPE.some((pattern) => pattern.test(rel))
}

/** Whether a density finding of this kind on this path fails the run. */
export function densityGates(
  rel: string,
  kind: DensityKind,
  gated: readonly string[] = GATED_PATHS,
): boolean {
  if (!inDensityScope(rel)) return false
  if (
    ALWAYS_GATED.includes(kind) &&
    BULLET_RUN_SCOPE.some((pattern) => pattern.test(rel))
  )
    return true
  return gated.some((prefix) => rel.startsWith(prefix))
}
