/**
 * Every string on the page outside the product views, one module, each
 * carrying a verbatim phrase from `README.md` it derives from or a paraphrase
 * marker saying why it cannot. A phrase survives a line moving in `README.md`;
 * only a change to the phrase itself invalidates the citation, which
 * `readmeCitations` in `src/gate/measures.ts` checks against the current file.
 *
 * The page runs in the README's own order, so most headings and ledes quote it
 * outright. What the product views show, being the sessions, the records, and
 * the craft rows, is page fiction drawn from real behavior and lives in its own
 * module beside its one consumer.
 *
 * A pair of backticks inside a string marks code, which the section setting
 * it renders as `<code>`.
 */

const REPO = 'https://github.com/erclx/canon'
const NPM = 'https://www.npmjs.com/package/@erclx/canon'
const DOCS = `${REPO}/tree/main/docs`

export const site = {
  name: 'canon',
  /**
   * The deployed origin, which a social card's absolute image URL is resolved
   * against and which `astro.config.mjs` reads as its own `site` value. It is
   * the address `.github/workflows/deploy-site.yml` publishes to rather than
   * anything `README.md` states, so it carries no citation.
   */
  origin: 'https://canon.erclx.com',
  // README.md: "runs agent work from plan to merge"
  title: 'canon runs agent work from plan to merge',
  // README.md: "A Claude Code plugin and CLI that runs agent work from plan to merge."
  description:
    'A Claude Code plugin and CLI that runs agent work from plan to merge.',
  // README.md: canon-allow-readme-paraphrase: the short variant of the README's opening sentence, which is also the `description` in `package.json` and both manifests, kept equal by `positioning.test.ts`.
  tagline:
    "Runs your agent's work and keeps its code good, on one setup for every repo.",
  /** The copyright holder `LICENSE` names, which the social card signs with. */
  author: 'Eric Le',
}

export const skipLink = 'Skip to the page'

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
  mark: 'canon',
  back: 'canon, back to top',
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
  parts: ['canon runs agent work from', 'plan to', 'merge'] as const,
  // README.md: canon-allow-readme-paraphrase: the product name ahead of the opening sentence's claim. "runs agent work from plan to merge"
  headline: 'canon runs agent work from plan to merge',
  // README.md: canon-allow-readme-paraphrase: the opening sentence's subject, carried on to who uses it and how each role runs, which the settled page states and the README spreads across its sections. "A Claude Code plugin and CLI that"
  lead: 'A Claude Code plugin and CLI that one developer uses to plan, build, review, and merge with coding agents, each role in its own session.',
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
  // README.md: "Who works"
  head: 'Who works',
  // README.md: "You talk to the orchestrator. It starts every other role in its own session and hears back from each."
  lede: 'You talk to the orchestrator. It starts every other role in its own session and hears back from each.',
}

export const records = {
  // README.md: "What each step leaves behind"
  head: 'What each step leaves behind',
  // README.md: "Every step writes a record in a fixed shape, and every change carries what it looks like."
  lede: 'Every step writes a record in a fixed shape, and every change carries what it looks like.',
  // README.md: canon-allow-readme-paraphrase: the skip link past the scroll-driven stack, which the README has no stack to need.
  skip: 'Skip past the records',
}

export const craft = {
  // README.md: "What good work looks like"
  head: 'What good work looks like',
  // README.md: "The practice an agent follows lives in skills, and every rule in them traces to a published source."
  lede: 'The practice an agent follows lives in skills, and every rule in them traces to a published source.',
  // README.md: canon-allow-readme-paraphrase: the README's ledger sentence, opened on Every rather than Each. "has its own source row in a ledger, and the skill audit fails when a skill's rules and its rows disagree in count."
  note: "Every rule has its own source row in a ledger, and the skill audit fails when a skill's rules and its rows disagree in count.",
  // README.md: canon-allow-readme-paraphrase: the pane labels beside one skill's rule and source, which the README's table folds into its columns.
  ruleIn: 'The rule, in',
  source: 'The source it cites',
}

export const guardrails = {
  // README.md: "What holds it"
  head: 'What holds it',
  // README.md: "A skill says what good looks like. These four parts catch the agent when it skips one."
  lede: 'A skill says what good looks like. These four parts catch the agent when it skips one.',
  /** One part per README bullet, each with the real name it runs under. */
  // README.md: canon-allow-readme-paraphrase: each part restates its README bullet as two sentences beside the file or command it runs as.
  parts: [
    {
      name: 'Rules by path',
      play: 'Play rules by path in the window',
      line: 'A rule file loads when the agent opens a matching path, and names the skill that owns that kind of file.',
      real: '.claude/rules/canon/ui/craft.md',
    },
    {
      name: 'Hooks',
      play: 'Play hooks in the window',
      line: 'A hook reads each action before or after it runs. It refuses some and reports others back into the same turn.',
      real: 'plan-guard.sh, standards-audit.sh',
    },
    {
      name: 'The gate',
      play: 'Play the gate in the window',
      line: 'Every stage runs in order before a pull request opens, and a stage that cannot read its input fails under CI rather than passing.',
      real: 'canon gate run',
    },
    {
      name: 'Deny rules',
      play: 'Play deny rules in the window',
      line: 'The agent cannot merge. A hook fails open on a timeout, so the merge block is a permission rule rather than a hook.',
      real: 'Bash(gh pr merge:*)',
    },
  ],
}

export const worktrees = {
  // README.md: "Where it happens"
  head: 'Where it happens',
  // README.md: canon-allow-readme-paraphrase: the README's sentence, closed on the shared record rather than the main checkout the line under the graph names. "Changes run side by side. Each worker builds in its own worktree on its own branch"
  lede: 'Changes run side by side. Each worker builds in its own worktree on its own branch, and every one of them reads and writes one shared record.',
  // README.md: canon-allow-readme-paraphrase: the band naming the shared folder, which the README states as the record in the main checkout. "the one `.canon/` record in the main checkout"
  band: {
    name: '.canon/',
    dirs: 'plans/ · review/ · tasks/',
    shared: 'shared by every worktree',
  },
  // README.md: canon-allow-readme-paraphrase: the README's closing clause, spelled out for the folders the band names. "so no worktree keeps a copy of its own"
  under:
    "Plans, reviews, and tasks live once, in the main checkout's .canon/, so a worktree never keeps its own copy and every session reads the same board.",
  now: 'now',
  main: 'main',
}

export const setup = {
  // README.md: "How a repo comes onto canon"
  head: 'How a repo comes onto canon',
  // README.md: canon-allow-readme-paraphrase: the README's opening and its three steps, compressed into the section's two-sentence lede. "The project starts with its stack's own tool"
  lede: "The project starts with its stack's own tool. An agent brings it onto canon, and the same skills keep it current after every release.",
  /** The four stages along the rule, the three skills set apart as `skill`. */
  // README.md: canon-allow-readme-paraphrase: each stage condenses its README step, with the scaffold skill named in Start since v179.8. "or with `/canon:target-scaffold` in an empty folder" "writes nothing until you say yes. Then it runs `canon init`, checks what landed, and indexes the docs." "reports, domain by domain, what the project holds against what canon now ships, and repairs nothing."
  stages: [
    {
      name: 'Start',
      skill: false,
      line: "`bun init` or `npm create vite` starts the project, or `target-scaffold` runs the stack's starter in an empty folder.",
    },
    {
      name: 'target-setup',
      skill: true,
      line: 'Detects the stack, shows the whole chain, and writes nothing until you say yes. Then it runs `canon init`, checks what landed, and indexes the docs.',
    },
    {
      name: 'target-check',
      skill: true,
      line: 'Reports, domain by domain, what the project holds against what canon now ships, and repairs nothing.',
    },
    {
      name: 'target-update',
      skill: true,
      line: 'After a release, upgrades the CLI and plugin, previews the changelog, migrations, and drift, and on your go-ahead catches the project up.',
    },
  ],
  session: 'A session in a fresh project',
  // README.md: canon-allow-readme-paraphrase: the README's three kinds of file, each as a heading and its line. "Skills load live from the plugin, so there is no copy to drift" "Configs and seeds are real files you own"
  lands: {
    cap: 'What lands in the project',
    items: [
      {
        name: 'Skills',
        line: 'Load live from the plugin, so there is no copy to drift.',
      },
      {
        name: 'Rules',
        line: 'Files under `.claude/rules/` that load when a matching path is edited.',
      },
      { name: 'Configs and seeds', line: 'Real files the project owns.' },
    ],
  },
  play: (name: string) => `Play ${name} in the session`,
}

export const tryIt = {
  // README.md: canon-allow-readme-paraphrase: the README's Quick start, headed for a reader trying it rather than starting quickly.
  head: 'Trying it',
  // README.md: "canon expects someone who already knows Claude Code well. It runs on Linux and macOS, and the CLI needs Bun."
  lede: 'canon expects someone who already knows Claude Code well. It runs on Linux and macOS, and the CLI needs Bun.',
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
  // README.md: canon-allow-readme-paraphrase: the README's first-run sentence, carried on to what the skill does before it writes. "Then open a project in Claude Code and run `/canon:target-setup`"
  first: {
    lead: 'Then open a project in Claude Code and run `/canon:target-setup`. It reads the stack, shows what it will lay down, and writes nothing until you say yes. The',
    guide: {
      label: 'workflow guide',
      href: `${REPO}/blob/main/docs/workflow/ai-workflow.md`,
    },
    tail: 'takes it from there.',
  },
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
 * What holds it: one scene per part, each a request and the lines the window
 * shows. A line is its kind, a lead, and its text, where `block` is a refusal
 * and `note` a line the harness reports back into the turn.
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
 * Where it happens: three live branches forking off main at different moments
 * and running up to the now line, the oldest on the top lane, and one earlier
 * branch drawn merged back under the youngest. Positions are fractions of the
 * graph's width.
 */
// README.md: canon-allow-readme-paraphrase: page fiction drawn from the worktree layout the README describes, with session names in the roster's form.
export const worktreeBranches = {
  now: 0.92,
  lanes: [
    {
      branch: 'feat/take-timer',
      session: 'worker-canon-take-timer',
      line: 'Gate: 9 of 14 stages passed',
      fork: 0.22,
      commits: [0.36, 0.52, 0.7],
    },
    {
      branch: 'feat/sync-stamp',
      session: 'reviewer-canon-sync-stamp',
      line: 'Second pass on the added commits',
      fork: 0.4,
      commits: [0.55, 0.74],
    },
    {
      branch: 'feat/toolbar',
      session: 'ui-reviewer-canon-toolbar',
      line: 'Driving the checklist in the running app',
      fork: 0.62,
      commits: [0.78],
    },
  ],
  merged: {
    label: 'feat/relay-citation, merged',
    fork: 0.02,
    merge: 0.16,
    commits: [0.07, 0.11],
  },
}

/** How a repo comes onto canon: the session the setup window plays, one block per stage. */
// README.md: canon-allow-readme-paraphrase: page fiction of a setup session, each block condensing what its README step says the skill does.
export const setupSession: {
  ask: string
  shell: boolean
  rows: [string, string, string][]
}[] = [
  { ask: 'bun init', shell: true, rows: [] },
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
