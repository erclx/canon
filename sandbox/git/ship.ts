import { type StageContext, scenario } from '@/sandbox/scenario'

/** Both arms ship the same draft branch and differ only in whether a changelog exists. */
function stageDraft(ctx: StageContext): void {
  ctx.anchorRemote()

  ctx.fixtures('git', 'ship', 'shared', '01-init')

  ctx.write('src/server.js', 'export const PORT = 8080;\n')

  ctx.write('.gitignore', 'node_modules\n.canon/plans/\n.canon/review/\n')

  ctx.git('add', '.')
  ctx.commit('chore(project): init')

  ctx.git('push', '--force', 'origin', 'HEAD:main')
  ctx.run('git', ['push', 'origin', '--delete', 'draft/init', '-q'], {
    stderr: 'ignore',
    allowFailure: true,
  })

  ctx.git('checkout', '-b', 'draft/init', '-q')

  ctx.fixtures('git', 'ship', 'shared', '02-draft')

  ctx.write(
    'src/routes/health.js',
    'export function register(app) { app.get("/health", () => healthCheck()); }\n',
  )
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  anchor: true,
  arms: {
    'without-changelog': (ctx) => {
      stageDraft(ctx)

      ctx.log.step('Scenario ready: without changelog')
      ctx.log.info(
        'Context: draft/init branch, port changed to 3000, health check added, README stale, no CHANGELOG.md',
      )
      ctx.log.info('Action:  /git:ship')
      ctx.log.info(
        'Expect:  the verify gate finds no command named and says so rather than stopping,',
      )
      ctx.log.info(
        '         then README updated, changes committed, branch renamed, PR opened, changelog step skipped',
      )
    },
    'with-changelog': (ctx) => {
      stageDraft(ctx)
      ctx.write(
        'CHANGELOG.md',
        '# Changelog\n\n## [0.1.0]\n\n- Initial release\n',
      )

      ctx.log.step('Scenario ready: with changelog')
      ctx.log.info(
        'Context: draft/init branch, port changed to 3000, health check added, README stale, CHANGELOG.md present',
      )
      ctx.log.info('Action:  /git:ship')
      ctx.log.info(
        'Expect:  the verify gate finds no command named and says so rather than stopping,',
      )
      ctx.log.info(
        '         then README updated, changes committed, branch renamed, PR opened, changelog appended',
      )
    },
  },
})
