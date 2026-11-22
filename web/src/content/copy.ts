/**
 * Every string on the page, each quoting `README.md` or marked as a paraphrase,
 * which `readmeCitations` checks. A pair of backticks marks code.
 */

const REPO = 'https://github.com/erclx/canon'
const NPM = 'https://www.npmjs.com/package/@erclx/canon'
const DOCS = `${REPO}/tree/main/docs`
/**
 * The origin `.github/workflows/deploy-site.yml` publishes to, which the card's
 * image URL and `astro.config.mjs` read. No README sentence states it.
 */
const ORIGIN = 'https://canon.erclx.com'

export const site = {
  /** The name the social card and its alt text draw, so a change re-captures the card. */
  name: 'Canon',
  /**
   * The host, which `og:site_name` reads. LinkedIn prints it under the share
   * title, which already reads `title`, so the name there would show twice.
   */
  label: new URL(ORIGIN).host,
  origin: ORIGIN,
  /** The browser tab and the share title, which read the project name alone with no tagline after it. */
  title: 'Canon',
  // README.md: "A Claude Code plugin and CLI that runs agent work from plan to merge."
  description:
    'A Claude Code plugin and CLI that runs agent work from plan to merge.',
  /** The README's payoff line, also the `description` in `package.json` and both manifests, kept equal by `positioning.test.ts`. */
  // README.md: "Runs your agent's work and keeps its code good, on one setup for every repo."
  tagline:
    "Runs your agent's work and keeps its code good, on one setup for every repo.",
  /** The handle the social card signs with, rather than the copyright holder `LICENSE` names. */
  author: 'erclx',
}

export const skipLink = 'Skip to the page'

/**
 * The page's sections in the order they run, which the nav, its menu, the
 * footer, and the in-view marker all read. The bar drops a section marked
 * `fold` under 1100, where all eight no longer fit its one row.
 */
export const sections = [
  // README.md: canon-allow-readme-paraphrase: one-word jump labels for the README's own section headings.
  { id: 'worktrees', label: 'Worktrees', fold: true },
  { id: 'records', label: 'Records', fold: false },
  { id: 'craft', label: 'Craft', fold: false },
  { id: 'guardrails', label: 'Guardrails', fold: false },
  { id: 'evidence', label: 'Evidence', fold: false },
  { id: 'board', label: 'Board', fold: false },
  { id: 'health', label: 'Health', fold: true },
  { id: 'install', label: 'Install', fold: false },
] as const

export const nav = {
  mark: 'Canon',
  back: 'Canon, back to top',
  // README.md: "Docs"
  docs: { href: DOCS, label: 'Docs' },
  github: { href: REPO, label: 'GitHub' },
  /** The menu below 900, carrying every section, Docs, and GitHub. */
  menu: 'Menu',
  toggle: {
    toDark: 'Switch to dark theme',
    toLight: 'Switch to light theme',
  },
}

export const fold = {
  // README.md: "Claude Code plugin and CLI"
  kick: 'Claude Code plugin and CLI',
  /** The claim in three runs, with the record icon set before `plan` and the merge icon before `merge`. */
  // README.md: canon-allow-readme-paraphrase: the product name ahead of the opening sentence's claim. "runs agent work from" "plan to merge"
  parts: ['Canon runs agent work from', 'plan to', 'merge'] as const,
  // README.md: canon-allow-readme-paraphrase: the product name ahead of the opening sentence's claim. "runs agent work from plan to merge"
  headline: 'Canon runs agent work from plan to merge',
  // README.md: "And holds it to good engineering practice the whole way."
  lead: 'And holds it to good engineering practice the whole way.',
  view: {
    title: 'claude',
    // README.md: canon-allow-readme-paraphrase: the agent view's own prompt hint, which no README sentence carries.
    hint: 'describe a task for a new session',
    shellHint: 'run a shell command',
    askLabel: 'Describe a task for a new session',
    menuLabel: 'Commands',
    noMatch: 'No matching command',
  },
}

/**
 * The opening's relay: the orchestrator over the four role cards it starts,
 * then the merge left to the reader. Each card's session and status line come
 * from `sessions.ts`, so the relay and the agent view tell one story.
 */
export const relay = {
  // README.md: canon-allow-readme-paraphrase: the orchestrator's bar and the line beside it condense the README's roles sentence. "you talk to the orchestrator that starts them"
  orchestrator: {
    label: 'starts each session',
    name: 'Orchestrator',
    you: 'you talk to this one session',
  },
  // README.md: canon-allow-readme-paraphrase: the list's name and each card's step, role, and handoff, page fiction drawn from the README's roles list. "A planner reads the code and writes one plan you approve" "A worker builds the plan and opens the pull request"
  label: 'One change handed from session to session',
  slug: 'landing-page',
  handsOn: 'hands on →',
  steps: [
    {
      step: '1 · plan',
      role: 'Planner',
      seat: 'planner',
      hand: 'feature-landing-page.md',
    },
    {
      step: '2 · build',
      role: 'Worker',
      seat: 'worker',
      hand: 'the pull request',
    },
    {
      step: '3 · review',
      role: 'Code reviewer',
      seat: 'reviewer',
      hand: '## Review closed',
    },
    {
      step: '4 · drive',
      role: 'UI reviewer',
      seat: 'ui-reviewer',
      hand: '## UI review closed',
    },
  ],
  you: {
    step: '5 · merge',
    role: 'You',
    session: 'the one call that stays yours',
    line: 'Merge, or send it back',
    hand: 'landing-page merged',
  },
  counts: {
    awaiting: 'awaiting input',
    working: 'working',
    completed: 'completed',
  },
  pause: {
    pause: 'Pause',
    play: 'Play',
    pauseLabel: 'Pause the handoff',
    playLabel: 'Play the handoff',
  },
} as const

export const records = {
  // README.md: "Every session leaves a structured record"
  head: 'Every session leaves a structured record',
  // README.md: "Each plan, review, and handoff is a markdown file written to the same standard every time."
  lede: 'Each plan, review, and handoff is a markdown file written to the same standard every time.',
  // README.md: canon-allow-readme-paraphrase: the name of the chips that bring a record to the front, which no README sentence carries.
  pick: 'Bring a record to the front',
}

export const craft = {
  // README.md: "Skills that cite their sources"
  head: 'Skills that cite their sources',
  // README.md: "Each one teaches your agent an engineering practice, and every rule in it links to the guide it came from."
  lede: 'Each one teaches your agent an engineering practice, and every rule in it links to the guide it came from.',
  // README.md: canon-allow-readme-paraphrase: the labels around one skill's source and the rule it became, which the README's table folds into its columns.
  ruleIn: 'the rule, in',
  source: 'the source',
  becomes: 'becomes the rule',
  pick: 'Pick a practice skill',
  /** Where a rule's file opens on GitHub, its path appended. */
  repoBlob: `${REPO}/blob/main/`,
}

export const guardrails = {
  // README.md: "Rules your agent cannot ignore"
  head: 'Rules your agent cannot ignore',
  // README.md: "Each one is backed by a check that stops the work when it's broken."
  lede: "Each one is backed by a check that stops the work when it's broken.",
  /**
   * One stamp per README bullet in the order they fire: when it fires, the
   * real name it runs under, its verdict, and the action it caught.
   */
  // README.md: canon-allow-readme-paraphrase: each stamp restates its README bullet as one sentence beside page fiction drawn from the plan guard's real refusal and the seeded merge deny.
  parts: [
    {
      name: 'Rules by path',
      when: 'When a file opens',
      real: '.claude/rules/canon/ui/craft.md',
      verdict: 'Loaded',
      act: 'Read src/components/SaveButton.tsx',
      res: 'Loaded rule .claude/rules/canon/ui/craft.md',
      line: 'Opening a matching file loads the rule naming its skill.',
    },
    {
      name: 'Hooks',
      when: 'As each action runs',
      real: 'plan-guard.sh, standards-audit.sh',
      verdict: 'Blocked',
      act: 'Write .canon/plans/feature-export-json.md',
      res: 'PreToolUse:Write hook blocked the write',
      line: 'A hook checks each action as it runs, and refuses some.',
    },
    {
      name: 'The gate',
      when: 'Before a pull request',
      real: 'canon gate run',
      verdict: 'Failed',
      act: 'Bash canon gate run',
      res: 'Tests failed: src/cart/total.test.ts, 1 of 212',
      line: 'Every check runs before a pull request opens.',
    },
    {
      name: 'Deny rules',
      when: 'At the merge',
      real: 'Bash(gh pr merge:*)',
      verdict: 'Denied',
      act: 'Bash gh pr merge 412',
      res: 'Denied by a permission rule: Bash(gh pr merge:*)',
      line: 'A permission rule, not a hook, stops the agent merging.',
    },
  ],
}

export const worktrees = {
  // README.md: "Every feature gets its own worktree"
  head: 'Every feature gets its own worktree',
  // README.md: "So several agents can build at once without touching each other's files."
  lede: "So several agents can build at once without touching each other's files.",
  // README.md: canon-allow-readme-paraphrase: the band naming the shared folder, which the README states as the record in the main checkout. "the one `.canon/` record in the main checkout"
  band: {
    name: '.canon/',
    dirs: ['plans/', 'review/', 'tasks/'],
    shared: 'shared by every worktree',
  },
  main: 'main',
  writes: '→ writes',
}

/**
 * The film and the design board side by side: the reel's stills with the
 * checklist they prove, beside the board the page's own footer was picked on.
 */
export const evidence = {
  // README.md: "See the interface evidence before you merge"
  head: 'See the interface evidence before you merge',
  // README.md: "Every pull request comes with a short film of the new screen working in the app."
  lede: 'Every pull request comes with a short film of the new screen working in the app.',
  // README.md: canon-allow-readme-paraphrase: the labels around the reel's stills and the drive's board, which no README sentence carries.
  reel: (seconds: number) => `the reel on pull request #412 · ${seconds} s`,
  frame: (at: string) => `The reel at ${at}`,
  replay: 'Replay the reel',
  board: 'the board · footer-layout',
  question: 'Which footer should the page take?',
  arms: [
    { name: 'arm-0', alt: 'Footer arm 0: the mark and a line of links' },
    {
      name: 'arm-1 · picked',
      alt: 'Footer arm 1: the mark and tagline beside three link columns',
    },
    {
      name: 'arm-2',
      alt: 'Footer arm 2: a large wordmark over the link columns',
    },
  ],
  picked: 1,
  snapshot: "snapshots from the drive that picked this page's footer",
  /** One checklist line per beat `web/film-plan.json` films, in its order. */
  checks: [
    'The Task chip brings its sheet to the front',
    'The board sheet heads its running rows In flight',
    'The pull request comes up as a page in the browser',
    'The code review keeps its findings on the page',
    'The handoff fans the records either side of it',
  ],
  who: 'UI reviewer',
}

export const board = {
  // README.md: "Come back to finished pull requests"
  head: 'Come back to finished pull requests',
  // README.md: "Queue features on the task board before you leave. Canon builds and reviews them, and holds each merge for you."
  lede: 'Queue features on the task board before you leave. Canon builds and reviews them, and holds each merge for you.',
}

export const health = {
  // README.md: "Audits for code an agent wrote"
  head: 'Audits for code an agent wrote',
  // README.md: "They list the files and functions past a line limit, so you know what to split before it gets worse."
  lede: 'They list the files and functions past a line limit, so you know what to split before it gets worse.',
  /** The labels around the figures `web/src/lib/health.ts` reads at build time. */
  // README.md: canon-allow-readme-paraphrase: column heads and captions for the two reports, which no README sentence carries.
  view: {
    audit: '$ canon code audit',
    history: '$ canon history',
    cols: { file: 'File', fn: 'Function', lines: 'Lines' },
    longFiles: (count: number, limit: number) =>
      `${count} files past ${limit.toLocaleString('en-US')} lines`,
    dense: (count: number, cap: number) =>
      `${count} files past ${Math.round(cap * 100)}% comments`,
    read: (files: number) => `${files} files read`,
    caption: (to: string) => `Pull requests merged each week, to ${to}`,
    longest: 'the longest functions, against the',
    checkpoint: (lines: number) => `${lines}-line checkpoint`,
    past: (lines: number) => `, past the ${lines}-line checkpoint`,
    weeks: (from: string, to: string) => `merged, ${from} to ${to}`,
  },
}

/**
 * The unattended board, from the night's start to the state it rests on. Each
 * move lands one row in a lane, or changes its line in place, at its clock time.
 */
// README.md: canon-allow-readme-paraphrase: page fiction of an unattended run drawn from how the orchestrator really moves rows, which the README describes but never quotes.
export const boardScene = {
  title: 'Board',
  since: 'unattended since 23:00',
  start: '23:00',
  lanes: ['Up next', 'In flight', 'Ready to merge'],
  rows: [
    { name: 'gate-stages', lane: 0, line: 'plan linked' },
    { name: 'film-beats', lane: 0, line: 'needs a plan' },
    { name: 'take-timer', lane: 0, line: 'plan linked' },
    { name: 'sync-stamp', lane: 1, line: 'worker, slice 3 of 3' },
    { name: 'review-lift', lane: 1, line: 'worker, slice 2 of 2' },
    { name: 'sync-coverage', lane: 1, line: 'review, first pass' },
    { name: 'drive-check', lane: 1, line: 'review, second pass' },
  ],
  moves: [
    { at: '23:40', name: 'take-timer', lane: 1, line: 'worker, slice 1 of 3' },
    { at: '00:40', name: 'drive-check', lane: 2, line: 'review closed' },
    { at: '01:20', name: 'sync-stamp', lane: 1, line: 'review, second pass' },
    {
      at: '01:55',
      name: 'review-lift',
      lane: 1,
      line: 'one question for you',
      waiting: true,
    },
    { at: '02:10', name: 'sync-coverage', lane: 2, line: 'review closed' },
    { at: '02:14', name: 'take-timer', lane: 1, line: 'worker, slice 2 of 3' },
  ],
  /** Names the row that waits, since its edge alone carries the state. */
  waitingLabel: 'waits for you',
  stepOut: (at: string) => `${at} · you step out`,
  nightStarts: (at: string) => `${at} · the night starts`,
  moved: (at: string, name: string) => `${at} · ${name} moved`,
  comeBack: (at: string) => `${at} · what you come back to`,
  movesLabel: (count: number) => `${count} moves →`,
  before: 'The board when you step out',
  after: 'The board when you come back',
  replay: 'Replay the night',
}

/**
 * The footer's three link columns in order, the first listing `sections`
 * under its heading, then the base line under them.
 */
export const footer = {
  // README.md: canon-allow-readme-paraphrase: column headings for the footer's links, which no README sentence carries.
  heads: { page: 'On this page', read: 'Read', project: 'Project' },
  read: [
    { label: 'Docs', href: DOCS },
    {
      label: 'Skill map',
      href: `${REPO}/blob/main/docs/workflow/skill-map.md`,
    },
    // README.md: canon-allow-readme-paraphrase: the jump to the install section, which the README opens on.
    { label: 'Install', href: '#install' },
  ],
  project: [
    { label: 'GitHub', href: REPO },
    { label: 'npm', href: NPM },
    // README.md: "MIT license"
    { label: 'MIT licensed', href: `${REPO}/blob/main/LICENSE` },
  ],
  /** The base line's two ends: the license plainly, then the author and the host. */
  // README.md: "MIT license"
  base: ['MIT licensed', `${site.author} · ${site.label}`],
}

/**
 * Three worktrees branching off main together, each naming its folder, its
 * branch, where its session stands, and the shared folder that step writes.
 */
// README.md: canon-allow-readme-paraphrase: page fiction drawn from the worktree layout the README describes. "Each worker builds in its own worktree on its own branch"
export const worktreeCards = [
  {
    path: '.claude/worktrees/take-timer/',
    branch: 'feat/take-timer',
    line: 'Gate: 9 of 14 stages passed',
    dir: 'plans/',
  },
  {
    path: '.claude/worktrees/sync-stamp/',
    branch: 'feat/sync-stamp',
    line: 'Second pass on the added commits',
    dir: 'review/',
  },
  {
    path: '.claude/worktrees/toolbar/',
    branch: 'feat/toolbar',
    line: 'Box 3 sent back to the worker',
    dir: 'review/',
  },
]

/**
 * The three install commands with one copy control, beside the setup run in a
 * fresh project and the four stages a project goes through.
 */
export const install = {
  // README.md: "Install, then set up a project"
  head: 'Install, then set up a project',
  // README.md: "Three commands get you the plugin and the CLI. You need Bun, and Linux or macOS."
  lede: 'Three commands get you the plugin and the CLI. You need Bun, and Linux or macOS.',
  // README.md: "claude plugin marketplace add https://github.com/erclx/canon" "claude plugin install canon@canon" "bun install --global @erclx/canon"
  commands: [
    'claude plugin marketplace add https://github.com/erclx/canon',
    'claude plugin install canon@canon',
    'bun install --global @erclx/canon',
  ],
  // README.md: canon-allow-readme-paraphrase: the copy control's labels and the terminal's title, which no README sentence carries.
  copy: {
    label: 'Copy the three commands',
    done: 'Copied',
    status: 'Copied the three commands',
  },
  session: 'a fresh project',
  // README.md: canon-allow-readme-paraphrase: the README's first-run sentence, cut to the command and where it runs. "run `/canon:target-setup`"
  first: 'then run /canon:target-setup in a project',
  /** The setup the terminal runs: a line is its kind, a key, and its value, where `q` is a question it puts to you. */
  // README.md: canon-allow-readme-paraphrase: page fiction of a setup run, condensing what the README's first step says the skill does.
  run: {
    ask: '/canon:target-setup',
    rows: [
      ['k', 'Stack', 'bun, react'],
      [
        'k',
        'Lays down',
        'base tooling, the react stack, governance rules, the Claude seeds',
      ],
      ['q', 'Run it?', 'yes'],
      ['k', 'Verified', 'format, lint, types, tests'],
    ] as [string, string, string][],
  },
  /** The four stages, each saying when it runs, the skills set apart as code. */
  // README.md: canon-allow-readme-paraphrase: each stage condenses its README step to one line. "such as `bun init` or `npm create vite`" "writes nothing until you say yes" "catches the project up on your go-ahead"
  stages: [
    {
      name: 'Start',
      when: 'First',
      line: '`bun init`, `npm create vite`, or `target-scaffold` starts the project.',
    },
    {
      name: 'target-setup',
      when: 'Once per project',
      line: 'Shows what it will lay down, and writes nothing until you say yes.',
    },
    {
      name: 'target-check',
      when: 'Any time',
      line: 'Reports what the project lacks against the current release.',
    },
    {
      name: 'target-update',
      when: 'After each release',
      line: 'After a release, catches the project up on your go-ahead.',
    },
  ],
}
