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

import { readTemplate } from '@/design/template'

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
  rules: readTemplate('status.css'),
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
  rules: readTemplate('scrollbar.css'),
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
  rules: readTemplate('hand-drawn-figure.css'),
}

export const COMPONENTS: readonly Component[] = [
  STATUS,
  SCROLLBAR,
  HAND_DRAWN_FIGURE,
]
