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
 * The path prefixes whose density findings fail a run, each added by the
 * rewrite batch that brought its folders to zero.
 *
 * It describes this repository's rewrite progress and nothing about a target's
 * corpus, which is why the audit reads it only inside a canon checkout.
 */
export const GATED_PATHS: readonly string[] = [
  'canon/context/claude-plugin/',
  'canon/context/claude-internal/',
  'canon/context/features/',
  'canon/context/cli/',
  'canon/context/sandbox/',
  'canon/context/governance/',
  'canon/context/tooling/',
  'canon/context/web.md',
  'canon/context/context-model.md',
  'canon/context/design.md',
  'canon/context/index.md',
  'claude/skills/api-design/SKILL.md',
  'claude/skills/auto-ship/SKILL.md',
  'claude/skills/backlog-triage/SKILL.md',
  'claude/skills/backlog-triage/references/apply.md',
  'claude/skills/build-in-slices/SKILL.md',
  'claude/skills/canon-cli/SKILL.md',
  'claude/skills/canon-feedback-triage/SKILL.md',
  'claude/skills/canon-feedback/SKILL.md',
  'claude/skills/canvas-board/SKILL.md',
  'claude/skills/ci-workflow/SKILL.md',
  'claude/skills/code-craft/SKILL.md',
  'claude/skills/codebase-layout/SKILL.md',
  'claude/skills/context-fold/SKILL.md',
  'claude/skills/create-rule/SKILL.md',
  'claude/skills/create-skill/SKILL.md',
  'claude/skills/decision-escalate/SKILL.md',
  'claude/skills/deploy-app/SKILL.md',
  'claude/skills/deprecation-migration/SKILL.md',
  'claude/skills/design-taste/SKILL.md',
  'claude/skills/docs-sync/SKILL.md',
  'claude/skills/document-health/SKILL.md',
  'claude/skills/draft-and-pick/SKILL.md',
  'claude/skills/draft-doc/SKILL.md',
  'claude/skills/draft-figure/SKILL.md',
  'claude/skills/draft-identity/SKILL.md',
  'claude/skills/draft-identity/references/card-route.md',
  'claude/skills/draft-ready/SKILL.md',
  'claude/skills/draft-screencast/SKILL.md',
  'claude/skills/draft-screencast/references/beats-template.md',
  'claude/skills/draft-slides/SKILL.md',
  'claude/skills/git-branch/SKILL.md',
  'claude/skills/git-commit/SKILL.md',
  'claude/skills/git-followup/SKILL.md',
  'claude/skills/git-issue/SKILL.md',
  'claude/skills/git-pr/SKILL.md',
  'claude/skills/git-ship/SKILL.md',
  'claude/skills/git-ship/references/ci-watch.md',
  'claude/skills/git-split/SKILL.md',
  'claude/skills/git-split/references/independent.md',
  'claude/skills/git-split/references/stacked.md',
  'claude/skills/git-stage/SKILL.md',
  'claude/skills/git-worktree/SKILL.md',
  'claude/skills/git-worktree/references/cleanup.md',
  'claude/skills/markdown-craft/SKILL.md',
  'claude/skills/plan-feature/SKILL.md',
  'claude/skills/plan-feature/references/batches.md',
  'claude/skills/plan-groundwork/SKILL.md',
  'claude/skills/plan-groundwork/references/output.md',
  'claude/skills/plan-intake-answer/SKILL.md',
  'claude/skills/plan-intake/SKILL.md',
  'claude/skills/read-frames/SKILL.md',
  'claude/skills/record-screencast/SKILL.md',
  'claude/skills/review-address/SKILL.md',
  'claude/skills/review-address/references/rebase-only.md',
  'claude/skills/review-craft/SKILL.md',
  'claude/skills/review-pr/SKILL.md',
  'claude/skills/review-ui/SKILL.md',
  'claude/skills/review-ui/references/hosted-preview.md',
  'claude/skills/role-orchestrator/SKILL.md',
  'claude/skills/role-orchestrator/references/orchestrator-filing.md',
  'claude/skills/role-planner/SKILL.md',
  'claude/skills/role-reviewer/SKILL.md',
  'claude/skills/role-worker/SKILL.md',
  'claude/skills/search-craft/SKILL.md',
  'claude/skills/session-compact/SKILL.md',
  'claude/skills/session-map/SKILL.md',
  'claude/skills/session-relay/SKILL.md',
  'claude/skills/session-resume/SKILL.md',
  'claude/skills/session-worktree/SKILL.md',
  'claude/skills/systematic-debugging/SKILL.md',
  'claude/skills/target-check/SKILL.md',
  'claude/skills/target-setup/SKILL.md',
  'claude/skills/task-board/SKILL.md',
  'claude/skills/task-board/references/create-report.md',
  'claude/skills/task-complete/SKILL.md',
  'claude/skills/teach-workspace/SKILL.md',
  'claude/skills/test-craft/SKILL.md',
  'claude/skills/test-first/SKILL.md',
  'claude/skills/ui-checklist/SKILL.md',
  'claude/skills/ux-audit/SKILL.md',
  'claude/skills/ux-measure/SKILL.md',
  'claude/skills/video-craft/SKILL.md',
  'claude/skills/write-human/SKILL.md',
  'claude/skills/youtube-transcripts/SKILL.md',
  'canon/context/development.md',
  'canon/context/ci/',
  'canon/context/scripts/',
  '.claude/skills/internal-',
]

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
