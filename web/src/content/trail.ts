/**
 * Every line and number the six step figures draw, taken from the record of
 * erclx/canon#2418 and the groundwork track before it. `copy.ts` cites the
 * README, and this module cites the change, so each line names where it came
 * from and whether it is quoted or reconstructed.
 *
 * `quoted` means the words appear in the record as written. `reconstructed`
 * means the line says what the record says in fewer words, and claims no
 * quote. The split follows the one `.canon/video/launch/REVIEW.md` keeps for
 * the launch film, so the page and the film tell the same change the same way.
 *
 * The records are dated and no build re-reads them, since a merged change and
 * a closed groundwork track do not move. A number here is therefore a dated
 * record, shown beside its source and date, rather than a count the build reads.
 */

export type Kind = 'quoted' | 'reconstructed'

/** A row's marker: a finished row, an open one, or the step's one result, which the pip marks. */
export type Mark = 'done' | 'open' | 'result'

export interface Source {
  readonly kind: Kind
  /** The record a reader would open to check the line. */
  readonly from: string
}

export interface Row {
  readonly text: string
  readonly source: Source
  readonly mark?: Mark
  /** A short note pushed to the row's far end. */
  readonly note?: string
  readonly strong?: boolean
  readonly mono?: boolean
  readonly struck?: boolean
}

const GROUNDWORK = 'groundwork 156-context-token-budget'
const PLAN = 'plan feature-context-entry-shape.md'
const PR = 'erclx/canon#2418'
const ORCHESTRATOR = 'the orchestrator transcript for v152.3'
const BOARD = '.canon/tasks/priority.md after v152.3 archived'

/** The date the groundwork track closed, which every number in its step was measured on or before. */
export const MEASURED = '2026-10-17'

export const groundwork = {
  number: {
    value: '218,865',
    caption: 'words of context, up from 16,109 in July',
    source: {
      kind: 'quoted',
      from: `${GROUNDWORK}, 06-decision.md`,
    },
  },
  measured: `Measured ${MEASURED}, ${GROUNDWORK}`,
  rows: [
    {
      text: 'Search',
      note: 'every outside claim carries a link',
      source: { kind: 'reconstructed', from: `${GROUNDWORK}, README.md` },
    },
    {
      text: 'Measure',
      note: 'the whole corpus, by word',
      source: {
        kind: 'reconstructed',
        from: `${GROUNDWORK}, 01-current-state.md`,
      },
    },
    {
      text: 'Spike',
      note: 'one entry, 741 words to 93',
      source: { kind: 'reconstructed', from: `${GROUNDWORK}, 06-decision.md` },
    },
  ],
  decision: {
    text: 'Decision: three sections per entry',
    mark: 'result',
    strong: true,
    source: { kind: 'reconstructed', from: `${GROUNDWORK}, 06-decision.md` },
  },
} as const satisfies {
  number: { value: string; caption: string; source: Source }
  measured: string
  rows: readonly (Row & { note: string })[]
  decision: Row
}

export const plan = {
  file: {
    name: 'feature-context-entry-shape.md',
    where: '.canon/plans',
    source: { kind: 'quoted', from: PLAN },
  },
  sections: [
    { heading: '## Files to touch', line: 'src/context/audit.ts' },
    {
      heading: '## Verification',
      line: 'bun test src/context/audit.test.ts',
    },
    { heading: '## Risks' },
  ],
  sectionsSource: { kind: 'quoted', from: PLAN },
  question: {
    text: '1. Should a gotcha carry its own length limit?',
    strong: true,
    source: { kind: 'reconstructed', from: `${PLAN}, Questions` },
  },
  suggestion: {
    text: 'Suggested: no, one line is enough',
    mark: 'result',
    source: { kind: 'reconstructed', from: `${PLAN}, Questions` },
  },
} as const satisfies {
  file: { name: string; where: string; source: Source }
  sections: readonly { heading: string; line?: string }[]
  sectionsSource: Source
  question: Row
  suggestion: Row
}

export const dispatch = {
  messages: [
    {
      who: 'planner',
      text: 'Two plans landed, linked to their tasks.',
      source: { kind: 'quoted', from: ORCHESTRATOR },
    },
    {
      who: 'orchestrator',
      text: "Both standards plans are in, and I've dispatched their workers on Opus.",
      source: { kind: 'quoted', from: ORCHESTRATOR },
    },
  ],
  view: { title: 'Agent view', state: 'working' },
  sessions: [
    {
      text: 'orchestrator-canon',
      note: 'pinned',
      mark: 'done',
      mono: true,
      source: { kind: 'quoted', from: ORCHESTRATOR },
    },
    {
      text: 'feat/context-entry-shape',
      note: 'editing audit.ts',
      mark: 'result',
      mono: true,
      source: { kind: 'reconstructed', from: `${PR}, first commit` },
    },
    {
      text: 'feat/docs-page-shape',
      note: 'entered worktree',
      mark: 'open',
      mono: true,
      source: { kind: 'reconstructed', from: ORCHESTRATOR },
    },
    {
      text: 'Documentation density…',
      note: 'plans linked',
      mark: 'open',
      mono: true,
      source: { kind: 'reconstructed', from: ORCHESTRATOR },
    },
  ],
} as const satisfies {
  messages: readonly { who: string; text: string; source: Source }[]
  view: { title: string; state: string }
  sessions: readonly Row[]
}

export const build = {
  file: { name: 'src/context/audit.ts', where: 'worktree' },
  rules: {
    before: 'rule loaded → code-craft',
    after: 'rule loaded → test-craft',
    source: { kind: 'reconstructed', from: `${PR}, the worker's session` },
  },
  code: {
    lines: [
      'export const GOTCHA_CAP = 5',
      'export const LAYOUT_BULLET_CAP = 5',
    ],
    source: { kind: 'quoted', from: `${PR}, src/context/audit.ts as merged` },
  },
  gate: { title: 'canon gate run' },
  stages: [
    {
      text: 'context-citations',
      mark: 'done',
      source: { kind: 'quoted', from: `${PR}, gate stage names` },
    },
    {
      text: 'types',
      mark: 'done',
      source: { kind: 'quoted', from: `${PR}, gate stage names` },
    },
    {
      text: 'tests',
      mark: 'done',
      source: { kind: 'quoted', from: `${PR}, gate stage names` },
    },
    {
      text: 'passed',
      note: 'pull request opened',
      mark: 'result',
      strong: true,
      source: { kind: 'reconstructed', from: PR },
    },
  ],
} as const satisfies {
  file: { name: string; where: string }
  rules: { before: string; after: string; source: Source }
  code: { lines: readonly string[]; source: Source }
  gate: { title: string }
  stages: readonly Row[]
}

export const review = {
  head: {
    title: 'Review on #2418',
    tally: '0 critical, 3 should-fix, 2 minor',
    source: { kind: 'quoted', from: `${PR}, first review` },
  },
  findings: [
    {
      text: 'the fold still says to write decisions',
      mark: 'done',
      struck: true,
      source: { kind: 'reconstructed', from: `${PR}, first review` },
    },
    {
      text: 'internal-docs puts decisions back',
      mark: 'done',
      struck: true,
      source: { kind: 'reconstructed', from: `${PR}, first review` },
    },
  ],
  fix: {
    text: 'review-address: fixed at f64e35a',
    mono: true,
    source: { kind: 'quoted', from: `${PR}, commit f64e35a` },
  },
  close: {
    text: '## Review closed',
    note: 're-reviewed f64e35a',
    mark: 'result',
    strong: true,
    source: { kind: 'quoted', from: `${PR}, closing review` },
  },
  checks: {
    title: 'For the reviewer',
    state: 'checked',
    rows: [
      {
        text: 'ungated entry reports, exit 0',
        mark: 'done',
        source: { kind: 'reconstructed', from: `${PR}, For the reviewer` },
      },
      {
        text: 'six gotchas count as six',
        mark: 'done',
        source: { kind: 'reconstructed', from: `${PR}, For the reviewer` },
      },
      {
        text: 'seed tree gates by prefix',
        mark: 'done',
        source: { kind: 'reconstructed', from: `${PR}, For the reviewer` },
      },
    ],
  },
} as const satisfies {
  head: { title: string; tally: string; source: Source }
  findings: readonly Row[]
  fix: Row
  close: Row
  checks: { title: string; state: string; rows: readonly Row[] }
}

export const merge = {
  terminal: { title: 'terminal', where: 'main' },
  command: {
    text: 'canon pr merge 2418',
    source: {
      kind: 'reconstructed',
      from: `${PR}, inferred from the squash subject`,
    },
  },
  results: [
    {
      text: 'merged into main',
      mark: 'result',
      strong: true,
      source: { kind: 'reconstructed', from: `${PR}, merged 2026-10-17` },
    },
    {
      text: 'task archived with its plan',
      mark: 'done',
      source: { kind: 'reconstructed', from: '.husky/post-merge' },
    },
  ],
  board: {
    title: 'Board',
    where: 'priority.md',
    rows: [
      {
        text: 'v152.3 entry shape',
        mark: 'done',
        struck: true,
        source: { kind: 'reconstructed', from: BOARD },
      },
      {
        text: 'v152.4 rebuild',
        note: 'next',
        mark: 'open',
        strong: true,
        source: { kind: 'reconstructed', from: BOARD },
      },
      {
        text: 'v152.6 docs rebuild',
        mark: 'open',
        source: { kind: 'reconstructed', from: BOARD },
      },
    ],
  },
} as const satisfies {
  terminal: { title: string; where: string }
  command: { text: string; source: Source }
  results: readonly Row[]
  board: { title: string; where: string; rows: readonly Row[] }
}
