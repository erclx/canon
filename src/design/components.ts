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

/**
 * Where the course sidebar stops being a column and becomes an overlay.
 *
 * The media query below and both `matchMedia` calls in `@/teach/nav` read this
 * one value. Three literals is what it was, and each had a test asserting its
 * own copy, so a half-finished move passed green while the scripts switched at
 * one width and the layout at another.
 */
export const TEACH_SIDEBAR_BREAKPOINT = 1100

const TEACH_CHROME: Component = {
  name: 'teach-chrome',
  note: [
    'The masthead, breadcrumb, jump menu, theme toggle, course sidebar, and footer',
    'navigation shared by every teach page. Recovered from two gitignored',
    'course.css files that predate a regression that dropped this layer from the',
    "generator, and rewritten onto this module's tokens rather than the",
    'incompatible palette they carried. See canon/wireframes/teach/chrome.md for',
    'the shape.',
  ].join('\n   '),
  reads: [
    '--color-background',
    '--color-surface',
    '--color-chrome',
    '--color-border',
    '--color-text',
    '--color-text-body',
    '--color-text-secondary',
    '--color-muted',
    '--color-accent',
    '--teach-sans',
    '--teach-mono',
    '--teach-measure',
    '--teach-shadow',
    '--color-teach-accent-bg',
    '--type-body-family',
    '--type-code-family',
    '--t3',
    '--t4',
    '--t5',
    '--t6',
  ],
  rules: `:root {
  --teach-sans: var(--type-body-family);
  --teach-hand: 'Virgil', 'Excalifont', cursive;
  --teach-mono: var(--type-code-family);
  --teach-measure: 52rem;
  --teach-mast-h: 3.5rem;
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

html { scroll-padding-top: calc(var(--teach-mast-h) + 1rem); }

/* No padding at all on the body, so the sticky bar reaches both window edges
   and the sidebar can travel the full height. The gutter moves onto \`main\` and
   the bottom room onto \`.pane\`: a flex item's sticky containing block is the
   flex container's content box, so padding here is space the sidebar could
   never reach and it would ride up by exactly that much near the foot. */
body {
  margin: 0;
  padding: 0;
  display: flex;
  align-items: flex-start;
  background: var(--color-background);
  color: var(--color-text-body);
  font-family: var(--teach-sans);
  font-size: var(--t3);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

/* The bar row and the text column resolve to the same 52rem content box, so a
   listing page and a lesson start at the same left edge as the chrome above
   them. A narrower \`.wide-body\` was what put the navigation and the content on
   two different measures. */
main { box-sizing: border-box; max-width: calc(var(--teach-measure) + 3rem); margin: 0 auto; padding: 2.25rem 1.5rem 0; }
.wide-body { max-width: calc(var(--teach-measure) + 3rem); }

/* Everything but the sidebar. \`flow-root\` rather than a bare block, because a
   bottom margin collapsing out of here makes the document taller than the flex
   container and a sticky sidebar can only travel inside its containing block,
   so it would ride up by exactly the escaped margin on a tall window. The
   border box is what keeps \`min-height: 100vh\` plus the bottom room from
   scrolling every short page by that padding. */
.pane {
  flex: 1 1 auto;
  min-width: 0;
  display: flow-root;
  box-sizing: border-box;
  min-height: 100vh;
  padding-bottom: 7rem;
  border-left: 1px solid var(--color-border);
}

html.sb-shut .pane { border-left: 0; }

.bar {
  position: sticky;
  top: 0;
  z-index: 30;
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  padding: 0 1.5rem;
  cursor: default;
}

/* The reading bar rides the masthead's own bottom edge rather than arriving as
   a second element. It reports position inside the lesson, which nothing
   reported, where the retired track reported position in the course, which the
   sidebar now reports. */
.bar::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -1px;
  height: 2px;
  width: var(--read, 0%);
  background: var(--color-accent);
}

/* The height is the token rather than the sum of two paddings, so the sidebar's
   own top row lands on the same seam the bar's bottom border draws. The row
   spans the window rather than the reading measure: capped, the toggle and the
   theme control floated in from the edges by an amount that changed per page. */
.mast {
  max-width: none;
  margin: 0;
  min-height: var(--teach-mast-h);
  padding: 0 0.9rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.55rem;
  font-size: var(--t5);
  color: var(--color-muted);
  cursor: default;
}

.mast a { color: var(--color-accent); text-decoration: none; font-weight: 600; }
.mast a:hover { text-decoration: underline; }

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
.nav > :only-child { flex: 0 1 calc(50% - 0.3rem); }
.nav > .to-next:only-child { margin-left: auto; }

.nav .lbl {
  display: block;
  font-size: var(--t6);
  font-weight: 700;
  letter-spacing: 0;
  color: var(--color-muted);
  margin-bottom: 0.15rem;
}

.nav > a:hover .lbl { color: var(--color-accent); }
.nav .to-next { text-align: right; }
.nav .to-index { flex: 0 0 auto; text-align: center; }

/* ---- Masthead contents ---- */

/* Sticky position and stacking both live on \`.bar\` now, so nothing here
   restates either. */
/* A breadcrumb rather than a row of links. The gap tightens because the
   separators now carry the spacing the gap used to. */
.mast-left { display: flex; align-items: center; gap: 0.3rem; min-width: 0; flex-wrap: wrap; cursor: default; }

/* \`--rule\` measured 1.27:1 here. It is a border token, and a border is a
   shape a reader infers rather than a glyph they resolve, so it is the wrong
   value for a character even a decorative one. */
.crumb-sep {
  color: var(--color-muted);
  font-size: var(--t4);
  margin: 0 0.1rem;
  user-select: none;
}

/* One arrow, on the first segment, since that is the only one that goes up. */
.crumb-back {
  margin-right: 0.3rem;
  font-size: var(--t4);
  line-height: 1;
}

.crumb { display: inline-flex; align-items: center; }

/* The label and its caret are one component with two zones, like a split
   button: the label navigates, the caret opens the menu, and one surface fills
   for both so the pair reads as a single chip rather than two loose pieces.
   The pointer covers the gap between them, which is interactive on both sides. */
.crumb-item {
  display: inline-flex;
  align-items: center;
  gap: 0;
  border-radius: 7px;
  padding: 0.1rem 0.15rem 0.1rem 0.35rem;
  cursor: pointer;
}

.crumb-item:has(details.jump):hover,
.crumb-item:has(details.jump[open]) { background: var(--color-chrome); }

/* Accent reports where you are. A crumb is navigation you can take, so it is
   neutral, and \`.mast a\` keeps the accent for any other bar link. */
.mast a.crumb { color: var(--color-text-secondary); padding: 0.1rem 0.15rem 0.1rem 0; }
.mast a.crumb:hover { text-decoration: none; }
.crumb-item:hover a.crumb { color: var(--color-text); }

.crumb-here { color: var(--color-text); font-weight: 650; }

/* \`align-items: center\` centres boxes, and a label's line box carries
   half-leading above the cap and descender room below, so its capitals sit
   above its own centre by an amount that scales with the font size. Trimming
   the label to its cap band fixes the box rather than nudging the mark. It
   lands on a span holding the text alone, since the link's own \`inline-flex\`
   ignores it. Firefox ships no \`text-box\` and keeps the caret a pixel low. */
.crumb-t, .crumb-here, .sb-ws .ws-name {
  display: block;
  text-box: trim-both cap alphabetic;
}

/* The caret is the whole control, so it carries the 24 pixel minimum on its
   own rather than inheriting a label's width. It fills nothing itself, since
   the chip around it does. */
.crumb-item > .jump > summary {
  min-width: 1.5rem;
  min-height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem 0.3rem 0.15rem 0;
  border: 0;
  background: transparent;
}

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

.mast-right { display: flex; align-items: center; gap: 0.2rem; margin-left: auto; }

/* No border, at the fold control's size and radius, so every control on the
   bar is drawn one way. */
.theme {
  width: 1.75rem;
  height: 1.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
}

.theme:hover { color: var(--color-text); background: var(--color-chrome); }
.theme svg { width: 0.95rem; height: 0.95rem; display: block; }
.theme .moon { display: none; }
:root[data-theme="dark"] .theme .sun { display: none; }
:root[data-theme="dark"] .theme .moon { display: block; }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .theme .sun { display: none; }
  :root:not([data-theme="light"]) .theme .moon { display: block; }
}

/* ---- The course sidebar ---- */

/* A segmented progress strip used to sit here, one \`flex: 1\` segment per
   lesson, and it stopped working at the scale a reader most needs it: fifty
   lessons rendered as a row of dots. The sidebar reports course position
   instead, at any length, and the bar reports position inside the lesson. */

/* The toggle in the masthead, left of the breadcrumb. */
.sb-fold {
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
  margin-right: 0.35rem;
  font: inherit;
  font-size: var(--t5);
  line-height: 1;
  color: var(--color-muted);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.sb-fold:hover { color: var(--color-text); background: var(--color-chrome); }

.sb {
  flex: 0 0 var(--sb-w, 16rem);
  width: var(--sb-w, 16rem);
  position: sticky;
  top: 0;
  align-self: flex-start;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: visible;
  background: transparent;
  font-family: var(--teach-sans);
  transition: flex-basis 0.14s, width 0.14s;
}

html.sb-shut .sb { flex-basis: 0; width: 0; overflow: hidden; }

.sb-top {
  flex: none;
  display: flex;
  align-items: center;
  height: var(--teach-mast-h);
  padding: 0 0.95rem;
  border-bottom: 1px solid var(--color-border);
}

.sb-ws { position: relative; }

.sb-ws > summary {
  list-style: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.3rem;
  border-radius: 6px;
  font-size: var(--t4);
  font-weight: 650;
  color: var(--color-text);
}

.sb-ws > summary::-webkit-details-marker { display: none; }
.sb-ws > summary:hover, .sb-ws[open] > summary { background: var(--color-chrome); color: var(--color-text); }
.sb-ws .car { color: var(--color-muted); display: inline-flex; align-items: center; }

.sb-wl {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  z-index: 40;
  min-width: 13rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 9px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  padding: 0.3rem;
}

:root[data-theme="dark"] .sb-wl { box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5); }

/* The popover chrome comes from \`.sb-wl\`, so the list nested inside it drops
   its own rather than drawing a second border inside the first. */
.sb-wl .jump-list {
  position: static;
  min-width: 0;
  max-width: none;
  border: 0;
  box-shadow: none;
  padding: 0;
  background: transparent;
}

.sb-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-bottom: 1rem; }

.sb-meta {
  padding: 1rem 1.25rem 0.55rem;
  color: var(--color-muted);
  font-size: var(--t6);
  font-variant-numeric: tabular-nums;
}

.sb-filter { padding: 0 0.95rem 0.6rem; }

.sb-filter input {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  font-size: var(--t6);
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 0.3rem 0.55rem;
}

.sb-filter input:focus { outline: none; border-color: var(--color-accent); }

.sb-list { list-style: none; margin: 0; padding: 0 0.7rem; }
.sb-list li { margin: 0; }
.sb-list li.hide { display: none; }

.sb-l {
  position: relative;
  display: flex;
  gap: 0.55rem;
  align-items: baseline;
  padding: 0.38rem 0.55rem;
  border-radius: 6px;
  text-decoration: none;
  color: var(--color-text-body);
  font-size: var(--t5);
  line-height: 1.45;
}

.sb-l:hover { background: var(--color-chrome); color: var(--color-text); }

.sb-n {
  flex: none;
  font-family: var(--teach-mono);
  font-size: var(--t6);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

.sb-on { color: var(--color-text); font-weight: 650; }

.sb-on::before {
  content: "";
  position: absolute;
  left: -0.6rem;
  top: 0.28rem;
  bottom: 0.28rem;
  width: 2px;
  border-radius: 2px;
  background: var(--color-accent);
}

.sb-on .sb-n { color: var(--color-accent); }

.sb-empty { padding: 0.3rem 1.2rem; color: var(--color-muted); font-size: var(--t6); }

.sb-foot {
  flex: none;
  padding: 0.7rem 1.25rem;
  border-top: 1px solid var(--color-border);
  color: var(--color-muted);
  font-size: var(--t6);
  font-variant-numeric: tabular-nums;
}

/* The panel is resizable between a width that still fits a lesson title and one
   that would start eating the reading measure. */
.sb-grip {
  position: absolute;
  top: 0;
  bottom: 0;
  right: -3px;
  width: 7px;
  z-index: 25;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
  touch-action: none;
}

.sb-grip::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 2.2rem;
  border-radius: 1px;
  background: var(--color-border);
  opacity: 0;
  transition: opacity 0.12s;
}

.sb-grip:hover::before, .sb-grip:focus-visible::before, html.sb-drag .sb-grip::before {
  opacity: 1;
  background: var(--color-accent);
}

.sb-grip:focus-visible { outline: none; }
html.sb-drag { cursor: col-resize; user-select: none; }
html.sb-shut .sb-grip { display: none; }

/* Both belong to the overlay and the script appends both on every page, so
   each is hidden until the breakpoint hands it a job. Without this the close
   control renders as an unstyled button stretched across the column, and the
   scrim becomes a flex item of the body. */
.sb-close, .sb-scrim { display: none; }

/* ---- Footer navigation, the only place it appears ---- */

.nav {
  max-width: calc(var(--teach-measure) + 3rem);
  margin: 4rem auto 0;
  padding: 0 1.5rem;
  box-sizing: border-box;
  align-items: stretch;
}

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
/* The caret says "this is a menu" and nothing else, so it is drawn at full
   strength in every state and stays muted. A reveal on hover hid the only
   route into the menu from a reader who cannot hover, and an affordance is not
   a state, so it takes no accent on hover or while open. */
.jump summary .caret { color: var(--color-muted); }

.jump-list {
  position: absolute;
  top: calc(100% + 0.4rem);
  left: 0;
  z-index: 20;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 9px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  padding: 0.25rem;
  list-style: none;
  margin: 0;
}

:root[data-theme="dark"] .jump-list { box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5); }

/* One row recipe wherever the menu is mounted, on the steps the lesson list
   beside it already reads: the label at \`--t5\` and the numeral at \`--t6\` mono.
   The weight is restated because \`.mast a\` sets 600 for the bar's own links. */
.jump-list a {
  display: grid;
  grid-template-columns: 1.65rem 1fr auto;
  gap: 0.55rem;
  align-items: center;
  padding: 0.38rem 0.55rem;
  border-radius: 6px;
  text-decoration: none;
  color: var(--color-text-body);
  font-size: var(--t5);
  font-weight: 400;
  line-height: 1.45;
}

.jump-list a:hover { background: var(--color-chrome); }
.jump-list .n { font-family: var(--teach-mono); font-size: var(--t6); color: var(--color-muted); }
/* The third column used to hold a status dot that read the same on every row,
   so it reported nothing. It is a per-entry trailing slot now: the workspace
   menu puts a lesson count there and the lesson menu leaves it empty. */
.jump-list .ct {
  font-family: var(--teach-mono);
  font-size: var(--t6);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.jump-list li.at a { background: var(--color-teach-accent-bg); }
.jump-list li.at .n { color: var(--color-accent); }
.jump-list li.soon a { color: var(--color-muted); }

.jump.ws summary { color: var(--color-text-secondary); }

.jump-list li.all { border-top: 1px solid var(--color-border); margin-top: 0.25rem; padding-top: 0.25rem; }
.jump-list li.all a { color: var(--color-accent); }
.jump-list li.all .n { color: var(--color-accent); }

/* The menu fits its content above an 11rem floor rather than padding three
   short titles out to a wide panel. It is anchored to its summary, so the
   clamp keeps a long row wrapping on screen without a breakpoint. */
.jump-list {
  min-width: min(11rem, calc(100vw - 2rem));
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
    .mast { font-size: 0.75rem; }
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
}

/* ---- What gives way below 1100px ---- */

/* Hiding the sidebar outright leaves the toggle painted exactly where it cannot
   act, and it deletes the filter and the per-lesson outline, which the
   breadcrumb caret does not carry. The panel becomes an overlay instead, and it
   states its own ground because \`.sb\` is transparent by design for a column
   sitting on the page rather than floating over the lesson. */
@media (max-width: ${TEACH_SIDEBAR_BREAKPOINT}px) {
  .pane { border-left: 0; }

  .sb {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 60;
    width: min(21rem, 86vw);
    height: 100dvh;
    overflow-y: auto;
    background: var(--color-background);
    border-right: 1px solid var(--color-border);
    box-shadow: 0 0 40px rgb(0 0 0 / 35%);
    transform: translateX(-100%);
    transition: transform 0.18s;
  }

  html:not(.sb-shut) .sb { transform: none; }

  /* The wide rule collapses a shut panel to \`width: 0\` and outranks a bare
     \`.sb\` in here, which produced a one-pixel panel whose contents spilled out
     and intercepted every click on the toggle. The shut state restates the
     width so the transform is what moves the panel off screen. */
  html.sb-shut .sb { width: min(21rem, 86vw); flex-basis: auto; overflow-y: auto; }

  /* A transform moves the panel out of sight and leaves every control inside it
     in the tab order, so the first Tab from a shut page landed on the workspace
     switcher inside an invisible panel. Visibility takes it out of the
     sequence, delayed on the way out so the slide still shows. */
  html.sb-shut .sb { visibility: hidden; transition: transform 0.18s, visibility 0s linear 0.18s; }
  html:not(.sb-shut) .sb { visibility: visible; transition: transform 0.18s, visibility 0s; }

  .sb-grip { display: none; }

  /* The panel covers the masthead and the toggle that opened it, so it carries
     its own way out rather than leaving the scrim as the only route on a phone.
     It carries no border, at 1.75rem to match \`.sb-fold\` and \`.theme\`, which also clears
     the 24 pixel pointer target floor. */
  .sb-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0.55rem;
    right: 0.6rem;
    z-index: 61;
    appearance: none;
    width: 1.75rem;
    height: 1.75rem;
    font: inherit;
    font-size: var(--t5);
    line-height: 1;
    color: var(--color-muted);
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
  }

  .sb-close:hover { color: var(--color-text); background: var(--color-chrome); }

  .sb-scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 55;
    background: rgb(0 0 0 / 45%);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.18s;
  }

  html:not(.sb-shut) .sb-scrim { opacity: 1; pointer-events: auto; }
}

@media (prefers-reduced-motion: reduce) {
  .sb, .sb-scrim, .sb-grip::before { transition: none; }
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
    '--t1',
    '--t2',
    '--t3',
    '--t4',
    '--t5',
    '--t6',
  ],
  rules: `/* ---- Type ---- */

h1 {
  font-size: var(--t1);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.022em;
  margin: 0 0 0.55rem;
  text-wrap: balance;
}

h2 {
  font-size: var(--t2);
  line-height: 1.3;
  font-weight: 700;
  letter-spacing: -0.012em;
  margin: 3rem 0 0.85rem;
}

h3 { font-size: var(--t3); line-height: 1.55; font-weight: 700; margin: 1.9rem 0 0.4rem; }

p { margin: 0 0 1.15rem; }

.lede {
  font-size: var(--t3);
  line-height: 1.55;
  color: var(--color-text-secondary);
  margin-bottom: 2rem;
}

a { color: var(--color-accent); }

em { font-style: italic; }

/* ---- Panels ---- */

.assumes, .progress {
  font-size: var(--t5);
  line-height: 1.6;
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
  letter-spacing: 0;
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
  line-height: 1.6;
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
  font-size: var(--t3);
  color: var(--color-accent);
  display: block;
  margin-bottom: 0.35rem;
}

.hard p:last-child { margin-bottom: 0; }

/* ---- Tables ---- */

table { width: 100%; border-collapse: collapse; font-size: var(--t4); margin: 0 0 1.5rem; }
th, td { text-align: right; padding: 0.55rem 0.7rem; border-bottom: 1px solid var(--color-border); }
th:first-child, td:first-child { text-align: left; }

th {
  font-weight: 700;
  font-size: var(--t5);
  letter-spacing: 0;
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
.toc .num { font-family: var(--teach-mono); font-size: var(--t5); color: var(--color-muted); }
.toc b { font-size: var(--t3); font-weight: 700; letter-spacing: -0.012em; }

.toc .blurb {
  grid-column: 2;
  font-size: var(--t4);
  line-height: 1.55;
  color: var(--color-text-secondary);
  margin-top: 0.1rem;
}

/* A word, not a pill and not a dot. A mark reading the same on every live row
   reports nothing, so the dot retired here as it did from the jump menus.
   Sentence case and no tracking, per the UI copy rule. */
.toc .state {
  font-size: var(--t5);
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: var(--color-muted);
  white-space: nowrap;
}

/* A link leaving the page says so with a mark beside it rather than with a
   badge spelling out the sentence. */
.toc .ext {
  font-size: var(--t4);
  color: var(--color-muted);
  margin-left: 0.35rem;
}

.toc a:hover .ext { color: var(--color-accent); }

ol.succ {
  margin: 0 0 2.5rem;
  padding-left: 1.35rem;
  font-size: var(--t4);
  line-height: 1.55;
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
  font-size: var(--t5);
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
    '--t6',
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
  box-sizing: border-box;
  width: 100%;
  text-align: left;
  color: inherit;
  line-height: 1.45;
  box-shadow: var(--teach-shadow);
}

.opt::before {
  content: attr(data-k);
  font-family: var(--teach-mono);
  font-size: var(--t6);
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
  content: "Your answer";
  margin-left: auto;
  font-size: var(--t6);
  font-weight: 700;
  letter-spacing: 0;
  color: var(--color-muted);
  align-self: center;
}

.opt[data-state="right"]::after {
  content: "Correct";
  margin-left: auto;
  font-size: var(--t6);
  font-weight: 700;
  letter-spacing: 0;
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

/* No border, sitting on the page ground, with the count beside it. The border and the
   reading surface are what made the control look like something to fill in,
   and the count is what says it filters the list under it. */
.filter-row {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin: 0 0 1rem;
}

.filter {
  flex: 1;
  min-width: 0;
  font-family: var(--teach-sans);
  font-size: var(--t4);
  color: var(--color-text-body);
  background: transparent;
  border: 0;
  padding: 0.3rem 0;
}

.filter-count {
  font-family: var(--teach-mono);
  font-size: var(--t5);
  color: var(--color-muted);
  white-space: nowrap;
}

/* The \`:where(...)\` focus token has zero specificity, so a \`.filter:focus\`
   rule outranks it and leaves a keyboard reaching the control with no ring.
   The ring stays the token's and only the pointer ring is dropped. */
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
  letter-spacing: 0;
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
  line-height: 1.55;
  color: var(--color-text-secondary);
}

ol.succ li { margin-bottom: 0.4rem; }
.toc li.soon b { color: var(--color-muted); font-weight: 400; }

/* A filter that matches nothing needs a way back, not just a sentence. */
.gloss .empty .clear {
  font-family: var(--teach-sans);
  font-size: var(--t4);
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
    'The in-lesson outline, folded under the lesson being read in the course',
    'sidebar. It used to be a fixed rail in the gutter the reading measure left',
    'over, which reported the same thing twice once the sidebar carried the',
    'course and disappeared entirely below 1420px.',
  ].join('\n   '),
  reads: ['--color-text', '--color-text-secondary', '--color-accent', '--t6'],
  rules: `/* ---- In-lesson outline, folded under the lesson being read ---- */

/* The rail this replaces was \`position: fixed\` in the right-hand gutter, which
   only existed above 1420px and reported nothing at all below it. Folding the
   headings under the current lesson puts the course and the lesson in one
   column, so a reader tracks both in one place at any window width. */
.sb-out { list-style: none; margin: 0.1rem 0 0.55rem; padding: 0 0 0 1.45rem; }

.sb-out a {
  display: block;
  padding: 0.18rem 0.5rem;
  text-decoration: none;
  color: var(--color-text-secondary);
  font-size: var(--t6);
}

.sb-out a:hover { color: var(--color-text); }
.sb-out a.on { color: var(--color-accent); }`,
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
    '--t6',
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
  font-size: var(--t6);
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
  line-height: 1.6;
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
