/**
 * The component layer, beside the token layer in `@/design/tokens`.
 *
 * A token says what a value is and a component says what a repeated piece of
 * interface is made of. The two repairs that produced this layer are both cases
 * where the tokens were already right and the surface still read as unrelated
 * to itself, so a token file alone would not have caught either.
 *
 * It held at a third real instance: teach's recovered chrome. That instance
 * did not join `COMPONENTS` itself, since teach is the only consumer and
 * folding a masthead, a quiz, and a glossary into the generic default would
 * ship them into every project that installs the `design` domain and never
 * asked for teach. It reads instead as `TEACH_COMPONENTS`, a sibling array a
 * caller opts into by passing an explicit component list to
 * `buildDesignCss`'s `components` option, which is what widening that option
 * from a boolean to `boolean | readonly Component[]` bought.
 *
 * It does not live in `canon/DESIGN.md`. `standards/design.md` keeps CSS class
 * names out of that record and says they live in code, which is here.
 */

export interface Component {
  readonly name: string
  /** Why the component exists, carried into the emitted stylesheet as a comment. */
  readonly note: string
  /** Custom properties this component reads, so a consumer can check it has them. */
  readonly reads: readonly string[]
  readonly rules: string
}

/**
 * A dot and a word, never a bordered chip. The jump menus already said written
 * and planned with a filled or hollow dot, so a status badge that spelled the
 * same fact in uppercase inside a border was a second vocabulary for something
 * the system already had one of.
 */
const STATUS: Component = {
  name: 'status',
  note: [
    'A dot and a word, not a pill. A bordered uppercase chip is a second',
    'vocabulary for a fact the dot already carries, so the marker is the only',
    'status shape and `.is-done` is the only variant.',
  ].join('\n   '),
  reads: [
    '--color-border',
    '--color-accent',
    '--color-muted',
    '--radius-marker',
  ],
  rules: `.status {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: var(--color-muted);
  white-space: nowrap;
}

.status::before {
  content: '';
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: var(--radius-marker);
  background: var(--color-border);
}

.status.is-done::before {
  background: var(--color-accent);
}`,
}

/**
 * Every scrolling region, the page included. Scoping this to one component is
 * what left an outline rail, code blocks, and scrolling tables on the browser
 * default beside a styled sibling, which reads as two designs on one page.
 */
const SCROLLBAR: Component = {
  name: 'scrollbar',
  note: [
    'Every scrolling region takes the same bar, the page included. Scoping it',
    'to one component leaves its neighbors on the browser default, which is',
    'what reads as two designs on one page. `scrollbar-color` covers Firefox',
    'and the `::-webkit-` rules cover the rest, both from the same two tokens',
    'so the two engines cannot drift apart.',
  ].join('\n   '),
  reads: ['--color-border', '--color-muted', '--color-background'],
  rules: `* {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  border-radius: var(--radius-marker);
  background: var(--color-border);
  /* Inset by painting a border in the page color, which is what keeps the
     thumb off the edges without a second element. */
  border: 3px solid var(--color-background);
}

*::-webkit-scrollbar-thumb:hover {
  background: var(--color-muted);
}

*::-webkit-scrollbar-corner {
  background: transparent;
}`,
}

/**
 * The hand-drawn SVG diagram figure and its caption, sized wider than the
 * reading measure and cleared past an outline rail on a wide viewport.
 * Promoted out of `TEACH_COMPONENTS` per
 * `.canon/groundwork/86-portable-hand-drawn-figures/06-decision.md` item 4:
 * any project can draw one hand-drawn-styled figure without teach's own quiz
 * and schedule machinery. It could not move as `TEACH_FIGURES` as-is, since
 * that component's `reads` list named `--teach-hand` and `--teach-wide`
 * while only `TEACH_CHROME` declared them, so this component declares its
 * own `--figure-hand` and `--figure-wide` defaults rather than borrowing
 * undeclared custom properties from a teach-only sibling.
 */
const HAND_DRAWN_FIGURE: Component = {
  name: 'hand-drawn-figure',
  note: [
    'The hand-drawn SVG diagram figure and its caption, sized wider than the',
    'reading measure and cleared past an outline rail on a wide viewport.',
  ].join('\n   '),
  reads: ['--color-muted', '--figure-hand', '--figure-wide'],
  rules: `/* ---- Figures: hand-drawn, and wider than the measure ---- */

:root {
  --figure-hand: 'Virgil', 'Excalifont', cursive;
  --figure-wide: 64rem;
}

figure {
  margin: 2.75rem 0;
  width: var(--figure-wide);
  max-width: 92vw;
  margin-left: 50%;
  transform: translateX(-50%);
}

figure svg {
  width: 100%;
  height: auto;
  display: block;
}

/* CSS beats an SVG presentation attribute, so the diagrams pick up the
   hand face without editing a single lesson. */
figure svg text {
  font-family: var(--figure-hand);
}

figcaption {
  font-family: var(--figure-hand);
  font-size: 1rem;
  color: var(--color-muted);
  margin: 1rem auto 0;
  line-height: 1.5;
  max-width: 52rem;
}

/* A figure breaks the measure and must still clear an outline rail. Deriving
   the ceiling from the viewport does not hold, since a rail positioned from
   the centre keeps overlapping as the window widens, so the ceiling is fixed
   instead. */
@media (min-width: 1421px) {
  figure {
    max-width: 54rem;
  }
}

@media (max-width: 640px) {
  figure {
    width: 100%;
    max-width: 100%;
    margin-left: 0;
    transform: none;
  }
}`,
}

export const COMPONENTS: readonly Component[] = [
  STATUS,
  SCROLLBAR,
  HAND_DRAWN_FIGURE,
]

const TEACH_CHROME: Component = {
  name: 'teach-chrome',
  note: [
    'The masthead, breadcrumb, jump menu, theme toggle, progress track, and footer',
    'navigation shared by every teach page. Recovered from two gitignored',
    'course.css files that predate a regression that dropped this layer from the',
    "generator, and rewritten onto this module's tokens rather than the",
    'incompatible palette they carried. See canon/wireframes/teach/chrome.md for',
    'the shape.',
  ].join('\n   '),
  reads: [
    '--color-background',
    '--color-surface',
    '--color-border',
    '--color-text',
    '--color-text-body',
    '--color-text-secondary',
    '--color-muted',
    '--color-accent',
    '--teach-sans',
    '--teach-mono',
    '--teach-measure',
    '--teach-chrome',
    '--teach-shadow',
    '--color-teach-accent-bg',
    '--type-body-family',
    '--type-code-family',
    '--t3',
    '--t4',
    '--t5',
  ],
  rules: `:root {
  --teach-sans: var(--type-body-family);
  --teach-hand: 'Virgil', 'Excalifont', cursive;
  --teach-mono: var(--type-code-family);
  --teach-measure: 52rem;
  --teach-chrome: 52rem;
  --teach-mast-h: 4.4rem;
  --teach-shadow: 0 1px 2px rgba(20, 20, 20, 0.04);
  --color-teach-accent-bg: color-mix(in srgb, var(--color-accent) 14%, var(--color-background));

  /* Aliases for the retired teach palette. Every already-written lesson draws
     its hand-authored diagrams with fill and stroke values pinned to these
     names directly in the SVG markup, which this rewrite cannot reach without
     editing lesson content the same pass that recovered the chrome was asked
     not to touch. */
  --panel: var(--color-surface);
  --rule: var(--color-border);
  --ink: var(--color-text-body);
  --ink-soft: var(--color-text-secondary);
  --ink-faint: var(--color-muted);
  --accent: var(--color-accent);
  --accent-bg: var(--color-teach-accent-bg);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --teach-shadow: none;
  }
}

:root[data-theme='dark'] {
  --teach-shadow: none;
}

/* No horizontal padding on the body, so the sticky bar reaches both window
   edges. The gutter moves onto \`main\`, which is the only thing that needed it. */
body {
  margin: 0;
  padding: 0 0 7rem;
  background: var(--color-background);
  color: var(--color-text-body);
  font-family: var(--teach-sans);
  font-size: var(--t3);
  line-height: 1.62;
  -webkit-font-smoothing: antialiased;
}

/* The bar row and the text column resolve to the same 52rem content box, so a
   listing page and a lesson start at the same left edge as the chrome above
   them. A narrower \`.wide-body\` was what put the navigation and the content on
   two different measures. */
main { max-width: calc(var(--teach-measure) + 3rem); margin: 0 auto; padding: 2.25rem 1.5rem 0; }
.wide-body { max-width: calc(var(--teach-measure) + 3rem); }

.bar {
  position: sticky;
  top: 0;
  z-index: 30;
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  padding: 0 1.5rem;
}

.mast {
  max-width: var(--teach-chrome);
  margin: 0 auto;
  padding: 0.8rem 0 0.7rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  font-size: var(--t5);
  color: var(--color-muted);
}

.mast a { color: var(--color-accent); text-decoration: none; font-weight: 600; }
.mast a:hover { text-decoration: underline; }

.theme {
  font-family: var(--teach-sans);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-muted);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 99px;
  padding: 0.25rem 0.7rem;
  cursor: pointer;
}

.theme:hover { border-color: var(--color-accent); color: var(--color-accent); }

.nav {
  width: 100%;
  margin: 0;
  display: flex;
  gap: 0.6rem;
}

.nav > a, .nav > span {
  flex: 1;
  padding: 0.65rem 0.95rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  text-decoration: none;
  color: var(--color-text-body);
  font-size: var(--t4);
  font-weight: 600;
  line-height: 1.3;
  box-shadow: var(--teach-shadow);
  transition: border-color 0.12s, background 0.12s;
}

.nav > a:hover { border-color: var(--color-accent); background: var(--color-teach-accent-bg); }
.nav > .end { color: var(--color-muted); border-style: dashed; font-weight: 400; box-shadow: none; }

.nav .lbl {
  display: block;
  font-size: 0.6563rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin-bottom: 0.15rem;
}

.nav > a:hover .lbl { color: var(--color-accent); }
.nav .to-next { text-align: right; }
.nav .to-index { flex: 0 0 auto; text-align: center; }
.nav-foot { margin: 4.5rem 0 0; }

/* ---- Masthead contents ---- */

/* Sticky position and stacking both live on \`.bar\` now, so nothing here
   restates either. */
/* A breadcrumb rather than a row of links. The gap tightens because the
   separators now carry the spacing the gap used to. */
.mast-left { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }

/* \`--rule\` measured 1.27:1 here. It is a border token, and a border is a
   shape a reader infers rather than a glyph they resolve, so it is the wrong
   value for a character even a decorative one. */
.crumb-sep {
  color: var(--color-muted);
  font-size: var(--t4);
  user-select: none;
}

/* One arrow, on the first segment, since that is the only one that goes up. */
.crumb-back {
  margin-right: 0.3rem;
  font-size: var(--t4);
  line-height: 1;
}

.crumb { display: inline-flex; align-items: center; }

/* The label and its caret are one segment visually and two controls in fact:
   the label navigates, the caret opens the menu. */
.crumb-item { display: inline-flex; align-items: center; gap: 0.1rem; }

.crumb-here { color: var(--color-text); font-weight: 600; }

/* The caret is now the whole control, so it carries the 24 pixel minimum on
   its own rather than inheriting a label's width. */
.crumb-item > .jump > summary {
  min-width: 1.5rem;
  min-height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
}

.crumb-item > .jump > summary:hover { background: var(--color-surface); border-radius: 5px; }

/* A bar link is its own tap target rather than a line of text, so it carries
   the 24 pixel minimum the a11y rule sets. */
.mast a,
.mast summary {
  min-height: 1.6rem;
  display: inline-flex;
  align-items: center;
}

.mast .pos {
  font-family: var(--teach-mono);
  font-size: 0.75rem;
  color: var(--color-muted);
}

.mast-right { display: flex; align-items: center; gap: 0.85rem; }

.theme {
  width: 1.9rem;
  height: 1.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 99px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
}

.theme:hover { border-color: var(--color-accent); color: var(--color-accent); }
.theme svg { width: 0.95rem; height: 0.95rem; display: block; }
.theme .moon { display: none; }
:root[data-theme="dark"] .theme .sun { display: none; }
:root[data-theme="dark"] .theme .moon { display: block; }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .theme .sun { display: none; }
  :root:not([data-theme="light"]) .theme .moon { display: block; }
}

/* ---- Track: where you are in the course ---- */

/* The track rides inside the bar, so it needs no sticky position, no seam
   overlap, and no stacking context of its own. */

.track {
  display: flex;
  gap: 0.25rem;
  max-width: var(--teach-chrome);
  margin: 0 auto;
  padding: 0 0 0.75rem;
}

.track i {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: var(--color-border);
}

.track i.done { background: var(--color-accent); }
.track i.here { background: var(--color-accent); box-shadow: 0 0 0 2px var(--color-teach-accent-bg); }

/* ---- Footer navigation, the only place it appears ---- */

.nav { margin: 4rem 0 0; align-items: stretch; }

.nav > a, .nav > span { display: flex; flex-direction: column; justify-content: center; }

.nav .arrow {
  font-family: var(--teach-mono);
  color: var(--color-muted);
  padding-right: 0.35rem;
}

.nav > a:hover .arrow { color: var(--color-accent); }

/* ---- Jump menu: random access, where the foot nav is sequential ---- */

.jump { position: relative; }

.jump summary {
  list-style: none;
  cursor: pointer;
  font-family: var(--teach-mono);
  font-size: 0.75rem;
  color: var(--color-muted);
  padding: 0.25rem 0.55rem;
  border: 1px solid transparent;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.jump summary::-webkit-details-marker { display: none; }
.jump summary:hover { border-color: var(--color-accent); color: var(--color-accent); }
/* The caret says "this is a menu" and nothing else. It used to flip to say
   "the menu is open", which the open panel underneath already says, so the
   motion carried no information a reader could not already see. */
.jump summary .caret { opacity: 0.55; }
.jump summary:hover .caret { opacity: 1; }
.jump[open] summary { border-color: var(--color-accent); color: var(--color-accent); }
.jump[open] summary .caret { opacity: 1; }

.jump-list {
  position: absolute;
  top: calc(100% + 0.4rem);
  left: 0;
  z-index: 20;
  min-width: 21rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 9px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  padding: 0.35rem;
  list-style: none;
  margin: 0;
}

:root[data-theme="dark"] .jump-list { box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5); }

.jump-list a {
  display: grid;
  grid-template-columns: 1.65rem 1fr auto;
  gap: 0.7rem;
  align-items: center;
  padding: 0.45rem 0.55rem;
  border-radius: 6px;
  text-decoration: none;
  color: var(--color-text-body);
  font-size: 0.875rem;
}

.jump-list a:hover { background: var(--color-surface); }
.jump-list .n { font-family: var(--teach-mono); font-size: 0.75rem; color: var(--color-muted); }
.jump-list .dot { width: 6px; height: 6px; border-radius: 99px; background: var(--color-border); }
.jump-list .dot.done { background: var(--color-accent); }
.jump-list li.at a { background: var(--color-teach-accent-bg); }
.jump-list li.at .n { color: var(--color-accent); }
.jump-list li.soon a { color: var(--color-muted); }

.jump.ws summary { color: var(--color-text-secondary); }

.jump-list li.all { border-top: 1px solid var(--color-border); margin-top: 0.25rem; padding-top: 0.25rem; }
.jump-list li.all a { color: var(--color-accent); }
.jump-list li.all .n { color: var(--color-accent); }

/* The menu is \`min-width: 21rem\` and anchored to its summary, which puts its
   right edge 35 pixels past a 390 pixel viewport. Clamping the width and
   letting a long row wrap keeps it on screen without a breakpoint. */
.jump-list {
  min-width: min(21rem, calc(100vw - 2rem));
  max-width: calc(100vw - 2rem);
}

/* The route back to the full listing sits above the workspaces it lists. */
.jump-list li.head a { color: var(--color-text-secondary); font-weight: 600; }
.jump-list li.head { border-bottom: 1px solid var(--color-border); margin-bottom: 0.3rem; padding-bottom: 0.3rem; }

/* An unwritten lesson and a stub workspace are inert, so they render inert.
   Reduced opacity alone reads as a rendering fault, so the cursor says it too. */
.jump-list li.soon a,
.toc li.soon a,
[aria-disabled="true"] {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

@media (max-width: 640px) {
  .bar { padding: 0 1rem; }
    main { padding-left: 1rem; padding-right: 1rem; }
    .mast { font-size: 0.75rem; gap: 0.5rem; }
    .mast-left { gap: 0.5rem; row-gap: 0.35rem; }
}

@media (max-width: 640px) {
  .jump-list {
    position: fixed;
    left: 1rem;
    right: 1rem;
    top: auto;
    min-width: 0;
    max-width: none;
  }
}`,
}

const TEACH_ARTICLE: Component = {
  name: 'teach-article',
  note: [
    'The base reading-column styles a teach page renders prose in: type, panels,',
    'code, callouts, tables, the workspace contents listing, and the focus ring.',
    'Recovered alongside teach-chrome from the same two files.',
  ].join('\n   '),
  reads: [
    '--color-border',
    '--color-surface',
    '--color-text',
    '--color-text-body',
    '--color-text-secondary',
    '--color-muted',
    '--color-accent',
    '--teach-hand',
    '--teach-mono',
    '--t4',
    '--t5',
    '--t6',
  ],
  rules: `/* ---- Type ---- */

h1 {
  font-size: 2.15rem;
  line-height: 1.14;
  font-weight: 800;
  letter-spacing: -0.022em;
  margin: 0 0 0.55rem;
  text-wrap: balance;
}

h2 {
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: -0.012em;
  margin: 3rem 0 0.85rem;
}

h3 { font-size: 1.03rem; font-weight: 700; margin: 1.9rem 0 0.4rem; }

p { margin: 0 0 1.15rem; }

.lede {
  font-size: 1.1875rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
  margin-bottom: 2rem;
}

a { color: var(--color-accent); }

em { font-style: italic; }

/* ---- Panels ---- */

.assumes, .progress {
  font-size: 0.8438rem;
  line-height: 1.7;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border-radius: 7px;
  padding: 0.9rem 1.15rem;
  margin: 0 0 2.5rem;
}

.assumes b, .progress b {
  display: block;
  color: var(--color-muted);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: var(--t6);
  margin-bottom: 0.2rem;
}

/* ---- Code ---- */

code {
  font-family: var(--teach-mono);
  font-size: 0.85em;
  background: var(--color-surface);
  padding: 0.13em 0.38em;
  border-radius: 4px;
}

pre {
  font-family: var(--teach-mono);
  font-size: var(--t5);
  line-height: 1.7;
  background: var(--color-surface);
  padding: 1.15rem 1.3rem;
  border-radius: 7px;
  overflow-x: auto;
  margin: 0 0 1.5rem;
}

pre code { background: none; padding: 0; font-size: 1em; }

/* ---- Callout ---- */

.hard {
  background: var(--color-teach-accent-bg);
  border-radius: 7px;
  padding: 1.1rem 1.3rem;
  margin: 2rem 0;
}

.hard-label {
  font-family: var(--teach-hand);
  font-size: 1.0625rem;
  color: var(--color-accent);
  display: block;
  margin-bottom: 0.35rem;
}

.hard p:last-child { margin-bottom: 0; }

/* ---- Tables ---- */

table { width: 100%; border-collapse: collapse; font-size: 0.875rem; margin: 0 0 1.5rem; }
th, td { text-align: right; padding: 0.55rem 0.7rem; border-bottom: 1px solid var(--color-border); }
th:first-child, td:first-child { text-align: left; }

th {
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-muted);
  border-bottom-color: var(--color-border);
}

tbody tr.mark td { background: var(--color-teach-accent-bg); }
.scroll { overflow-x: auto; }

/* ---- Contents ---- */

.toc { list-style: none; padding: 0; margin: 0 0 2.5rem; }
.toc li + li { border-top: 1px solid var(--color-border); }

.toc a {
  display: grid;
  grid-template-columns: 2.25rem 1fr auto;
  gap: 0 1.1rem;
  align-items: baseline;
  padding: 1rem 0.7rem;
  text-decoration: none;
  color: var(--color-text-body);
  border-radius: 7px;
}

.toc a:hover { background: var(--color-surface); }
.toc .num { font-family: var(--teach-mono); font-size: var(--t5); color: var(--color-accent); }
.toc b { font-size: 1.0625rem; font-weight: 700; letter-spacing: -0.012em; }

.toc .blurb {
  grid-column: 2;
  font-size: var(--t4);
  line-height: 1.5;
  color: var(--color-text-secondary);
  margin-top: 0.1rem;
}

/* A dot and a word, not a pill. The jump menus already say written and
   planned with a filled or hollow dot, so the bordered uppercase badge was a
   second vocabulary for a fact the design system already had one for. Sentence
   case and no tracking, per the UI copy rule. */
.toc .state {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: var(--color-muted);
  white-space: nowrap;
}

.toc .state::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 99px;
  background: var(--color-border);
  flex: none;
}

.toc .state.done { color: var(--color-text-secondary); }
.toc .state.done::before { background: var(--color-accent); }
.toc .state.next { color: var(--color-text-secondary); }
.toc .state.next::before { background: var(--color-accent); }

/* A link leaving the page says so with a mark beside it rather than with a
   badge spelling out the sentence. */
.toc .ext {
  font-size: 0.875rem;
  color: var(--color-muted);
  margin-left: 0.35rem;
}

.toc a:hover .ext { color: var(--color-accent); }

ol.succ {
  margin: 0 0 2.5rem;
  padding-left: 1.35rem;
  font-size: var(--t4);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

ol.succ li { margin-bottom: 0.4rem; }
.toc li.soon b { color: var(--color-muted); font-weight: 400; }

/* ---- Focus is one token, and it is the accent ---- */

:where(a, button, summary, input, .opt):focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 5px;
}

/* A summary carries its own border, so the ring sits outside it rather than
   doubling the box. */
.jump summary:focus-visible { outline-offset: 1px; }

/* The browser default ring is white on a dark ground, which reads as a second
   accent. Suppressing it only where the token above replaces it. */
:where(a, button, summary, input, .opt):focus:not(:focus-visible) { outline: none; }

@media (max-width: 640px) {
  body { font-size: 1.0625rem; }
}

/* The week plan. Its markup shipped with no rule matching any of its five
   classes, so it rendered as a run of inline spans with the ordinal, the
   title, the description, and the duration all touching. */

.road { margin: 1.75rem 0 2.5rem; }

.road-row {
  display: grid;
  grid-template-columns: 1.75rem 1fr auto;
  gap: 0.9rem;
  align-items: baseline;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--color-border);
}

.road-row:last-child { border-bottom: 0; }

.road-n {
  font-family: var(--teach-mono);
  font-size: var(--t5);
  color: var(--color-accent);
}

.road-b { display: block; }
.road-b b { display: block; margin-bottom: 0.2rem; }
.road-b span { color: var(--color-text-secondary); font-size: var(--t4); line-height: 1.55; }

.road-t {
  font-family: var(--teach-mono);
  font-size: 0.75rem;
  color: var(--color-muted);
  white-space: nowrap;
}

/* The closing line is a paragraph rather than a row, so it keeps the column
   the rows set rather than sitting flush against the measure. */
.road + p > b:first-child { color: var(--color-text); }

@media (max-width: 640px) {
  .road-row { grid-template-columns: 1.5rem 1fr; }
  .road-t { grid-column: 2; }
}`,
}

const TEACH_QUIZ: Component = {
  name: 'teach-quiz',
  note: [
    'The recognition quiz a lesson embeds: the option list, its right/wrong/chosen',
    'states, and the feedback block. `canon teach nav` layers a small stepper block',
    'of its own on top of this for the non-legacy option shape.',
  ].join('\n   '),
  reads: [
    '--color-border',
    '--color-surface',
    '--color-text',
    '--color-text-secondary',
    '--color-muted',
    '--color-accent',
    '--teach-sans',
    '--teach-mono',
    '--teach-shadow',
    '--color-teach-accent-bg',
    '--t4',
    '--t5',
  ],
  rules: `/* ---- Quiz ---- */

.quiz { margin-top: 3rem; border-top: 1px solid var(--color-border); padding-top: 1.75rem; }
.quiz > h2:first-child { margin-top: 0; }
.q { margin: 0 0 2.5rem; }
.q-stem { font-weight: 700; margin-bottom: 0.85rem; }

.opt {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.7rem 0.95rem;
  margin-bottom: 0.45rem;
  cursor: pointer;
  font-family: var(--teach-sans);
  font-size: var(--t4);
  background: transparent;
  width: 100%;
  text-align: left;
  color: inherit;
  line-height: 1.45;
  box-shadow: var(--teach-shadow);
}

.opt::before {
  content: attr(data-k);
  font-family: var(--teach-mono);
  font-size: 0.7188rem;
  color: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  padding: 0.05rem 0.38rem;
  flex: 0 0 auto;
}

.opt:hover { border-color: var(--color-accent); background: var(--color-teach-accent-bg); }
.opt[data-state="right"] { border-color: var(--color-accent); background: var(--color-teach-accent-bg); }
.opt[data-state="right"]::before { color: var(--color-accent); border-color: var(--color-accent); }
.opt[data-state="wrong"] { opacity: 0.38; }

/* The option the learner actually picked stays legible and says so.
   A wrong pick that fades like an option nobody considered destroys the
   contrast between what they thought and what is true, which is the
   moment the correction lands. */

.opt[data-state="chosen"] {
  opacity: 1;
  border-color: var(--color-muted);
  border-style: dashed;
}

.opt[data-state="chosen"]::after {
  content: "your answer";
  margin-left: auto;
  font-size: 0.6563rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--color-muted);
  align-self: center;
}

.opt[data-state="right"]::after {
  content: "correct";
  margin-left: auto;
  font-size: 0.6563rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--color-accent);
  align-self: center;
}

.fb {
  display: none;
  font-size: var(--t4);
  line-height: 1.55;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border-radius: 7px;
  padding: 0.85rem 1.05rem;
  margin-top: 0.55rem;
}

.fb.show { display: block; }
.fb b { color: var(--color-text); font-weight: 700; }

footer {
  margin-top: 4rem;
  padding-top: 1.4rem;
  border-top: 1px solid var(--color-border);
  font-size: var(--t5);
  line-height: 1.6;
  color: var(--color-muted);
}`,
}

const TEACH_GLOSSARY: Component = {
  name: 'teach-glossary',
  note: [
    'The filterable glossary view a workspace root carries: the term count, the',
    'filter input, and the scrolling term list.',
  ].join('\n   '),
  reads: [
    '--color-background',
    '--color-border',
    '--color-text-body',
    '--color-text-secondary',
    '--color-muted',
    '--color-accent',
    '--teach-sans',
    '--teach-mono',
    '--t4',
    '--t5',
  ],
  rules: `/* ---- Glossary view, generated from the markdown source ---- */

h2 .count {
  font-family: var(--teach-mono);
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: 99px;
  padding: 0.1rem 0.5rem;
  margin-left: 0.5rem;
  vertical-align: middle;
}

.filter {
  width: 100%;
  font-family: var(--teach-sans);
  font-size: var(--t4);
  color: var(--color-text-body);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 0.55rem 0.8rem;
  margin: 0 0 1rem;
}

/* Scoped to pointer focus. Written as \`.filter:focus\` it outranked the
   \`:where(...)\` focus token, whose specificity is zero, and the filter was the
   one control on the page that a keyboard reached with no ring at all. */
.filter:focus { border-color: var(--color-accent); }
.filter:focus:not(:focus-visible) { outline: none; }
.filter::placeholder { color: var(--color-muted); }

/* A fixed scroll region rather than a collapsing list. Filtering a list that
   sets page height makes the page jump under the reader, and the same fixed
   region is what lets the glossary grow past what one screen shows without
   the page growing with it. */

/* A scroll region is a tab stop in its own right, so it takes the same ring
   as everything else rather than the browser's white default. */
.gloss:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; border-radius: 5px; }

.gloss {
  height: clamp(14rem, 46vh, 32rem);
  overflow-y: auto;
  margin-bottom: 2.5rem;
  border-bottom: 1px solid var(--color-border);
  scrollbar-width: thin;
}

/* Scrollbar styling is global rather than per component. It was scoped to the
   glossary, so the outline rail, the code blocks, and the scrolling tables all
   fell back to the browser default, which paints a light track on a dark page
   and is the one element on screen taking no color from these tokens. */

.gloss .empty {
  display: none;
  padding: 1.2rem 0;
  color: var(--color-muted);
  font-size: var(--t4);
}

.gloss.none .empty { display: block; }

.gterm {
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--t4);
  line-height: 1.55;
}

.gloss-group {
  margin: 1.1rem 0 0.4rem;
  font-family: var(--teach-sans);
  font-size: var(--t5);
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.gloss-group:first-of-type { margin-top: 0; }

.gterm b { font-weight: 700; }
/* The markdown source separates a term from its definition with a colon,
   and the house standard bans an em dash outright, so the view mirrors
   the source rather than inventing punctuation for it. */
/* The space is part of the generated content, since the term and its
   definition are adjacent elements with no whitespace between them in the
   markup and the colon rendered flush against the first word. */
.gterm b::after { content: ": "; color: var(--color-muted); font-weight: 400; white-space: pre; }
.gterm span { color: var(--color-text-secondary); }

ol.succ {
  margin: 0 0 2.5rem;
  padding-left: 1.35rem;
  font-size: var(--t4);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

ol.succ li { margin-bottom: 0.4rem; }
.toc li.soon b { color: var(--color-muted); font-weight: 400; }

/* A filter that matches nothing needs a way back, not just a sentence. */
.gloss .empty .clear {
  font-family: var(--teach-sans);
  font-size: 0.875rem;
  color: var(--color-accent);
  background: none;
  border: 0;
  border-bottom: 1px solid currentColor;
  padding: 0;
  margin-left: 0.35rem;
  cursor: pointer;
}`,
}

const TEACH_OUTLINE: Component = {
  name: 'teach-outline',
  note: [
    'The in-lesson outline rail in the gutter the reading measure leaves over, and',
    'the workspace-switcher row inside the lesson jump menu.',
  ].join('\n   '),
  reads: [
    '--color-border',
    '--color-text-body',
    '--color-muted',
    '--color-accent',
    '--teach-sans',
    '--teach-measure',
    '--teach-mast-h',
    '--t5',
  ],
  rules: `/* ---- In-lesson outline, in the gutter the measure leaves over ---- */

.outline {
  position: fixed;
  top: calc(var(--teach-mast-h) + 2.2rem);
  /* Four pixels of padding with the position pulled back by the same amount,
     so a focus ring at the rail's edge has somewhere to draw. \`overflow-y\`
     clips horizontally too, which took a bite out of every ring in here. */
  left: calc(50% + var(--teach-measure) / 2 + 2.5rem - 4px);
  padding: 0 4px;
  width: calc(13rem + 8px);
  max-height: calc(100vh - var(--teach-mast-h) - 4rem);
  overflow-y: auto;
  font-size: var(--t5);
  line-height: 1.45;
}

/* The heading is a control rather than a label, because returning to the top
   of a long lesson is the one thing the rail could not do. */
.outline .to-top {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  font-family: var(--teach-sans);
  font-size: 0.6563rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--color-muted);
  background: none;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  border-radius: 3px 3px 0 0;
  margin: 0 0 0.6rem;
  padding: 0.2rem 0 0.55rem;
  cursor: pointer;
  text-align: left;
}

.outline .to-top:hover { color: var(--color-accent); border-bottom-color: var(--color-border); }

.outline .to-top::before {
  content: "";
  width: 11px;
  height: 8px;
  background:
    linear-gradient(var(--color-muted) 0 0) 0 0 / 11px 1.5px no-repeat,
    linear-gradient(var(--color-muted) 0 0) 0 3.2px / 8px 1.5px no-repeat,
    linear-gradient(var(--color-muted) 0 0) 0 6.5px / 11px 1.5px no-repeat;
}

.outline a {
  display: block;
  padding: 0.3rem 0 0.3rem 0.7rem;
  border-left: 2px solid var(--color-border);
  color: var(--color-muted);
  text-decoration: none;
}

.outline a:hover { color: var(--color-text-body); border-left-color: var(--color-border); }
.outline a.on { color: var(--color-accent); border-left-color: var(--color-accent); }

@media (max-width: 1420px) { .outline { display: none; } }`,
}

const TEACH_REFERENCES: Component = {
  name: 'teach-references',
  note: [
    'The numbered citation marks and reference list a lesson closes with, and the',
    'rendered view of a promoted reference page.',
  ].join('\n   '),
  reads: [
    '--color-background',
    '--color-border',
    '--color-text-secondary',
    '--color-muted',
    '--color-accent',
    '--teach-mono',
    '--color-teach-accent-bg',
    '--t5',
  ],
  rules: `footer {
  margin-top: 4rem;
  padding-top: 1.4rem;
  border-top: 1px solid var(--color-border);
  font-size: var(--t5);
  line-height: 1.6;
  color: var(--color-muted);
}

/* ---- References, numbered rather than narrated ---- */

sup.cite {
  font-family: var(--teach-mono);
  font-size: 0.6875em;
  line-height: 0;
  margin-left: 0.1em;
}

sup.cite a {
  text-decoration: none;
  padding: 0.05em 0.25em;
  border-radius: 3px;
  background: var(--color-teach-accent-bg);
  color: var(--color-accent);
}

sup.cite a:hover { background: var(--color-accent); color: var(--color-background); }

ol.refs {
  list-style: none;
  counter-reset: r;
  padding: 0;
  margin: 0.9rem 0 1.1rem;
  font-size: var(--t5);
  line-height: 1.55;
}

ol.refs li {
  counter-increment: r;
  position: relative;
  padding-left: 2.1rem;
  margin-bottom: 0.5rem;
}

ol.refs li::before {
  content: "[" counter(r) "]";
  position: absolute;
  left: 0;
  font-family: var(--teach-mono);
  color: var(--color-accent);
}

ol.refs cite { font-style: italic; color: var(--color-text-secondary); }
ol.refs a { word-break: break-word; }

footer .own {
  margin: 0;
  padding-top: 0.7rem;
  border-top: 1px solid var(--color-border);
  color: var(--color-muted);
}

main.ref { padding-bottom: 4rem; }
main.ref h1 { margin-top: 1.5rem; }
main.ref h2 { margin-top: 2.5rem; }
main.ref ol, main.ref ul { padding-left: 1.4rem; }
main.ref li { margin-bottom: 0.5rem; }
main.ref blockquote {
  margin: 1.5rem 0;
  padding: 0.1rem 0 0.1rem 1.1rem;
  border-left: 3px solid var(--color-border);
  color: var(--color-text-secondary);
}`,
}

export const TEACH_COMPONENTS: readonly Component[] = [
  TEACH_CHROME,
  TEACH_ARTICLE,
  TEACH_QUIZ,
  TEACH_GLOSSARY,
  TEACH_OUTLINE,
  TEACH_REFERENCES,
]

/**
 * The generic components every design consumer gets, plus the teach chrome,
 * for the one caller that wants both: a teach workspace stylesheet.
 */
export const TEACH_STYLESHEET_COMPONENTS: readonly Component[] = [
  ...COMPONENTS,
  ...TEACH_COMPONENTS,
]
