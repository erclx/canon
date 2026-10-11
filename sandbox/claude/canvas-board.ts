import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  prepare: (ctx) => {
    ctx.log.step('Canvas board sandbox')
    ctx.log.info(
      'open: a project with the design stylesheet installed and no canvas yet',
    )
    ctx.log.info('')
    ctx.log.info(
      'Invoke the prefixed form. The dev-skill injection copies SKILL.md alone,',
    )
    ctx.log.info(
      'so the unprefixed copy cannot resolve the bundled references/canvas.md.',
    )
    ctx.log.info(
      'Launch with: claude --plugin-dir <worktree-root>/claude --model sonnet',
    )
  },
  arms: {
    open: (ctx) => {
      ctx.fixtures('claude', 'canvas-board', 'open', '01-project')

      // Installed rather than staged, so the frames resolve the same token sheet
      // a target receives and the arm reads no copy that drifts from the source.
      ctx.run('canon', ['design', 'install', '.'], { stdout: 'ignore' })

      ctx.git('add', '.')
      ctx.commit('feat(plans): list the pricing tiers')

      ctx.log.step(
        'Scenario ready: canvas-board draws a first frame from nothing',
      )
      ctx.log.info(
        'Context: no canvas server is running and .canon/canvas/ does not exist',
      )
      ctx.log.info(
        '  The project carries .claude/design/base.css, so a frame has tokens',
      )
      ctx.log.info(
        '  to draw with, and src/index.ts names three pricing tiers to draw',
      )
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:canvas-board draw the pricing tiers from src/index.ts as one',
      )
      ctx.log.info(
        '         frame named pricing on a page named drafts, then capture it',
      )
      ctx.log.info(
        'Expect:  declared in fixtures/claude/canvas-board/open/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:canvas-board open',
      )
      ctx.log.info(
        '         The session starts the server before writing the frame and',
      )
      ctx.log.info(
        '         checks the shell at the address it printed. A frame at',
      )
      ctx.log.info(
        '         .canon/canvas/drafts/pricing.html drawn with var(--...)',
      )
      ctx.log.info(
        '         tokens, its box in drafts/layout.json, and the reply naming',
      )
      ctx.log.info(
        '         the canvas address. The frame is marked as being edited',
      )
      ctx.log.info('         before the write and cleared after, leaving')
      ctx.log.info(
        '         .canon/canvas/editing.json empty. Nothing written outside .canon/.',
      )
    },
  },
})
