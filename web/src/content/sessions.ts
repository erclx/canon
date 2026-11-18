/**
 * The opening's agent view, page fiction with no local path or account detail.
 * `completed` is a tally inside the fiction, never a count of the repository.
 */

export type Role = 'planner' | 'worker' | 'reviewer' | 'ui-reviewer'

export interface Change {
  readonly slug: string
  /** Whether a UI reviewer drives it after the code reviewer starts. */
  readonly ui: boolean
  /** The line its planner shows while it waits on an answer, present only on a change whose plan opens on questions. */
  readonly asks?: string
}

export const changes: readonly Change[] = [
  { slug: 'take-timer', ui: true },
  { slug: 'sync-stamp', ui: true },
  {
    slug: 'gate-stages',
    ui: false,
    asks: 'Measure first? One question open',
  },
  {
    slug: 'landing-page',
    ui: true,
    asks: 'Two questions, each with a suggested answer',
  },
  { slug: 'sync-coverage', ui: false },
  {
    slug: 'review-lift',
    ui: false,
    asks: 'Three questions, each with a suggested answer',
  },
  { slug: 'session-limits', ui: false },
  { slug: 'toolbar', ui: true },
  { slug: 'drive-check', ui: false },
  { slug: 'plan-guard', ui: false },
  { slug: 'intake-sort', ui: false, asks: 'Two items need a call' },
  { slug: 'records-push', ui: false },
  { slug: 'board-picks', ui: true },
  { slug: 'film-beats', ui: true, asks: 'Which take opens the film?' },
]

/** The status lines a working session steps through in place, and the line it finishes on. */
export const roleLines: Readonly<
  Record<Role, { readonly wk: readonly string[]; readonly dn: string }>
> = {
  planner: {
    wk: [
      'Reading the tree before planning',
      'Writing the plan from the answers',
    ],
    dn: 'Plan written, linked to its task',
  },
  worker: {
    wk: [
      'Rules loaded: code-craft, test-craft',
      'Committing the first slice',
      'Tests green, checking the gate',
      'Gate: 9 of 14 stages passed',
    ],
    dn: 'Pull request opened, evidence posted',
  },
  reviewer: {
    wk: [
      'First pass against the whole change',
      'Second pass on the added commits',
    ],
    dn: 'Review closed, no findings',
  },
  'ui-reviewer': {
    wk: [
      'Starting the app from the branch',
      'Driving the checklist in the running app',
      'Box 4 of 9: focus returns to the frame',
    ],
    dn: 'All nine boxes passed',
  },
}

export const pinned = {
  name: 'orchestrator-canon',
  line: 'Wave 3 queued behind two plans',
  age: '3d',
}

export const completed = 41

/** One session the view opens on: its role and change, the status line it has reached, and its age in minutes. */
export interface Seat {
  readonly role: Role
  readonly slug: string
  readonly line: number
  readonly age: number
}

/**
 * The sessions the view opens on, a worker and both reviewers of one change
 * already in flight so the first ticks show a handoff, and the change the
 * next dispatch takes.
 */
export const opening: {
  readonly awaiting: readonly Seat[]
  readonly working: readonly Seat[]
  readonly done: readonly Seat[]
  readonly next: string
} = {
  awaiting: [{ role: 'planner', slug: 'landing-page', line: 0, age: 2 }],
  working: [
    { role: 'worker', slug: 'take-timer', line: 3, age: 9 },
    { role: 'reviewer', slug: 'sync-stamp', line: 1, age: 4 },
    { role: 'ui-reviewer', slug: 'sync-stamp', line: 1, age: 4 },
    { role: 'planner', slug: 'gate-stages', line: 0, age: 1 },
  ],
  done: [
    { role: 'worker', slug: 'sync-stamp', line: 0, age: 5 },
    { role: 'planner', slug: 'take-timer', line: 0, age: 25 },
    { role: 'planner', slug: 'sync-stamp', line: 0, age: 45 },
    { role: 'reviewer', slug: 'sync-coverage', line: 0, age: 70 },
    { role: 'worker', slug: 'sync-coverage', line: 0, age: 95 },
  ],
  next: 'review-lift',
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
