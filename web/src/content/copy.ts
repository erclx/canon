/**
 * Every string on the page that is not quoted from the change it follows, one
 * module, each carrying a verbatim phrase from `README.md` it derives from or
 * a paraphrase marker saying why it cannot. A phrase survives a line moving in
 * `README.md`; only a change to the phrase itself invalidates the citation,
 * which `readmeCitations` in `src/gate/measures.ts` checks against the current
 * file.
 *
 * The six steps narrate erclx/canon#2418 rather than restate the README, so
 * their strings carry the paraphrase marker. What each step's figure quotes
 * from that change's record lives in `trail.ts`, which cites the record
 * rather than the README.
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
  origin: 'https://canon.erclx.dev',
  // README.md: "runs your agent's work from plan to merge"
  title: "canon runs your agent's work from plan to merge",
  // README.md: canon-allow-readme-paraphrase: names the change the page follows, which the README never states. "established engineering practice"
  description:
    'One real change, followed from its groundwork to its merge, run by canon and held to established engineering practice.',
  // README.md: canon-allow-readme-paraphrase: the short variant of the README's opening sentence, which is also the `description` in `package.json` and both manifests, kept equal by `positioning.test.ts`.
  tagline:
    "Runs your agent's work and keeps its code good, on one setup for every repo.",
  /** The copyright holder `LICENSE` names, which the social card signs with. */
  author: 'Eric Le',
}

export const skipLink = 'Skip to the change'

export const nav = {
  mark: 'canon',
  /** The page's one in-page anchor, then the two places a reader goes next. */
  links: [
    { href: '#how', label: 'How it runs' },
    { href: DOCS, label: 'Docs' },
    { href: REPO, label: 'GitHub' },
  ],
  toggleLabel: 'Switch between light and dark',
  install: { label: 'Install', href: '#start' },
}

export const fold = {
  // README.md: canon-allow-readme-paraphrase: the product name ahead of the opening sentence's first claim. "runs your agent's work from plan to merge"
  headline: "canon runs your agent's work from plan to merge",
  // README.md: canon-allow-readme-paraphrase: the opening sentence with its first claim lifted into the headline. "A CLI and Claude Code plugin that" "established engineering practice, and installs the same setup in every repo."
  lead: 'A CLI and Claude Code plugin that holds the work to established engineering practice, and installs the same setup in every repo.',
  // README.md: "claude plugin marketplace add https://github.com/erclx/canon" "claude plugin install canon@canon"
  commands: [
    'claude plugin marketplace add https://github.com/erclx/canon',
    'claude plugin install canon@canon',
  ],
  primary: { label: 'Install canon', href: '#start' },
  secondary: { label: 'Follow the change', href: '#how' },
  film: {
    // README.md: "One change running through canon, from the groundwork that measured it through its plan, dispatch, build, and review to the merge"
    label:
      'One change running through canon, from the groundwork that measured it through its plan, dispatch, build, and review to the merge',
    /** The poster's action, with the length read off the rendered film. */
    play: (seconds: number) => `Play the film · ${Math.round(seconds)} s`,
    /** A toggle's label stays fixed while `aria-pressed` carries its state, per the WAI-ARIA button pattern. */
    pause: 'Pause the film',
  },
}

// README.md: canon-allow-readme-paraphrase: introduces the change the six steps follow, which the README does not name.
export const bridge =
  'The film follows one real change, from the question that started it to its merge as erclx/canon#2418. Here is each step, with what it left behind.'

/** One heading and one line per step, in the order the change ran them. */
// README.md: canon-allow-readme-paraphrase: the six steps narrate erclx/canon#2418, which no README sentence describes.
export const steps = {
  groundwork: {
    kicker: 'groundwork',
    head: 'Measured before anyone plans it',
    line: 'Context had grown from 16,109 words to 218,865. The track searched, measured, and spiked before it decided anything.',
  },
  plan: {
    kicker: 'plan',
    head: 'One plan, every question already answered',
    line: 'The plan names the files it touches and the test that proves them. Each open question carries a suggested answer, so a blank reply still moves.',
  },
  dispatch: {
    kicker: 'dispatch',
    head: 'You talk to one session, and it launches the rest',
    line: 'An orchestrator places each plan on the board and starts a worker per change, each in its own worktree.',
  },
  build: {
    kicker: 'build',
    head: 'Each worker in its own worktree, held to the rules',
    line: 'Rules load on the path being edited, and the gate runs every stage before the pull request opens.',
  },
  review: {
    kicker: 'review',
    head: 'A fresh session reviews, until nothing is open',
    line: 'A session that did not write the change reads it against the plan. The worker fixes what it finds, and the review closes only when nothing is left.',
  },
  merge: {
    kicker: 'merge',
    head: 'You merge, and the next wave starts',
    line: 'The task archives with its plan, and the board moves to the next row.',
  },
}

export const start = {
  // README.md: "Quick start"
  head: 'Quick start',
  // README.md: "The skills land as `/canon:<name>`, and the CLI needs Bun on your path. canon runs on Linux and macOS."
  setup:
    'The skills land as /canon:<name>, and the CLI needs Bun on your path. canon runs on Linux and macOS.',
  // README.md: "Set up a repository with `canon init`, which lays down its rules, seeds, and configs."
  init: 'Set up a repository with canon init, which lays down its rules, seeds, and configs.',
  // README.md: "claude plugin marketplace add https://github.com/erclx/canon" "claude plugin install canon@canon" "bun install --global @erclx/canon"
  commands: [
    'claude plugin marketplace add https://github.com/erclx/canon',
    'claude plugin install canon@canon',
    'bun install --global @erclx/canon',
  ],
  primary: { label: 'Install canon', href: `${REPO}#quick-start` },
  // README.md: "Docs"
  secondary: { label: 'Read the docs', href: DOCS },
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
  // README.md: canon-allow-readme-paraphrase: states where the page's figures come from, which no README sentence says.
  note: 'Every line and number in the six steps is taken from the record of erclx/canon#2418 and the groundwork before it, dated where it was measured.',
}
