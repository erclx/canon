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
  // README.md: canon-allow-readme-paraphrase: the short variant of the README's opening sentence, which is also the `description` in `package.json` and both manifests, kept equal by `positioning.test.ts`.
  tagline:
    "Runs your agent's work and keeps its code good, on one setup for every repo.",
  /** The handle the social card signs with, rather than the copyright holder `LICENSE` names. */
  author: 'erclx',
}

export const skipLink = 'Skip to the page'

/** The two labels of the button on every looping window, naming what a press does next. */
// README.md: canon-allow-readme-paraphrase: a control's label, which no README sentence carries.
export const pause = {
  pause: 'Pause the animation',
  play: 'Play the animation',
}

/**
 * The page's sections in the order they run, which the nav, its menus, and the
 * in-view marker all read. Ten links do not fit the bar's one row at 1040, so
 * a section off the bar is listed in the Sections menu and the footer alone.
 */
export const sections = [
  // README.md: canon-allow-readme-paraphrase: one-word jump labels for the README's own section headings.
  { id: 'roles', label: 'Roles', bar: true },
  { id: 'records', label: 'Records', bar: true },
  { id: 'craft', label: 'Craft', bar: true },
  { id: 'guardrails', label: 'Guardrails', bar: true },
  { id: 'worktrees', label: 'Worktrees', bar: true },
  { id: 'film', label: 'Film', bar: false },
  { id: 'board', label: 'Board', bar: false },
  { id: 'drive', label: 'Drive', bar: false },
  { id: 'health', label: 'Audits', bar: false },
  { id: 'setup', label: 'Setup', bar: true },
] as const

export const nav = {
  mark: 'Canon',
  back: 'Canon, back to top',
  // README.md: canon-allow-readme-paraphrase: the jump to the install section, which the README opens on as Quick start.
  try: { href: '#try', label: 'Try it' },
  // README.md: "Docs"
  docs: { href: DOCS, label: 'Docs' },
  github: { href: REPO, label: 'GitHub' },
  /** The Sections menu below 1040, which on a phone carries Docs and GitHub too and reads Menu. */
  menu: { wide: 'Sections', phone: 'Menu' },
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
  // README.md: canon-allow-readme-paraphrase: the reason ahead of the opening sentence's subject, which the README opens on the claim alone. "Claude Code plugin and CLI that"
  lead: 'Coding agents work fast and remember nothing between sessions. Canon is a Claude Code plugin and CLI that gives each step of a change its own session and a written record the next one reads.',
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

export const roles = {
  // README.md: "Five roles, each in its own session"
  head: 'Five roles, each in its own session',
  // README.md: canon-allow-readme-paraphrase: the README's sentences with the name capitalized as the page writes it. "One long session loses the thread." "splits a change across a planner, a worker, and two reviewers, and you talk to the orchestrator that starts them."
  lede: 'One long session loses the thread. Canon splits a change across a planner, a worker, and two reviewers, and you talk to the orchestrator that starts them.',
}

export const records = {
  // README.md: "The record each step writes"
  head: 'The record each step writes',
  // README.md: "Pick up a change where the last session stopped. Each record has a fixed shape, so the next session knows where to read."
  lede: 'Pick up a change where the last session stopped. Each record has a fixed shape, so the next session knows where to read.',
  // README.md: canon-allow-readme-paraphrase: the name of the chips that bring a record to the front, which no README sentence carries.
  pick: 'Bring a record to the front',
}

export const craft = {
  // README.md: "Practice skills with cited sources"
  head: 'Practice skills with cited sources',
  // README.md: "Keep your agent from copying whatever code sits nearest. Each skill loads when its kind of work starts, and every rule names where it came from."
  lede: 'Keep your agent from copying whatever code sits nearest. Each skill loads when its kind of work starts, and every rule names where it came from.',
  // README.md: canon-allow-readme-paraphrase: the labels around one skill's source and the rule it became, which the README's table folds into its columns.
  ruleIn: 'the rule, in',
  source: 'the source',
  becomes: 'becomes the rule',
  pick: 'Pick a practice skill',
  /** Where a rule's file opens on GitHub, its path appended. */
  repoBlob: `${REPO}/blob/main/`,
}

export const guardrails = {
  // README.md: "Checks that catch a skipped step"
  head: 'Checks that catch a skipped step',
  // README.md: "An instruction can be ignored. These four parts fail the run when a step is skipped."
  lede: 'An instruction can be ignored. These four parts fail the run when a step is skipped.',
  /** One part per README bullet in the order they fire, each with when it fires and the real name it runs under. */
  // README.md: canon-allow-readme-paraphrase: each part restates its README bullet as one sentence beside the file or command it runs as.
  parts: [
    {
      name: 'Rules by path',
      when: 'When a file opens',
      play: 'Play rules by path in the window',
      line: 'Opening a matching file loads the rule naming its skill.',
      real: '.claude/rules/canon/ui/craft.md',
    },
    {
      name: 'Hooks',
      when: 'As each action runs',
      play: 'Play hooks in the window',
      line: 'A hook checks each action as it runs, and refuses some.',
      real: 'plan-guard.sh, standards-audit.sh',
    },
    {
      name: 'The gate',
      when: 'Before a pull request',
      play: 'Play the gate in the window',
      line: 'Every check runs before a pull request opens.',
      real: 'canon gate run',
    },
    {
      name: 'Deny rules',
      when: 'At the merge',
      play: 'Play deny rules in the window',
      line: 'A permission rule, not a hook, stops the agent merging.',
      real: 'Bash(gh pr merge:*)',
    },
  ],
}

export const worktrees = {
  // README.md: "One worktree for each change"
  head: 'One worktree for each change',
  // README.md: canon-allow-readme-paraphrase: the README's reason, then its sentence cut to the branch each change builds on and the one record they share. "Run several changes at once without one agent overwriting another." "on its own branch"
  lede: 'Run several changes at once without one agent overwriting another. Every change builds on its own branch, and all of them share one record.',
  // README.md: canon-allow-readme-paraphrase: the band naming the shared folder, which the README states as the record in the main checkout. "the one `.canon/` record in the main checkout"
  band: {
    name: '.canon/',
    dirs: ['plans/', 'review/', 'tasks/'],
    shared: 'shared by every worktree',
  },
  main: 'main',
  writes: '→ writes',
}

export const film = {
  // README.md: "A pull request arrives with a film of the change"
  head: 'A pull request arrives with a film of the change',
  // README.md: "A diff cannot show a hover or a focus ring. Canon films the change in the running app and posts the reel beside the checklist a reviewer ticks."
  lede: 'A diff cannot show a hover or a focus ring. Canon films the change in the running app and posts the reel beside the checklist a reviewer ticks.',
  /**
   * The evidence comment around the reel `web/film-plan.json` films from this
   * page's records section, one checklist line per beat in the plan's order.
   */
  // README.md: canon-allow-readme-paraphrase: the comment's labels and the checklist naming what each filmed beat shows, which no README sentence carries.
  view: {
    title: 'Evidence',
    source: 'pull request, the records section',
    alt: 'A reel of the records section: the Task sheet is picked, an outcome is ticked, and the rendered view keeps the tick',
    who: 'UI reviewer',
    checks: [
      'The Task sheet comes up on its pick',
      'A ticked outcome reads [x] in the source',
      'The rendered view keeps the tick',
    ],
  },
}

export const board = {
  // README.md: "The board runs while you are away"
  head: 'The board runs while you are away',
  // README.md: "Agent work stalls whenever you step out. The orchestrator works the ready rows from now or from a set time, and stops at what only you decide."
  lede: 'Agent work stalls whenever you step out. The orchestrator works the ready rows from now or from a set time, and stops at what only you decide.',
}

export const drive = {
  // README.md: "Design decided by looking"
  head: 'Design decided by looking',
  // README.md: "A description of a layout settles nothing. Canon drives the running app beside you and puts the options on a board for you to pick."
  lede: 'A description of a layout settles nothing. Canon drives the running app beside you and puts the options on a board for you to pick.',
}

export const health = {
  // README.md: "Audits that report where the code is rotting"
  head: 'Audits that report where the code is rotting',
  // README.md: "Generated code grows long files nobody reads. Canon measures file, function, and comment length, and charts what shipped each week."
  lede: 'Generated code grows long files nobody reads. Canon measures file, function, and comment length, and charts what shipped each week.',
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
}

/**
 * The board a drive put up for the page's own footer, which settled on the
 * columns option. Each option's bars sketch its layout as a grey box.
 */
// README.md: canon-allow-readme-paraphrase: the drive board the footer was picked on, drawn as grey boxes, which no README sentence carries.
export const driveScene = {
  title: 'Board',
  board: 'footer-layout',
  question: 'Which footer should the page take?',
  options: [
    { arm: 'arm-0', name: 'as it stands', bars: ['short'] },
    { arm: 'arm-1', name: 'columns', bars: ['short', 'long', 'long', 'mid'] },
    { arm: 'arm-2', name: 'wordmark', bars: ['short', 'mid', 'block'] },
  ],
  picked: 1,
  pickedLabel: 'picked',
}

export const setup = {
  // README.md: "Setting up a project"
  head: 'Setting up a project',
  // README.md: canon-allow-readme-paraphrase: the README's reason, then its three steps compressed into one sentence. "Every repository grows its own agent setup and lets it drift."
  lede: 'Every repository grows its own agent setup and lets it drift. An agent sets the project up, and the same skills keep it current.',
  /** The four stages along the rule, each saying when it runs, the three skills set apart as `skill`. */
  // README.md: canon-allow-readme-paraphrase: each stage condenses its README step to one line, with the scaffold skill named in Start since v179.8. "such as `bun init` or `npm create vite`" "writes nothing until you say yes" "catches the project up on your go-ahead"
  stages: [
    {
      name: 'Start',
      when: 'First',
      skill: false,
      line: '`bun init`, `npm create vite`, or `target-scaffold` starts the project.',
    },
    {
      name: 'target-setup',
      when: 'Once per project',
      skill: true,
      line: 'Shows what it will lay down, and writes nothing until you say yes.',
    },
    {
      name: 'target-check',
      when: 'Any time',
      skill: true,
      line: 'Reports what the project lacks against the current release.',
    },
    {
      name: 'target-update',
      when: 'After each release',
      skill: true,
      line: 'After a release, catches the project up on your go-ahead.',
    },
  ],
  session: 'A session in a fresh project',
  play: (name: string) => `Play ${name} in the session`,
}

export const tryIt = {
  // README.md: canon-allow-readme-paraphrase: the README's Quick start, headed for what the three commands do rather than how fast they run.
  head: 'Installing Canon',
  // README.md: canon-allow-readme-paraphrase: the README's sentence with the name capitalized as the page writes it. "expects someone who already knows Claude Code well. It runs on Linux and macOS, and the CLI needs Bun."
  lede: 'Canon expects someone who already knows Claude Code well. It runs on Linux and macOS, and the CLI needs Bun.',
  // README.md: "claude plugin marketplace add https://github.com/erclx/canon" "claude plugin install canon@canon" "bun install --global @erclx/canon"
  commands: [
    'claude plugin marketplace add https://github.com/erclx/canon',
    'claude plugin install canon@canon',
    'bun install --global @erclx/canon',
  ],
  copy: {
    label: 'Copy the three commands',
    tip: 'Copy',
    done: 'Copied',
    status: 'Copied the three commands',
  },
  // README.md: canon-allow-readme-paraphrase: the README's first-run sentence, cut to the command and where it runs. "run `/canon:target-setup`"
  first: 'Then run `/canon:target-setup` in a project.',
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
    // README.md: canon-allow-readme-paraphrase: the jump to the install section, which the README opens on as Quick start.
    { label: 'Install', href: '#try' },
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
 * The five roles beside the window, each with the scene the window plays for
 * it: the request it receives, what it did, and what it said back.
 */
// README.md: canon-allow-readme-paraphrase: each role's line condenses its README bullet, and each scene is page fiction drawn from how that role really reports.
export const roleScenes = [
  {
    name: 'Orchestrator',
    line: 'dispatches the rows',
    session: 'orchestrator-canon',
    prompt: 'dispatch the ready rows',
    act: [
      'Read the board, ran 3 shell commands',
      'Checked each row against what is in flight',
    ],
    say: [
      'Two rows are ready. relayed-answer-citation has its plan, so a worker takes it now.',
      'board-arm-expect has none, so a cold planner writes it first and I launch it when the plan lands.',
    ],
  },
  {
    name: 'Planner',
    line: 'writes one plan',
    session: 'planner-canon-board-arm-expect',
    prompt:
      '/canon:role-planner, then /canon:plan-feature board-arm-expect. Write one plan against the current tree and message the orchestrator when it lands.',
    act: [
      'Read 7 files, ran 4 shell commands',
      'Measured the row against main',
    ],
    say: [
      'Wrote the plan for board-arm-expect. Two questions, both with suggested answers.',
      'Launchable.',
    ],
  },
  {
    name: 'Worker',
    line: 'builds and opens the pull request',
    session: 'worker-canon-relayed-answer-citation',
    prompt:
      "/canon:auto-ship relayed-answer-citation's plan. Controller: the orchestrator. Message it when the pull request opens.",
    act: [
      'Edited 5 files in its own worktree, ran the check',
      'Committed 3 slices, each tested',
    ],
    say: [
      'Opened the pull request as a draft for relayed-answer-citation.',
      'Check passed, and evidence is posted.',
    ],
  },
  {
    name: 'Code reviewer',
    line: 'reads the diff',
    session: 'reviewer-canon-relayed-answer-citation',
    prompt:
      "/canon:role-reviewer, then /canon:review-pr on relayed-answer-citation. Read the plan's review focus first.",
    act: [
      'Read the diff and the plan, ran 2 shell commands',
      'Loaded review-craft',
    ],
    say: [
      '0 critical, 2 should-fix, 1 minor.',
      'Posted to the pull request and sent to the worker.',
    ],
  },
  {
    name: 'UI reviewer',
    line: 'drives the checklist',
    session: 'ui-reviewer-canon-relayed-answer-citation',
    prompt:
      '/canon:role-reviewer, then /canon:review-ui on relayed-answer-citation. One verdict per box, and skip any box marked as taste.',
    act: ['Drove 7 boxes in the running app', 'Loaded ui-craft'],
    say: [
      '6 of 7 boxes pass. One fails: the focus ring is clipped on mobile.',
      'Posted under UI review.',
    ],
  },
]

/**
 * One scene per part. A line is its kind, a lead, and its text, where `block`
 * is a refusal and `note` a line the harness reports back into the turn.
 */
// README.md: canon-allow-readme-paraphrase: page fiction drawn from the plan guard's real refusal and the seeded merge deny, which the README describes but never quotes.
export const guardrailScenes: {
  ask: string
  lines: [string, string, string][]
}[] = [
  {
    ask: 'add a disabled state to the save button',
    lines: [
      ['tool', 'Read', 'src/components/SaveButton.tsx'],
      ['res', '', 'Read 48 lines'],
      ['note', '', 'Loaded rule .claude/rules/canon/ui/craft.md'],
      ['tool', 'Skill', 'canon:ui-craft'],
      ['res', '', 'Loaded'],
    ],
  },
  {
    ask: 'plan the --json flag for the export command',
    lines: [
      ['tool', 'Write', '.canon/plans/feature-export-json.md'],
      [
        'block',
        'PreToolUse:Write hook blocked the write',
        'This session has not invoked canon:plan-feature, so .canon/plans/feature-export-json.md would be written outside the skill that owns its shape. Invoke the canon:plan-feature skill for this plan, then resend the write.',
      ],
      ['tool', 'Skill', 'canon:plan-feature'],
      ['res', '', 'Loaded'],
      ['tool', 'Write', '.canon/plans/feature-export-json.md'],
      ['res', '', 'Wrote 42 lines'],
    ],
  },
  {
    ask: 'open the pull request',
    lines: [
      ['tool', 'Bash', 'canon gate run'],
      ['block', 'Tests failed', 'src/cart/total.test.ts, 1 of 212'],
      ['tool', 'Update', 'src/cart/total.ts'],
      ['res', '', '1 addition, 1 removal'],
      ['tool', 'Bash', 'canon gate run'],
      ['res', '', 'Every stage passed'],
    ],
  },
  {
    ask: 'merge it',
    lines: [
      ['tool', 'Bash', 'gh pr merge 412'],
      ['block', 'Denied by a permission rule', 'Bash(gh pr merge:*)'],
      [
        'say',
        '',
        'The merge is yours. #412 is ready, and its review is closed.',
      ],
    ],
  },
]

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

/** How a repo comes onto canon: the session the setup window plays, one block per stage. */
// README.md: canon-allow-readme-paraphrase: page fiction of a setup session, each block condensing what its README step says the skill does.
export const setupSession: {
  ask: string
  shell: boolean
  rows: [string, string, string][]
}[] = [
  {
    ask: 'bun init',
    shell: true,
    rows: [
      ['f', '+', 'package.json'],
      ['f', '+', 'tsconfig.json'],
      ['f', '+', 'index.ts'],
    ],
  },
  {
    ask: '/canon:target-setup',
    shell: false,
    rows: [
      ['k', 'Stack', 'bun, react'],
      [
        'k',
        'Lays down',
        'base tooling, the react stack, governance rules, the Claude seeds',
      ],
      ['q', 'Run it?', 'yes'],
      ['k', 'Verified', 'format, lint, types, tests'],
    ],
  },
  {
    ask: '/canon:target-check',
    shell: false,
    rows: [
      ['k', 'Domains', 'tooling, governance, Claude, indexes'],
      ['k', 'Behind', 'nothing, every domain current'],
    ],
  },
  {
    ask: '/canon:target-update',
    shell: false,
    rows: [
      ['k', 'Release', 'the installed one to the latest'],
      ['q', 'Go ahead?', 'yes'],
      ['k', 'Done', 'one migration, synced, check clean'],
    ],
  },
]
