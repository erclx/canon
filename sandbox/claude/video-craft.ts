import { scenario } from '@/sandbox/scenario'

/**
 * A recorded take with its timeline beside it and a wrap section asking for an
 * intro and a music bed, so a correct composition has a click and a fill to
 * zoom on, captions to place against real target boxes, and a bed level to
 * pick. No recording is staged, so the arm judges the composition source and
 * never renders.
 */
export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      ctx.fixtures('claude', 'video-craft', 'compose', '01-initial')

      ctx.git('add', '.')
      ctx.commit('feat(demo): cold-open draft, plan, and take timeline')

      ctx.log.step(
        'Scenario ready: compose a take into a designed video (video-craft)',
      )
      ctx.log.info(
        'Context: demos/cold-open/beats.md asks for an intro and a music bed, and',
      )
      ctx.log.info(
        '         demos/cold-open/take/cold-open.timeline.json carries a fill and a',
      )
      ctx.log.info(
        '         click with their target boxes. The webm itself is not staged.',
      )
      ctx.log.info(
        'Action:  /canon:video-craft Compose demos/cold-open/take/cold-open.webm into',
      )
      ctx.log.info(
        '         demos/cold-open/index.html with the captions and zooms the beats',
      )
      ctx.log.info(
        '         name. Write the composition only and do not render.',
      )
      ctx.log.info(
        'Expect:  declared in fixtures/claude/video-craft/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:video-craft',
      )
      ctx.log.info('')
      ctx.log.info(
        "The craft judgments sit under manual, read against the timeline's",
      )
      ctx.log.info("entries rather than the plan's holds.")
    },
  },
})
