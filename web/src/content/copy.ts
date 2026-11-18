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

/** The page's sections in the order they run, which the nav, its menus, and the in-view marker all read. */
export const sections = [
  // README.md: canon-allow-readme-paraphrase: one-word jump labels for the README's own section headings.
  { id: 'roles', label: 'Roles' },
  { id: 'records', label: 'Records' },
  { id: 'craft', label: 'Craft' },
  { id: 'guardrails', label: 'Guardrails' },
  { id: 'worktrees', label: 'Worktrees' },
  { id: 'setup', label: 'Setup' },
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

export const roles = {
  // README.md: "Five roles, each in its own session"
  head: 'Five roles, each in its own session',
  // README.md: canon-allow-readme-paraphrase: the README's sentences with the name capitalized as the page writes it. "One long session loses the thread." "splits a change across a planner, a worker, and two reviewers, and you talk to the orchestrator that starts them."
  lede: 'One long session loses the thread. Canon splits a change across a planner, a worker, and two reviewers, and you talk to the orchestrator that starts them.',
}

export const records = {
  // README.md: "The record each step writes"
  head: 'The record each step writes',
  // README.md: "Each record has a fixed shape, so the next session knows where to read."
  lede: 'Each record has a fixed shape, so the next session knows where to read.',
  // README.md: canon-allow-readme-paraphrase: the skip link past the scroll-driven stack, which the README has no stack to need.
  skip: 'Skip past the records',
}

export const craft = {
  // README.md: "Practice skills with cited sources"
  head: 'Practice skills with cited sources',
  // README.md: "An agent copies whatever code sits nearest. Each skill loads when its kind of work starts, and every rule names where it came from."
  lede: 'An agent copies whatever code sits nearest. Each skill loads when its kind of work starts, and every rule names where it came from.',
  // README.md: canon-allow-readme-paraphrase: the pane labels beside one skill's rule and source, which the README's table folds into its columns.
  ruleIn: 'The rule, in',
  source: 'The source it cites',
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
  // README.md: canon-allow-readme-paraphrase: the README's reason, then its sentence cut to the branch each change builds on and the one record they share. "Agents working in one checkout overwrite each other." "on its own branch"
  lede: 'Agents working in one checkout overwrite each other. Every change builds on its own branch, and all of them share one record.',
  // README.md: canon-allow-readme-paraphrase: the band naming the shared folder, which the README states as the record in the main checkout. "the one `.canon/` record in the main checkout"
  band: {
    name: '.canon/',
    dirs: ['plans/', 'review/', 'tasks/'],
    shared: 'shared by every worktree',
  },
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

export const footer = {
  links: [
    { label: 'Docs', href: DOCS },
    {
      label: 'Skill map',
      href: `${REPO}/blob/main/docs/workflow/skill-map.md`,
    },
    { label: 'GitHub', href: REPO },
    { label: 'npm', href: NPM },
  ],
  // README.md: "MIT license"
  license: { label: 'MIT licensed', href: `${REPO}/blob/main/LICENSE` },
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
 * Three worktrees side by side. Each card steps through its status lines,
 * lighting the band folder the step writes, and rests on its second.
 */
// README.md: canon-allow-readme-paraphrase: page fiction drawn from the worktree layout the README describes. "Each worker builds in its own worktree on its own branch"
export const worktreeCards = [
  {
    path: '.claude/worktrees/take-timer/',
    branch: 'feat/take-timer',
    steps: [
      { line: 'Slice 2 of 4 committed', dir: 'plans/' },
      { line: 'Gate: 9 of 14 stages passed', dir: 'plans/' },
      { line: 'Pull request opened', dir: 'tasks/' },
    ],
  },
  {
    path: '.claude/worktrees/sync-stamp/',
    branch: 'feat/sync-stamp',
    steps: [
      { line: 'Reading the added commits', dir: 'review/' },
      { line: 'Second pass on the added commits', dir: 'review/' },
      { line: 'Two findings posted', dir: 'review/' },
    ],
  },
  {
    path: '.claude/worktrees/toolbar/',
    branch: 'feat/toolbar',
    steps: [
      { line: 'Starting the app from the branch', dir: 'review/' },
      { line: 'Driving the checklist in the running app', dir: 'review/' },
      { line: 'Box 3 sent back to the worker', dir: 'review/' },
    ],
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
