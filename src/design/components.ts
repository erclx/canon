/**
 * The component layer, beside the token layer in `@/design/tokens`.
 *
 * A token says what a value is and a component says what a repeated piece of
 * interface is made of. The two repairs that produced this layer are both cases
 * where the tokens were already right and the surface still read as unrelated
 * to itself, so a token file alone would not have caught either.
 *
 * `COMPONENTS` is the generic default every project installing the `design`
 * domain receives. A caller wanting a different set passes an explicit list to
 * `buildDesignCss`'s `components` option, which takes
 * `boolean | readonly Component[]` for that reason.
 *
 * It does not live in `canon/DESIGN.md`. `claude/skills/design-record/references/design.md` keeps CSS class
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
 * Per `.canon/groundwork/86-portable-hand-drawn-figures/06-decision.md` item 4,
 * any project can draw one hand-drawn-styled figure. It declares its own
 * `--figure-hand` and `--figure-wide` defaults rather than reading custom
 * properties another component would have to declare.
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
