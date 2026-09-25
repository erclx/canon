/**
 * Every string on the page, one module, each carrying a verbatim phrase from
 * `README.md` it derives from or a paraphrase marker saying why it cannot. A
 * phrase survives a line moving in `README.md`; only a change to the phrase
 * itself invalidates the citation, which `readmeCitations` in
 * `src/gate/measures.ts` checks against the current file.
 *
 * The page is one agent session read top to bottom, so most strings narrate
 * that session rather than restate the README. Those carry the paraphrase
 * marker, and where a string also borrows README wording the quote sits on the
 * same line so the gate still checks it. Counts never appear here: each one is
 * passed in from a build-time read in `web/src/lib/session.ts`.
 */

const REPO = 'https://github.com/erclx/canon'
const NPM = 'https://www.npmjs.com/package/@erclx/canon'

export const site = {
  name: 'canon',
  /**
   * The deployed origin, which a social card's absolute image URL is resolved
   * against and which `astro.config.mjs` reads as its own `site` value. It is
   * the address `.github/workflows/deploy-site.yml` publishes to rather than
   * anything `README.md` states, so it carries no citation.
   */
  origin: 'https://canon.erclx.dev',
  title: 'canon: watch it run',
  // README.md: canon-allow-readme-paraphrase: describes the page's own shape, which the README never states.
  description:
    'One real session, from the ask to the merge. What happened, and which part of canon caused it.',
  // README.md: canon-allow-readme-paraphrase: the plugin's slogan, stated in `.claude-plugin/marketplace.json`'s description rather than the README.
  tagline: "One source for your repos' AI conventions.",
  /** The copyright holder `LICENSE` names, which the social card signs with. */
  author: 'Eric Le',
}

export const skipLink = 'Skip to the session'

export const nav = {
  mark: 'canon',
  /** One entry per named beat of the session, in reading order. */
  links: [
    { id: 'ask', label: 'Ask' },
    { id: 'rules', label: 'Rules' },
    { id: 'plan', label: 'Plan' },
    { id: 'skills', label: 'Skills' },
    { id: 'workers', label: 'Workers' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'merge', label: 'Merge' },
  ],
  toggleLabel: 'Switch between light and dark',
  install: { label: 'Install', href: `${REPO}#install` },
  npm: NPM,
  version: {
    live: 'The published version on npm',
    unconfirmed: 'Not confirmed against the published version on npm',
  },
}

export const fold = {
  headline: ['Watch it run.', 'That is the documentation'],
  // README.md: canon-allow-readme-paraphrase: "canon is a CLI and Claude Code plugin that stops your AI conventions drifting apart across repositories" "runs on itself"
  lead: 'canon is a CLI and Claude Code plugin that stops your AI conventions drifting apart across repositories. Below is one real session it ran on itself.',
  primary: { label: 'Install canon', href: `${REPO}#install` },
  secondary: { label: 'Read the session', href: '#ask' },
  // README.md: canon-allow-readme-paraphrase: "Every AI coding setup accumulates the same assets" condensed to what a project holds before an install.
  before: {
    title: 'your project today',
    sub: 'whatever each repo happened to grow',
    rows: [
      { name: 'CLAUDE.md', state: 'hand written, if at all' },
      { name: '.claude/', state: 'not there' },
      { name: 'hooks', state: 'per repo, or none' },
    ],
  },
  // README.md: "canon init"
  command: 'canon init',
  // README.md: canon-allow-readme-paraphrase: "installs base tooling configs, Claude seeds, and governance rules in one pass" split into its three steps.
  after: {
    title: 'after one command',
    sub: 'in this order',
    tooling: {
      title: 'Base tooling',
      unit: 'files',
      detail: 'editorconfig, prettier, commitlint, husky hooks, CI',
    },
    seeds: {
      title: 'Claude workflow',
      unit: 'files',
      detail: 'CLAUDE.md, canon/ docs, .claude/ scaffold, hooks',
    },
    rules: {
      title: 'Governance',
      unit: 'rules',
      detail: '.claude/rules/canon/, from the stack you name',
    },
  },
  // README.md: canon-allow-readme-paraphrase: "some are never copied at all" "read by name with"
  never: {
    title: 'and two it never copies',
    skills: {
      name: 'agent skills',
      detail:
        'loaded live from the plugin, so a fix reaches every project at once',
    },
    standards: {
      name: 'standards',
      detail: 'read by name with canon standards, never a file to drift',
    },
  },
}

// README.md: canon-allow-readme-paraphrase: "this repo is the authoritative copy" "Your projects install and sync on demand"
export const proof =
  'One repository is the authoritative copy. Every other project installs it.'

/** A turn is something a participant said. Each carries who spoke and in what capacity. */
// README.md: canon-allow-readme-paraphrase: the four turns narrate the depicted session, which no README sentence describes.
export const turns = {
  ask: {
    who: 'operator',
    capacity: 'you',
    say: '“Add a light theme to the design tokens and ship it”',
    note: 'Nothing was configured for this ask.',
  },
  plan: {
    who: 'canon',
    capacity: 'plan',
    say: 'One plan, written once, and then the planner stops',
    note: 'The plan file is a planner’s only write, and it is decision-ready in one pass.',
  },
  evidence: {
    who: 'canon',
    capacity: 'review',
    say: 'Reviewing #1699 from a session that did not write it',
    note: 'The review attaches what the change actually looks like, as a comment on the pull request.',
  },
  merge: {
    who: 'canon',
    capacity: 'merge',
    say: 'Merged, with every step a fact rather than a claim',
    note: 'A tick is something a session says. A merge is something the trunk shows.',
  },
}

export const rules = {
  head: (matched: number, total: number) =>
    `${matched} of ${total} rules match this path`,
  // README.md: canon-allow-readme-paraphrase: "load into a Claude session when a matching path is edited"
  cap: 'A rule installs as a file the project owns, and it loads into a Claude session when a matching path is edited, and not before.',
  edited: 'edited',
  matched: 'matched',
  note: (unmatched: number, always: number) => ({
    unmatched: `${unmatched}`,
    unmatchedText: ' rules did not match it. ',
    always: `${always}`,
    alwaysText: ' carry no glob and load every session.',
  }),
}

// README.md: canon-allow-readme-paraphrase: "every command has a non-interactive path and a JSON catalog" restated as what a skill does with it.
export const skills = {
  head: (total: number) => `One skill loaded, out of ${total} in the catalog`,
  cap: 'Skills call the CLI and never reimplement it.',
  flow: {
    session: { who: 'session', what: 'loads one skill' },
    ask: {
      who: 'skill',
      what: 'asks what exists',
      how: 'canon gov list --json',
    },
    match: {
      who: 'skill',
      what: 'matches this project',
      how: 'no rule named in the body',
    },
    act: { who: 'CLI', what: 'does the work', how: 'canon gov sync' },
  },
  loaded: (total: number) => `1 of ${total}`,
  foot: 'The skill body names no rule, no stack and no snippet. It asks, matches, and delegates.',
}

// README.md: canon-allow-readme-paraphrase: the roles and their launches are what docs/workflow/operating-model.md covers, which the README only links.
export const dispatch = {
  head: 'One controller, and the sessions it launches',
  cap: 'Nothing here is one agent talking to itself. The controller holds the plan and launches a session per track.',
  controller: {
    who: 'orchestrator',
    what: 'holds no branch and writes no code',
    skill: 'canon:role-orchestrator',
  },
  roles: {
    planner: {
      what: 'writes the plan, then stops',
      skill: 'canon:role-planner',
    },
    worker: {
      what: 'one branch, one pull request',
      skill: 'canon:role-worker',
    },
  },
  foot: 'A dispatch is a separate process rather than a subagent, so each session is steerable, survives the one that launched it, and opens its own pull request.',
}

/**
 * The branch graph is authored against the depicted session rather than read,
 * since nothing on a build machine records which files four sessions held. The
 * footer says so, which is the label `canon/context/web/build.md` names as the
 * repair for an authored figure.
 */
// README.md: canon-allow-readme-paraphrase: "each in its own git worktree on its own branch, and each opens its own pull request"
export const workers = {
  head: 'Three workers and a planner, on disjoint file sets',
  cap: 'Each takes its own worktree, its own branch and its own pull request. No fixed number caps the tracks.',
  graphLabel:
    'One trunk, three branches off it, two merged back and one still open',
  trunk: 'main',
  branches: [
    {
      session: 'worker · tokens',
      short: 'tokens',
      files: 'src/design/',
      pullRequest: '#1699',
      state: 'merged',
    },
    {
      session: 'worker · stylesheet',
      short: 'stylesheet',
      files: 'web/src/styles/',
      pullRequest: '#1703',
      state: 'merged',
    },
    {
      session: 'worker · captures',
      short: 'captures',
      files: 'assets/captures/',
      pullRequest: '#1705',
      state: 'open',
    },
    {
      session: 'planner · readme',
      short: 'readme',
      files: '.canon/plans/',
      pullRequest: 'no branch',
      state: 'none',
    },
  ],
  stateLabel: {
    merged: 'merged',
    open: 'open',
    none: 'plan written, no branch',
  },
  foot: 'Four sessions, four worktrees. The file sets are disjoint, so none of them collided, and nothing caps the number of tracks.',
} as const

// README.md: canon-allow-readme-paraphrase: the quoted line is read from the rule itself at build time, and the rest narrates what it enforces.
export const gate = {
  head: 'No behavior reaches history ahead of its test',
  cap: 'What a worker does inside its own branch, before anything is shown to anyone.',
  cite: 'governance/rules/core/070-planning.md',
  citeNote: 'installed into every project that syncs governance',
  pair: [
    { what: 'the test', how: 'written first, and failing' },
    { what: 'the behavior', how: 'written until that test passes' },
  ],
  foot: {
    before: 'The order is enforced rather than advised. ',
    verb: 'canon gov test-order',
    after:
      ' reads the branch before it ships and names anything that reached history ahead of its test.',
  },
}

// README.md: canon-allow-readme-paraphrase: states the routing governance/rules/core/045-memory.md carries, which the build checks the rule still says.
export const memory = {
  head: 'What the session learned outlives the session',
  cap: 'The last thing a session does is decide what it learned and where that belongs.',
  skill: 'canon:memory-capture',
  when: 'runs at the close of a session, before anything is lost',
  input: 'a fact the session learned',
  routes: [
    {
      test: 'a domain owns it',
      where: 'canon/context/<domain>.md',
      what: 'Folded into the entry the three-tier model already loads on demand.',
    },
    {
      test: 'nothing owns it',
      where: '.canon/memory/',
      what: 'The pen keeps only what no context entry owns, which is what the rule calls the residue.',
    },
  ],
  foot: 'Routing is the point and the memory file is the fallback. A fact about a domain written to the pen instead lands in a folder nothing opens.',
}

/**
 * The capture pair is two fixed renders of one pull request, base against
 * head, by `canon design render` at one viewport and one crop. Both commits are
 * history, so nothing regenerates them, and the caption says how they were
 * made rather than implying a live read.
 */
// README.md: canon-allow-readme-paraphrase: narrates the review attachment, which no README sentence describes.
export const evidence = {
  verb: 'canon pr evidence',
  by: 'posted by git-pr, re-posted by git-followup',
  pullRequest: '#1699',
  captures: [
    {
      file: '/evidence/pr-1699/base.png',
      label: 'merge base',
      ref: '99ab3bd4',
      alt: 'The design token color table at the merge base',
    },
    {
      file: '/evidence/pr-1699/head.png',
      label: 'current head',
      ref: '78822c31',
      alt: 'The design token color table at the current head',
    },
  ],
  foot: {
    before: 'Rendered by ',
    verb: 'canon design render',
    after:
      ' from each side of the merge, at one viewport and one crop, so the only thing that differs is the tokens.',
  },
}

/** Authored against the depicted session, the same caveat the branch graph carries. */
// README.md: canon-allow-readme-paraphrase: the review exchange narrates the depicted session.
export const loop = {
  head: 'Reviewed by a session that did not write it',
  cap: 'Review is an exchange rather than a verdict, and it closes.',
  lanes: { reviewer: 'reviewer', worker: 'worker' },
  avatars: { reviewer: 'rv', worker: 'wk' },
  turns: [
    {
      who: 'reviewer',
      what: 'reads the branch it did not write',
      how: 'canon:review-pr',
    },
    {
      who: 'reviewer',
      what: 'posts findings on the pull request',
      how: 'canon pr evidence',
    },
    {
      who: 'worker',
      what: 'addresses them on its own branch',
      how: 'canon:review-address',
    },
    {
      who: 'reviewer',
      what: 'confirms, and the exchange closes',
      how: 'approved',
    },
  ],
  foot: 'A finding posted on the pull request outlives both sessions, which is what an orchestrator and a worker need when neither is still running at merge.',
} as const

// README.md: canon-allow-readme-paraphrase: narrates the post-merge hook, whose verbs are read from .husky/post-merge at build time.
export const merge = {
  hook: '.husky/post-merge',
  fires:
    'fires once, on the trunk, with the pull request number off the squash subject',
  /** What each verb does, keyed by the verb the hook has to run for the row to render. */
  effects: {
    'canon tasks archive':
      'the task closed by this pull request, and its plan with it',
    'canon records push': 'every gitignored record folder, off this disk',
    'canon worktrees reclaim': 'the worktree the merged branch was built in',
  } as Record<string, string>,
  foot: 'A tick is a claim a session makes. A merge is a fact the trunk shows, and only the second fires this.',
  // README.md: "a `DESIGN.md` token format" "and a render command"
  tokens: {
    title: 'The tokens that merge landed, as this page renders them',
    note: 'Rendered from canon/DESIGN.md by canon design render at build time, and embedded live rather than captured.',
    frameTitle: 'The design tokens this page renders from',
  },
}

/** One row per session, authored against the depicted session like the branch graph. */
// README.md: canon-allow-readme-paraphrase: the roster narrates the depicted session.
export const provenance = {
  head: 'Four sessions built it, one reviewed it',
  cap: 'No step was claimed by a session that did not run it.',
  roster: [
    {
      who: 'planner',
      made: 'one plan, and then it stopped',
      where: '.canon/plans/',
    },
    {
      who: 'worker · tokens',
      made: 'the derived palette anchors',
      where: '#1699, merged',
    },
    {
      who: 'worker · stylesheet',
      made: 'the regenerated stylesheet',
      where: '#1703, merged',
    },
    {
      who: 'worker · captures',
      made: 'the re-rendered captures',
      where: '#1705, still open',
    },
    {
      who: 'reviewer',
      made: 'findings on a branch it did not write',
      where: 'the pull request',
    },
  ],
}

export const install = {
  // README.md: canon-allow-readme-paraphrase: three steps the Install and Development sections spread across two headings.
  head: 'Three steps to put it in a project',
  cap: 'The CLI and the plugin install once per machine. The third step writes files your repository owns from then on.',
  steps: [
    {
      title: 'Install the CLI',
      // README.md: "Several skills call the `canon` CLI to read catalogs and run installs"
      body: 'Several skills call the canon CLI to read catalogs and run installs.',
      // README.md: "bun install --global @erclx/canon"
      commands: ['bun install --global @erclx/canon'],
    },
    {
      title: 'Add the plugin',
      // README.md: "Add the marketplace, then install the Claude Code plugin."
      body: 'Add the marketplace, then install the Claude Code plugin.',
      // README.md: "claude plugin marketplace add https://github.com/erclx/canon" "claude plugin install canon@canon"
      commands: [
        'claude plugin marketplace add https://github.com/erclx/canon',
        'claude plugin install canon@canon',
      ],
    },
    {
      title: 'Scaffold a project',
      // README.md: "installs base tooling configs, Claude seeds, and governance rules in one pass"
      body: 'canon init installs base tooling configs, Claude seeds, and governance rules in one pass.',
      // README.md: "canon init"
      commands: ['canon init'],
    },
  ],
}

/**
 * The lit names are authored against the depicted session. The build checks
 * each against the catalog it sits in, so a renamed command or skill fails the
 * build rather than lighting a name the field no longer lists.
 */
// README.md: canon-allow-readme-paraphrase: the field narrates what the depicted session used.
export const field = {
  head: 'Two surfaces, and that session reached into both',
  cap: 'The lit names are the ones it used. The rest was there and was not needed.',
  commands: (total: number, used: number) => ({
    total: `${total} commands`,
    used: `${used} used`,
  }),
  skills: (total: number, used: number) => ({
    total: `${total} skills`,
    used: `${used} used`,
  }),
  usedCommands: [
    'gov',
    'standards',
    'tooling',
    'claude',
    'tasks',
    'design',
    'teach',
    'records',
  ],
  usedSkills: [
    'plan-feature',
    'task-board',
    'session-worktree',
    'role-orchestrator',
    'role-worker',
    'review-pr',
    'git-pr',
    'git-followup',
    'memory-capture',
    'docs-fold',
  ],
}

export const close = {
  head: 'None of that was configured for that session',
  // README.md: canon-allow-readme-paraphrase: "copied into your project and become yours to edit" "some are never copied at all"
  lead: 'The rules and the tooling are copied into your project and become yours to edit. The skills and the standards are never copied at all, so a fix reaches every project at once and neither can drift.',
  primary: { label: 'Install canon', href: `${REPO}#install` },
  secondary: { label: 'Read the source', href: REPO },
}

export const footer = {
  // README.md: canon-allow-readme-paraphrase: condenses the opening paragraph's "keeps one authoritative copy and installs it into each project on demand"
  line: 'A CLI and a Claude Code plugin. One authoritative copy, installed into each project on demand.',
  columns: [
    {
      title: 'Reference',
      links: [
        { label: 'Docs', href: `${REPO}/tree/main/docs` },
        { label: 'Agent commands', href: `${REPO}/tree/main/docs/agents` },
        { label: 'Standards', href: `${REPO}/tree/main/standards` },
        { label: 'Wiki', href: `${REPO}/tree/main/wiki` },
      ],
    },
    {
      title: 'Surfaces',
      links: [
        { label: 'Skills', href: `${REPO}/tree/main/claude/skills` },
        {
          label: 'Governance rules',
          href: `${REPO}/tree/main/governance/rules`,
        },
        { label: 'Tooling stacks', href: `${REPO}/tree/main/tooling` },
        { label: 'Snippets', href: `${REPO}/tree/main/snippets` },
      ],
    },
    {
      title: 'Project',
      links: [
        { label: 'Source', href: REPO },
        { label: 'Releases', href: `${REPO}/releases` },
        { label: 'npm', href: NPM },
        { label: 'Issues', href: `${REPO}/issues` },
      ],
    },
  ],
  // README.md: "MIT"
  license: { label: 'MIT licensed', href: `${REPO}/blob/main/LICENSE` },
  // README.md: canon-allow-readme-paraphrase: states what the page is built from, which no README sentence says. The claim is checked by the page itself rather than borrowed.
  note: 'Every count on this page is read from the repository at build time. The branch graph, the review exchange and the session roster are drawn from the session they depict.',
}
