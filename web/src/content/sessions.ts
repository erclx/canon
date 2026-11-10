/**
 * The opening's agent view: the sessions it draws from, the order its events
 * run in, and the order its `/` menu lists the workflow skills in. Every name
 * and line is page fiction drawn from how the roles really report, with no
 * local path, version, or account detail.
 *
 * `completed` is the view's starting tally of finished sessions inside the
 * fiction, which ticks up as the loop completes them, and states no count of
 * anything in the repository.
 */

export interface Session {
  readonly n: string
  /** The line it shows while it waits on an answer, present only for a planner that opens on questions. */
  readonly aw?: string
  readonly wk: string
  readonly dn: string
}

export const pool: readonly Session[] = [
  {
    n: 'planner-canon-landing-page',
    aw: 'Two questions, each with a suggested answer',
    wk: 'Writing the plan from the answers',
    dn: 'Plan written, linked to its task',
  },
  {
    n: 'worker-canon-take-timer',
    wk: 'Gate: 9 of 14 stages passed',
    dn: 'Pull request opened, evidence posted',
  },
  {
    n: 'reviewer-canon-sync-stamp',
    wk: 'Second pass on the added commits',
    dn: 'Review closed, no findings',
  },
  {
    n: 'ui-reviewer-canon-toolbar',
    wk: 'Driving the checklist in the running app',
    dn: '10 boxes passed, 2 sent back',
  },
  {
    n: 'planner-canon-gate-stages',
    aw: 'Measure first? One question open',
    wk: 'Groundwork: measuring the gate stages',
    dn: 'Groundwork closed into two tasks',
  },
  {
    n: 'worker-canon-sync-coverage',
    wk: 'Rules loaded: code-craft, test-craft',
    dn: 'Merged by the operator, plan archived',
  },
  {
    n: 'planner-canon-review-lift',
    aw: 'Three questions, each with a suggested answer',
    wk: 'Reading the review layer before planning',
    dn: 'Plan written, linked to its task',
  },
  {
    n: 'worker-canon-session-limits',
    wk: 'Streaming src/sessions/limits.ts',
    dn: 'Pull request opened, evidence posted',
  },
  {
    n: 'worker-canon-drive-check',
    wk: 'Slice 2 of 3: the baseline record',
    dn: 'Pull request opened, evidence posted',
  },
  {
    n: 'reviewer-canon-plan-guard',
    wk: 'First pass against the whole change',
    dn: 'Two findings posted',
  },
  {
    n: 'planner-canon-intake-sort',
    aw: 'Two items need a call',
    wk: 'Sorting the drive findings',
    dn: 'Intake filed, five items',
  },
  {
    n: 'worker-canon-records-push',
    wk: 'Tests green, checking the gate',
    dn: 'Pull request opened, evidence posted',
  },
  {
    n: 'ui-reviewer-canon-board-picks',
    wk: 'Box 4 of 9: focus returns to the frame',
    dn: 'All nine boxes passed',
  },
  {
    n: 'planner-canon-film-beats',
    aw: 'Which take opens the film?',
    wk: 'Timing each take against 32 seconds',
    dn: 'Plan written, linked to its task',
  },
]

/** One event every tick, cycling. */
export const steps = [
  'complete',
  'answer',
  'dispatch',
  'complete',
  'dispatch',
  'complete',
  'answer',
  'dispatch',
] as const

export const pinned = {
  name: 'orchestrator-canon',
  line: 'Wave 3 queued behind two plans',
  age: '3d',
}

export const completed = 41

/** Ages in minutes for the sessions the view opens on, one per group. */
export const opening = {
  awaiting: [2],
  working: [4, 9, 13],
  done: [5, 25, 45, 70, 95, 130],
}

/** The order an empty `/` lists the workflow skills in, ahead of the rest of the catalog. */
export const menuFlow = [
  'role-orchestrator',
  'plan-feature',
  'role-worker',
  'review-pr',
  'review-ui',
  'git-ship',
  'plan-groundwork',
  'role-planner',
  'build-in-slices',
  'review-address',
  'app-drive',
  'design-pick',
  'session-compact',
  'session-resume',
]
