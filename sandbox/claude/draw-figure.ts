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
