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
 * The tracked documents the density limits hold: the context entries, the docs
 * pages, the skill bodies, references, and requirements of both skill trees,
 * the tooling seeds and stack references, the wiki, and the two root guides.
 *
 * Rules stay out, since a rule is one imperative per bullet, and so does every
 * `CLAUDE.md` section but Key paths, which `KEY_PATHS_SCOPE` holds. So do the
 * project requirement and design records, a seed carrying one of those three
 * names, the changelog, the examples, and every `.canon/` record, each with a
 * shape and cap of its own. Named here and nowhere else, so the audit, the gate
 * stage reading its exit, and their tests read one scope.
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
 * The density findings a path takes, being every finding on a density-scope
 * file and the Key paths findings on a `CLAUDE.md`. The audit, the init probe,
 * and `canon claude sync` all read this, so the three agree on what counts.
 * The table cell and trailing-list findings join on a density-scope path only,
 * since `densityFindings` stays what its direct callers grade.
 */
export function scopedDensityFindings(
  rel: string,
  lines: readonly BodyLine[],
): DensityFinding[] {
  if (inDensityScope(rel)) {
    return [...densityFindings(lines), ...tableDensityFindings(lines)]
  }
  if (!KEY_PATHS_SCOPE.test(rel)) return []
  return densityFindings(keyPathsSection(lines)).filter((finding) =>
    KEY_PATHS_KINDS.includes(finding.kind),
  )
}

/**
 * The roots `canon init` gates in a new project when each passes at init time:
 * every density surface a target authors itself and the Key paths of its
 * `CLAUDE.md`, leaving out the toolkit's own `claude/skills/` and `tooling/`
 * trees.
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
 * The path prefixes whose density findings fail a run, each added by the
 * rewrite batch that brought its folders to zero.
 *
 * It describes this repository's rewrite progress and nothing about a target's
 * corpus, which is why the audit reads it only inside a canon checkout. A
 * target keeps its own list in the file `src/markdown/gated.ts` reads.
 */
export const GATED_PATHS: readonly string[] = [
  'canon/context/surfaces/',
  'canon/context/workflow/',
  'canon/context/development/',
  'canon/context/features/',
  'canon/context/context-model.md',
  'canon/context/index.md',
  'claude/skills/api-design/REQUIREMENT.md',
  'claude/skills/api-design/SKILL.md',
  'claude/skills/api-design/references/adopted.md',
  'claude/skills/auto-ship/REQUIREMENT.md',
  'claude/skills/auto-ship/SKILL.md',
  'claude/skills/auto-ship/references/draft-mark.md',
  'claude/skills/auto-ship/references/failure-recovery.md',
  'claude/skills/auto-ship/references/fan-in.md',
  'claude/skills/auto-ship/references/tier-failures.md',
  'claude/skills/auto-ship/references/ui-checklist.md',
  'claude/skills/auto-ship/references/verb-absent.md',
  'claude/skills/auto-ship/references/worktree-name.md',
  'claude/skills/backlog-triage/REQUIREMENT.md',
  'claude/skills/backlog-triage/SKILL.md',
  'claude/skills/backlog-triage/references/apply.md',
  'claude/skills/build-in-slices/REQUIREMENT.md',
  'claude/skills/build-in-slices/SKILL.md',
  'claude/skills/build-in-slices/references/adopted.md',
  'claude/skills/canon-cli/REQUIREMENT.md',
  'claude/skills/canon-cli/SKILL.md',
  'claude/skills/canon-feedback/REQUIREMENT.md',
  'claude/skills/canon-feedback/SKILL.md',
  'claude/skills/canon-feedback/references/template.md',
  'claude/skills/ci-workflow/REQUIREMENT.md',
  'claude/skills/ci-workflow/SKILL.md',
  'claude/skills/ci-workflow/references/workflows.md',
  'claude/skills/code-craft/REQUIREMENT.md',
  'claude/skills/code-craft/SKILL.md',
  'claude/skills/code-craft/references/adopted.md',
  'claude/skills/codebase-layout/REQUIREMENT.md',
  'claude/skills/codebase-layout/SKILL.md',
  'claude/skills/codebase-layout/references/adopted.md',
  'claude/skills/codebase-layout/references/frontend.md',
  'claude/skills/codebase-layout/references/tests.md',
  'claude/skills/context-fold/REQUIREMENT.md',
  'claude/skills/context-fold/SKILL.md',
  'claude/skills/context-fold/references/completion-report.md',
  'claude/skills/context-fold/references/context-refresh.md',
  'claude/skills/context-fold/references/context.md',
  'claude/skills/context-fold/references/unusable-baseline.md',
  'claude/skills/create-rule/REQUIREMENT.md',
  'claude/skills/create-rule/SKILL.md',
  'claude/skills/create-rule/references/rule.md',
  'claude/skills/create-skill/REQUIREMENT.md',
  'claude/skills/create-skill/SKILL.md',
  'claude/skills/create-skill/references/skill-disclosure.md',
  'claude/skills/create-skill/references/skill-frontmatter.md',
  'claude/skills/create-skill/references/skill-paths.md',
  'claude/skills/create-skill/references/skill-practice.md',
  'claude/skills/create-skill/references/skill-reference.md',
  'claude/skills/create-skill/references/skill-requirement.md',
  'claude/skills/create-skill/references/skill.md',
  'claude/skills/decision-escalate/REQUIREMENT.md',
  'claude/skills/decision-escalate/SKILL.md',
  'claude/skills/deploy-app/REQUIREMENT.md',
  'claude/skills/deploy-app/SKILL.md',
  'claude/skills/deploy-app/references/cloudflare.md',
  'claude/skills/deploy-app/references/vercel.md',
  'claude/skills/deprecation-migration/REQUIREMENT.md',
  'claude/skills/deprecation-migration/SKILL.md',
  'claude/skills/deprecation-migration/references/adopted.md',
  'claude/skills/design-record/REQUIREMENT.md',
  'claude/skills/design-record/SKILL.md',
  'claude/skills/design-record/references/design.md',
  'claude/skills/design-record/references/folder.md',
  'claude/skills/design-taste/REQUIREMENT.md',
  'claude/skills/design-taste/SKILL.md',
  'claude/skills/design-taste/references/adopted.md',
  'claude/skills/design-taste/references/craft.md',
  'claude/skills/design-taste/references/kinds.md',
  'claude/skills/design-taste/references/preflight.md',
  'claude/skills/design-taste/references/systems.md',
  'claude/skills/design-taste/references/tells.md',
  'claude/skills/design-taste/references/vocabulary.md',
  'claude/skills/docs-sync/REQUIREMENT.md',
  'claude/skills/docs-sync/SKILL.md',
  'claude/skills/docs-sync/references/docs.md',
  'claude/skills/docs-sync/references/readme.md',
  'claude/skills/document-health/REQUIREMENT.md',
  'claude/skills/document-health/SKILL.md',
  'claude/skills/document-health/references/axes.md',
  'claude/skills/document-repair/REQUIREMENT.md',
  'claude/skills/document-repair/SKILL.md',
  'claude/skills/document-repair/references/batches.md',
  'claude/skills/design-pick/REQUIREMENT.md',
  'claude/skills/design-pick/SKILL.md',
  'claude/skills/design-pick/references/board.md',
  'claude/skills/design-pick/references/live-arms.md',
  'claude/skills/write-doc/REQUIREMENT.md',
  'claude/skills/write-doc/SKILL.md',
  'claude/skills/write-doc/references/context.md',
  'claude/skills/write-doc/references/docs.md',
  'claude/skills/write-doc/references/readme.md',
  'claude/skills/write-doc/references/readme/agent-facing.md',
  'claude/skills/write-doc/references/readme/application.md',
  'claude/skills/write-doc/references/readme/cli.md',
  'claude/skills/write-doc/references/readme/library.md',
  'claude/skills/write-doc/references/readme/plugin.md',
  'claude/skills/write-doc/references/requirements.md',
  'claude/skills/write-doc/references/wiki-kind.md',
  'claude/skills/write-doc/references/wiki.md',
  'claude/skills/draw-figure/REQUIREMENT.md',
  'claude/skills/draw-figure/SKILL.md',
  'claude/skills/draw-figure/references/architecture-set.md',
  'claude/skills/draw-figure/references/figures.md',
  'claude/skills/draw-figure/references/hand-drawn.md',
  'claude/skills/draw-figure/references/mermaid-path.md',
  'claude/skills/draw-figure/references/mermaid.md',
  'claude/skills/design-identity/REQUIREMENT.md',
  'claude/skills/design-identity/SKILL.md',
  'claude/skills/design-identity/references/card-route.md',
  'claude/skills/git-branch/REQUIREMENT.md',
  'claude/skills/git-branch/SKILL.md',
  'claude/skills/git-branch/references/branch.md',
  'claude/skills/git-branch/references/slug.md',
  'claude/skills/git-commit/REQUIREMENT.md',
  'claude/skills/git-commit/SKILL.md',
  'claude/skills/git-commit/references/commit.md',
  'claude/skills/git-commit/references/versioning.md',
  'claude/skills/git-followup/REQUIREMENT.md',
  'claude/skills/git-followup/SKILL.md',
  'claude/skills/git-issue/REQUIREMENT.md',
  'claude/skills/git-issue/SKILL.md',
  'claude/skills/git-issue/references/issue.md',
  'claude/skills/git-pr/REQUIREMENT.md',
  'claude/skills/git-pr/SKILL.md',
  'claude/skills/git-pr/references/final-command.md',
  'claude/skills/git-pr/references/labels.md',
  'claude/skills/git-pr/references/pr.md',
  'claude/skills/git-pr/references/publish.md',
  'claude/skills/git-pr/references/task-number.md',
  'claude/skills/git-ship/REQUIREMENT.md',
  'claude/skills/git-ship/SKILL.md',
  'claude/skills/git-ship/references/ci-watch.md',
  'claude/skills/git-split/REQUIREMENT.md',
  'claude/skills/git-split/SKILL.md',
  'claude/skills/git-split/references/independent.md',
  'claude/skills/git-split/references/stacked.md',
  'claude/skills/git-stage/REQUIREMENT.md',
  'claude/skills/git-stage/SKILL.md',
  'claude/skills/git-worktree/REQUIREMENT.md',
  'claude/skills/git-worktree/SKILL.md',
  'claude/skills/git-worktree/references/cleanup.md',
  'claude/skills/markdown-craft/REQUIREMENT.md',
  'claude/skills/markdown-craft/SKILL.md',
  'claude/skills/markdown-craft/references/markdown.md',
  'claude/skills/plan-feature/REQUIREMENT.md',
  'claude/skills/plan-feature/SKILL.md',
  'claude/skills/plan-feature/references/batches.md',
  'claude/skills/plan-feature/references/plan-lifecycle.md',
  'claude/skills/plan-feature/references/plan.md',
  'claude/skills/plan-groundwork/REQUIREMENT.md',
  'claude/skills/plan-groundwork/SKILL.md',
  'claude/skills/plan-groundwork/references/groundwork-spikes.md',
  'claude/skills/plan-groundwork/references/groundwork.md',
  'claude/skills/plan-groundwork/references/output.md',
  'claude/skills/plan-intake-answer/REQUIREMENT.md',
  'claude/skills/plan-intake-answer/SKILL.md',
  'claude/skills/plan-intake/REQUIREMENT.md',
  'claude/skills/plan-intake/SKILL.md',
  'claude/skills/plan-intake/references/intake.md',
  'claude/skills/pr-evidence/REQUIREMENT.md',
  'claude/skills/pr-evidence/SKILL.md',
  'claude/skills/pr-evidence/references/evidence.md',
  'claude/skills/proposal-critique/REQUIREMENT.md',
  'claude/skills/proposal-critique/SKILL.md',
  'claude/skills/review-address/REQUIREMENT.md',
  'claude/skills/review-address/SKILL.md',
  'claude/skills/review-address/references/post-review-findings.md',
  'claude/skills/review-address/references/rebase-conflicts.md',
  'claude/skills/review-address/references/rebase-only.md',
  'claude/skills/review-address/references/rest-reads.md',
  'claude/skills/review-craft/REQUIREMENT.md',
  'claude/skills/review-craft/SKILL.md',
  'claude/skills/review-craft/references/adopted.md',
  'claude/skills/review-craft/references/security.md',
  'claude/skills/review-craft/references/ui.md',
  'claude/skills/review-pr/REQUIREMENT.md',
  'claude/skills/review-pr/SKILL.md',
  'claude/skills/review-pr/references/body-variants.md',
  'claude/skills/review-pr/references/close-out.md',
  'claude/skills/review-pr/references/key-changes.md',
  'claude/skills/review-pr/references/post.md',
  'claude/skills/review-pr/references/scope.md',
  'claude/skills/review-ui/REQUIREMENT.md',
  'claude/skills/review-ui/SKILL.md',
  'claude/skills/review-ui/references/close-out.md',
  'claude/skills/review-ui/references/driving.md',
  'claude/skills/review-ui/references/hosted-preview.md',
  'claude/skills/review-ui/references/post.md',
  'claude/skills/review-ui/references/tick.md',
  'claude/skills/role-orchestrator/REQUIREMENT.md',
  'claude/skills/role-orchestrator/SKILL.md',
  'claude/skills/role-orchestrator/references/orchestrator-cloud-launch.md',
  'claude/skills/role-orchestrator/references/orchestrator-dispatch.md',
  'claude/skills/role-orchestrator/references/orchestrator-filing.md',
  'claude/skills/role-orchestrator/references/orchestrator-handback.md',
  'claude/skills/role-orchestrator/references/orchestrator-handoff.md',
  'claude/skills/role-orchestrator/references/orchestrator-inbound.md',
  'claude/skills/role-orchestrator/references/orchestrator-launch.md',
  'claude/skills/role-orchestrator/references/orchestrator-output.md',
  'claude/skills/role-orchestrator/references/orchestrator-parked.md',
  'claude/skills/role-orchestrator/references/orchestrator-poll.md',
  'claude/skills/role-orchestrator/references/orchestrator-refill.md',
  'claude/skills/role-orchestrator/references/orchestrator-resume.md',
  'claude/skills/role-orchestrator/references/orchestrator-review-dispatch.md',
  'claude/skills/role-orchestrator/references/orchestrator-reviewer-launch.md',
  'claude/skills/role-orchestrator/references/orchestrator-sweep.md',
  'claude/skills/role-orchestrator/references/orchestrator-watch.md',
  'claude/skills/role-planner/REQUIREMENT.md',
  'claude/skills/role-planner/SKILL.md',
  'claude/skills/role-reviewer/REQUIREMENT.md',
  'claude/skills/role-reviewer/SKILL.md',
  'claude/skills/role-worker/REQUIREMENT.md',
  'claude/skills/role-worker/SKILL.md',
  'claude/skills/search-craft/REQUIREMENT.md',
  'claude/skills/search-craft/SKILL.md',
  'claude/skills/search-craft/references/adopted.md',
  'claude/skills/session-compact/REQUIREMENT.md',
  'claude/skills/session-compact/SKILL.md',
  'claude/skills/session-compact/references/handoff-note.md',
  'claude/skills/session-map/REQUIREMENT.md',
  'claude/skills/session-map/SKILL.md',
  'claude/skills/session-map/references/session.md',
  'claude/skills/session-relay/REQUIREMENT.md',
  'claude/skills/session-relay/SKILL.md',
  'claude/skills/session-resume/REQUIREMENT.md',
  'claude/skills/session-resume/SKILL.md',
  'claude/skills/session-worktree/REQUIREMENT.md',
  'claude/skills/session-worktree/SKILL.md',
  'claude/skills/session-worktree/references/install-command.md',
  'claude/skills/session-worktree/references/main-root-writes.md',
  'claude/skills/systematic-debugging/REQUIREMENT.md',
  'claude/skills/systematic-debugging/SKILL.md',
  'claude/skills/systematic-debugging/references/adopted.md',
  'claude/skills/target-check/REQUIREMENT.md',
  'claude/skills/target-check/SKILL.md',
  'claude/skills/target-check/references/domains.md',
  'claude/skills/target-setup/REQUIREMENT.md',
  'claude/skills/target-setup/SKILL.md',
  'claude/skills/target-setup/references/detect.md',
  'claude/skills/target-setup/references/indexes.md',
  'claude/skills/target-setup/references/verify.md',
  'claude/skills/task-board/REQUIREMENT.md',
  'claude/skills/task-board/SKILL.md',
  'claude/skills/task-board/references/board.md',
  'claude/skills/task-board/references/create-report.md',
  'claude/skills/task-board/references/decline.md',
  'claude/skills/task-board/references/tasks-decline.md',
  'claude/skills/task-board/references/tasks.md',
  'claude/skills/task-complete/REQUIREMENT.md',
  'claude/skills/task-complete/SKILL.md',
  'claude/skills/task-complete/references/archive.md',
  'claude/skills/task-complete/references/receipt-sweep.md',
  'claude/skills/task-complete/references/unusable-baseline.md',
  'claude/skills/teach-craft/REQUIREMENT.md',
  'claude/skills/teach-craft/SKILL.md',
  'claude/skills/teach-craft/references/adopted.md',
  'claude/skills/teach-craft/references/lesson-craft.md',
  'claude/skills/teach-craft/references/pedagogy.md',
  'claude/skills/test-craft/REQUIREMENT.md',
  'claude/skills/test-craft/SKILL.md',
  'claude/skills/test-craft/references/adopted.md',
  'claude/skills/test-craft/references/component.md',
  'claude/skills/test-craft/references/e2e.md',
  'claude/skills/test-craft/references/unit.md',
  'claude/skills/test-first/REQUIREMENT.md',
  'claude/skills/test-first/SKILL.md',
  'claude/skills/test-first/references/adopted.md',
  'claude/skills/ui-checklist/REQUIREMENT.md',
  'claude/skills/ui-checklist/SKILL.md',
  'claude/skills/ui-audit/REQUIREMENT.md',
  'claude/skills/ui-audit/SKILL.md',
  'claude/skills/ui-measure/REQUIREMENT.md',
  'claude/skills/ui-measure/SKILL.md',
  'claude/skills/write-human/REQUIREMENT.md',
  'claude/skills/write-human/SKILL.md',
  'claude/skills/write-human/references/adopted.md',
  'claude/skills/write-human/references/density.md',
  'claude/skills/write-human/references/machine-tells.md',
  'claude/skills/youtube-transcripts/REQUIREMENT.md',
  'claude/skills/youtube-transcripts/SKILL.md',
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
 * The limit that gates before any folder is listed, and the surfaces it gates
 * on. A run of more than 5 plain bullets failed the push in the context
 * entries, the docs pages, and the skill bodies and references through a stage
 * of its own before this measure existed, and waiting on `GATED_PATHS` would
 * reopen that hole. The seeds, the stack references, the wiki, and the root
 * guides were never held to it, so they joined `GATED_PATHS` only once their
 * rewrite brought them to zero.
 */
const ALWAYS_GATED: readonly DensityKind[] = ['bullet-run']

/** Whether a path takes density findings at all. */
export function inDensityScope(rel: string): boolean {
  return DENSITY_SCOPE.some((pattern) => pattern.test(rel))
}

/**
 * Whether a density finding of this kind on this path fails the run.
 *
 * `alwaysGated` is off for a target's list, since no stage of a target's ever
 * failed a push on a bullet run, and gating one unlisted would fail an older
 * project's push on prose it has not touched since the limit landed.
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
