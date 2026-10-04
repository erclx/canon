import { type StageContext, scenario } from '@/sandbox/scenario'

/**
 * No mock standards folder. A target holds none, so `docs-sync` reaches the
 * standards it reads through `canon standards <name>` here as it would anywhere.
 */
function stageBase(ctx: StageContext): void {
  ctx.fixtures('docs', 'sync', 'shared', 'base')
  ctx.git('add', '.')
  ctx.commit('feat(server): add base config and start function')
}

function commitAll(ctx: StageContext, subject: string): void {
  ctx.git('add', '.')
  ctx.commit(subject)
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  arms: {
    feature: (ctx) => {
      stageBase(ctx)
      ctx.git('checkout', '-b', 'feature/drift', '-q')

      ctx.fixtures('docs', 'sync', 'feature', '01-debug-port')

      commitAll(
        ctx,
        'feat(server): change port to 3000 and add debug parameter',
      )

      ctx.log.step('Scenario ready: feature change')
      ctx.log.info(
        'Context: port changed to 3000, new debug parameter on start()',
      )
      ctx.log.info('Action:  /canon:docs-sync')
      ctx.log.info(
        'Expect:  README updated to reflect port 3000 and debug parameter',
      )
    },
    chore: (ctx) => {
      stageBase(ctx)
      ctx.git('checkout', '-b', 'chore/noise', '-q')

      // The bash form ran `sed 's/Starting.../.../g'`, whose dots match any character.
      const server = ctx.readFile('src/server.ts')
      ctx.write(
        'src/server.ts',
        server.replace(/Starting.../g, 'Server is booting up...'),
      )
      commitAll(ctx, 'chore(server): update console log messages')

      ctx.log.step('Scenario ready: internal change')
      ctx.log.info(
        'Context: console log message changed, no user-facing API impact',
      )
      ctx.log.info('Action:  /canon:docs-sync')
      ctx.log.info('Expect:  no documentation updates required')
    },
    noop: (ctx) => {
      stageBase(ctx)
      ctx.git('checkout', '-b', 'test/server-unit-tests', '-q')

      ctx.fixtures('docs', 'sync', 'noop', '01-test')

      commitAll(ctx, 'test(server): add unit tests for start function')

      ctx.log.step('Scenario ready: no-op')
      ctx.log.info(
        'Context: test file added, no changes to public API or user-facing behavior',
      )
      ctx.log.info('Action:  /canon:docs-sync')
      ctx.log.info(
        'Expect:  preview shows Files: None, no documentation updates required',
      )
    },
  },
})
