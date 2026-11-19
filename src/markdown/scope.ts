import {
  type DensityFinding,
  type DensityKind,
  densityFindings,
} from '@/markdown/density'
import type { BodyLine } from '@/markdown/scan'
import { tableDensityFindings } from '@/markdown/tables'

/** The surfaces the retired bullet-stacks stage held, per `ALWAYS_GATED`. */
const BULLET_RUN_SCOPE = [
  /^canon\/context\/.+\.md$/,
  /^docs\/.+\.md$/,
  /^(?:claude|\.claude)\/skills\/[^/]+\/SKILL\.md$/,
  /^(?:claude|\.claude)\/skills\/[^/]+\/references\/.+\.md$/,
]

/**
 * The requirement beside each skill. Its findings gate only on a `GATED_PATHS`
 * entry naming the file itself, so the prefix that gates a skill's body never
 * sweeps in a requirement the rewrite has not reached yet.
 */
const REQUIREMENT_SCOPE =
  /^(?:claude|\.claude)\/skills\/[^/]+\/REQUIREMENT\.md$/

/**
 * The one scope the audit, its gate stage, and their tests read. Rules, the
 * requirement and design records, the changelog, examples, and `.canon/` stay
 * out, each carrying a shape and cap of its own.
 */
const DENSITY_SCOPE = [
  ...BULLET_RUN_SCOPE,
  REQUIREMENT_SCOPE,
  /^tooling\/[^/]+\/seeds\/(?:.+\/)?(?!(?:CLAUDE|REQUIREMENTS|DESIGN)\.md$)[^/]+\.md$/,
  /^tooling\/[^/]+\/reference\.md$/,
  /^wiki\/.+\.md$/,
  /^(?:README|CONTRIBUTING)\.md$/,
]

/**
 * The root `CLAUDE.md` and its seed, measured inside `## Key paths` alone. That
 * section is a catalog rather than rules, so it takes the run limit and the H3
 * opening a grouped catalog needs, and nothing else a rule would breach.
 */
const KEY_PATHS_SCOPE = /^(?:tooling\/claude\/seeds\/)?CLAUDE\.md$/
const KEY_PATHS_HEADING = /^## Key paths\s*$/
const KEY_PATHS_KINDS: readonly DensityKind[] = ['bullet-run', 'h3-opening']

/**
 * The design index, measured for table cells alone, since only an index still
 * kept as one table carries any. The finding never gates, since its fix is the
 * move to group files rather than one push.
 */
const DESIGN_INDEX_SCOPE = /^canon\/design\/index\.md$/

/** Whether a path is the design reference index. */
export function isDesignIndex(rel: string): boolean {
  return DESIGN_INDEX_SCOPE.test(rel)
}

/** The lines under `## Key paths` up to the next H1 or H2, keeping their numbers. */
function keyPathsSection(lines: readonly BodyLine[]): readonly BodyLine[] {
  const start = lines.findIndex(
    (line) => !line.fenced && KEY_PATHS_HEADING.test(line.text),
  )
  if (start === -1) return []
  const rest = lines.slice(start + 1)
  const end = rest.findIndex(
    (line) => !line.fenced && /^#{1,2}\s/.test(line.text),
  )
  return end === -1 ? rest : rest.slice(0, end)
}

/**
 * The density findings a path takes, shared by the audit, the init probe, and
 * `canon claude sync` so the three agree. Table findings join here rather than
 * in `densityFindings`, which stays what its direct callers grade.
 */
export function scopedDensityFindings(
  rel: string,
  lines: readonly BodyLine[],
): DensityFinding[] {
  if (inDensityScope(rel)) {
    return [...densityFindings(lines), ...tableDensityFindings(lines)]
  }
  if (isDesignIndex(rel)) {
    return tableDensityFindings(lines).filter(
      (finding) => finding.kind === 'table-cell',
    )
  }
  if (!KEY_PATHS_SCOPE.test(rel)) return []
  return densityFindings(keyPathsSection(lines)).filter((finding) =>
    KEY_PATHS_KINDS.includes(finding.kind),
  )
}

/**
 * The roots `canon init` gates in a new project when each passes at init time,
 * being the density surfaces a target authors itself, never the toolkit's own
 * `claude/skills/` and `tooling/` trees.
 */
export const GATED_SCOPE_ROOTS: readonly string[] = [
  'canon/context/',
  'docs/',
  '.claude/skills/',
  'wiki/',
  'README.md',
  'CONTRIBUTING.md',
  'CLAUDE.md',
]

/**
 * This repository's gated prefixes, read only inside a canon checkout, since a
 * target keeps its own list. A requirement gates on its exact path alone, as
 * `densityGates` never reads one off a prefix.
 */
export const GATED_PATHS: readonly string[] = [
  'canon/context/surfaces/',
  'canon/context/workflow/',
  'canon/context/development/',
  'canon/context/features/',
  'canon/context/context-model.md',
  'canon/context/index.md',
  'claude/skills/',
  'claude/skills/api-design/REQUIREMENT.md',
  'claude/skills/auto-ship/REQUIREMENT.md',
  'claude/skills/backlog-triage/REQUIREMENT.md',
  'claude/skills/build-in-slices/REQUIREMENT.md',
  'claude/skills/canon-cli/REQUIREMENT.md',
  'claude/skills/canon-feedback/REQUIREMENT.md',
  'claude/skills/ci-workflow/REQUIREMENT.md',
  'claude/skills/code-craft/REQUIREMENT.md',
  'claude/skills/codebase-layout/REQUIREMENT.md',
  'claude/skills/context-fold/REQUIREMENT.md',
  'claude/skills/create-rule/REQUIREMENT.md',
  'claude/skills/create-skill/REQUIREMENT.md',
  'claude/skills/decision-escalate/REQUIREMENT.md',
  'claude/skills/deploy-app/REQUIREMENT.md',
  'claude/skills/deprecation-migration/REQUIREMENT.md',
  'claude/skills/design-record/REQUIREMENT.md',
  'claude/skills/design-taste/REQUIREMENT.md',
  'claude/skills/docs-sync/REQUIREMENT.md',
  'claude/skills/document-health/REQUIREMENT.md',
  'claude/skills/document-repair/REQUIREMENT.md',
  'claude/skills/design-pick/REQUIREMENT.md',
  'claude/skills/write-doc/REQUIREMENT.md',
  'claude/skills/draw-figure/REQUIREMENT.md',
  'claude/skills/design-identity/REQUIREMENT.md',
  'claude/skills/git-branch/REQUIREMENT.md',
  'claude/skills/git-commit/REQUIREMENT.md',
  'claude/skills/git-followup/REQUIREMENT.md',
  'claude/skills/git-issue/REQUIREMENT.md',
  'claude/skills/git-pr/REQUIREMENT.md',
  'claude/skills/git-ship/REQUIREMENT.md',
  'claude/skills/git-split/REQUIREMENT.md',
  'claude/skills/git-stage/REQUIREMENT.md',
  'claude/skills/git-worktree/REQUIREMENT.md',
  'claude/skills/issue-triage/REQUIREMENT.md',
  'claude/skills/markdown-craft/REQUIREMENT.md',
  'claude/skills/plan-feature/REQUIREMENT.md',
  'claude/skills/plan-groundwork/REQUIREMENT.md',
  'claude/skills/plan-intake-answer/REQUIREMENT.md',
  'claude/skills/plan-intake/REQUIREMENT.md',
  'claude/skills/pr-evidence/REQUIREMENT.md',
  'claude/skills/proposal-critique/REQUIREMENT.md',
  'claude/skills/review-address/REQUIREMENT.md',
  'claude/skills/review-craft/REQUIREMENT.md',
  'claude/skills/review-pr/REQUIREMENT.md',
  'claude/skills/review-ui/REQUIREMENT.md',
  'claude/skills/role-orchestrator/REQUIREMENT.md',
  'claude/skills/role-planner/REQUIREMENT.md',
  'claude/skills/role-reviewer/REQUIREMENT.md',
  'claude/skills/role-worker/REQUIREMENT.md',
  'claude/skills/search-craft/REQUIREMENT.md',
  'claude/skills/session-compact/REQUIREMENT.md',
  'claude/skills/session-map/REQUIREMENT.md',
  'claude/skills/session-relay/REQUIREMENT.md',
  'claude/skills/session-resume/REQUIREMENT.md',
  'claude/skills/session-worktree/REQUIREMENT.md',
  'claude/skills/systematic-debugging/REQUIREMENT.md',
  'claude/skills/target-check/REQUIREMENT.md',
  'claude/skills/target-setup/REQUIREMENT.md',
  'claude/skills/task-board/REQUIREMENT.md',
  'claude/skills/task-complete/REQUIREMENT.md',
  'claude/skills/teach-craft/REQUIREMENT.md',
  'claude/skills/test-craft/REQUIREMENT.md',
  'claude/skills/test-first/REQUIREMENT.md',
  'claude/skills/ui-checklist/REQUIREMENT.md',
  'claude/skills/ui-audit/REQUIREMENT.md',
  'claude/skills/ui-measure/REQUIREMENT.md',
  'claude/skills/write-human/REQUIREMENT.md',
  'claude/skills/youtube-transcripts/REQUIREMENT.md',
  '.claude/skills/internal-claude/REQUIREMENT.md',
  '.claude/skills/internal-docs/REQUIREMENT.md',
  '.claude/skills/internal-feedback-triage/REQUIREMENT.md',
  '.claude/skills/internal-governance/REQUIREMENT.md',
  '.claude/skills/internal-rule-audit/REQUIREMENT.md',
  '.claude/skills/internal-sandbox-check/REQUIREMENT.md',
  '.claude/skills/internal-scripts/REQUIREMENT.md',
  '.claude/skills/internal-shipped-reference/REQUIREMENT.md',
  '.claude/skills/internal-tooling/REQUIREMENT.md',
  '.claude/skills/internal-upstream-digest/REQUIREMENT.md',
  '.claude/skills/internal-web/REQUIREMENT.md',
  '.claude/skills/internal-',
  'docs/',
  'tooling/',
  'wiki/',
  'README.md',
  'CONTRIBUTING.md',
  'CLAUDE.md',
]

/**
 * The limit that gates before any folder is listed, since a bullet run already
 * failed the push on these surfaces through an older stage, and waiting on
 * `GATED_PATHS` would reopen that hole.
 */
const ALWAYS_GATED: readonly DensityKind[] = ['bullet-run']

/** Whether a path takes density findings at all. */
export function inDensityScope(rel: string): boolean {
  return DENSITY_SCOPE.some((pattern) => pattern.test(rel))
}

/**
 * Whether a density finding fails the run. `alwaysGated` is off for a target's
 * list, so an older project's push never fails on prose it has not touched.
 */
export function densityGates(
  rel: string,
  kind: DensityKind,
  gated: readonly string[] = GATED_PATHS,
  alwaysGated = true,
): boolean {
  if (!inDensityScope(rel) && !KEY_PATHS_SCOPE.test(rel)) return false
  if (REQUIREMENT_SCOPE.test(rel)) return gated.includes(rel)
  if (
    alwaysGated &&
    ALWAYS_GATED.includes(kind) &&
    BULLET_RUN_SCOPE.some((pattern) => pattern.test(rel))
  )
    return true
  return gated.some((prefix) => rel.startsWith(prefix))
}
