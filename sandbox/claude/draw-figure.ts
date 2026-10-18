import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    'graph-shaped': (ctx) => {
      ctx.fixtures('claude', 'draw-figure', 'graph-shaped', '01-initial')

      ctx.git('add', '.')
      ctx.commit('docs: add onboarding page with no figure')

      ctx.log.step('Scenario ready: draft a graph-shaped figure')
      ctx.log.info(
        'Context: docs/onboarding.md states a three-state account path in prose alone',
      )
      ctx.log.info(
        'Action:  /canon:draw-figure the account signup-to-active path in docs/onboarding.md',
      )
      ctx.log.info(
        'Expect:  render path decided as Mermaid, since the subject is already a path a flowchart expresses',
      )
      ctx.log.info(
        'Expect:  a rendered SVG under the hand-drawn look with the Virgil/Excalifont stack, no literal hex colors',
      )
      ctx.log.info(
        'Expect:  a PNG read back and judged before the figure is confirmed',
      )
      ctx.log.info(
        'Expect:  <figure> and <figcaption> wrapping the drawing in docs/onboarding.md',
      )
      ctx.log.info(
        'Manual leg: whether the rendered picture actually matches the three-state path cannot be asserted here',
      )
    },
    'not-graph-shaped': (ctx) => {
      ctx.fixtures('claude', 'draw-figure', 'not-graph-shaped', '01-initial')

      ctx.git('add', '.')
      ctx.commit('docs: add layout page with no figure')

      ctx.log.step('Scenario ready: draft a freehand figure')
      ctx.log.info(
        'Context: docs/layout.md describes a spatial card arrangement, not a graph',
      )
      ctx.log.info(
        'Action:  /canon:draw-figure the four-card rotated grid in docs/layout.md',
      )
      ctx.log.info(
        'Expect:  render path decided as freehand, since a flowchart cannot express a rotated spatial layout',
      )
      ctx.log.info(
        'Expect:  hand-authored inline SVG, no external renderer invoked, no literal hex colors',
      )
      ctx.log.info(
        'Expect:  role="img" with an aria-label or aria-labelledby on the drawing',
      )
      ctx.log.info(
        'Expect:  <figure> and <figcaption> wrapping the drawing in docs/layout.md',
      )
      ctx.log.info(
        'Manual leg: whether the freehand drawing actually reads as the intended layout cannot be asserted here',
      )
    },
    'teach-lesson': (ctx) => {
      // A rendered lesson page rather than markdown, since the in-page capture needs a
      // page to load. The stylesheet defines the custom properties a figure colors
      // through, and the hand font is what Mermaid cannot measure. The body face is
      // one every machine resolves, since `canon capture` refuses a page whose figure
      // inherits a family the machine lacks.
      ctx.fixtures('claude', 'draw-figure', 'teach-lesson', '01-initial')

      ctx.log.step(
        'Scenario ready: draft a graph-shaped figure into a teach lesson',
      )
      ctx.log.info(
        'Context: .canon/teach/01-orders/lessons/0001-order-states.html states a',
      )
      ctx.log.info(
        '  four-state order path in prose, with a refund branch, and draws nothing',
      )
      ctx.log.info(
        '  The subject is graph-shaped, so outside a lesson it routes through Mermaid',
      )
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:draw-figure the order path from placed to delivered, with the',
      )
      ctx.log.info(
        '         refund branch, in .canon/teach/01-orders/lessons/0001-order-states.html,',
      )
      ctx.log.info(
        '         ahead of the quiz. Write it without waiting for a confirmation.',
      )
      ctx.log.info(
        'Expect:  declared in fixtures/claude/draw-figure/teach-lesson/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:draw-figure teach-lesson',
      )
      ctx.log.info(
        '         Render path decided as freehand because the destination is a teach lesson',
      )
      ctx.log.info(
        '         No Mermaid source or config under .canon/tmp/figures/',
      )
      ctx.log.info(
        '         The figure captured inside the lesson with canon capture --selector figure',
      )
      ctx.log.info(
        "         <figure>, <figcaption>, and an inline SVG colored through the lesson's",
      )
      ctx.log.info('         custom properties, placed ahead of the quiz')
    },
    'architecture-set': (ctx) => {
      // A small two-folder project with its requirements record and one context
      // entry to draw into. The request names an architecture view, so the run
      // shapes it through the architecture set and renders it through Mermaid,
      // landing it in the entry rather than in a per-kind diagrams folder.
      ctx.fixtures('claude', 'draw-figure', 'architecture-set', '01-initial')

      ctx.git('add', '.')
      ctx.commit('docs: add components entry with no figure')

      ctx.log.step(
        'Scenario ready: draft an architecture view into a named entry',
      )
      ctx.log.info(
        'Context: canon/REQUIREMENTS.md and the context index describe a',
      )
      ctx.log.info('  four-layer web, agent, API, and SQLite app')
      ctx.log.info(
        '  canon/context/components.md states the layers in prose and draws nothing',
      )
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:draw-figure the components view in canon/context/components.md,',
      )
      ctx.log.info(
        '         below the opening paragraph. Write it without waiting for a confirmation.',
      )
      ctx.log.info(
        'Expect:  declared in fixtures/claude/draw-figure/architecture-set/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:draw-figure architecture-set',
      )
      ctx.log.info(
        '         Render path decided as architecture, drawn from canon/context/index.md and the folder layout',
      )
      ctx.log.info(
        '         A rendered SVG inside <figure> and <figcaption> in the entry',
      )
      ctx.log.info('         Nothing written under .canon/diagrams/')
    },
  },
})
