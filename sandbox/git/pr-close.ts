import { type StageContext, scenario } from '@/sandbox/scenario'

const BRANCH = 'feat/utils-close'

/** The anchor is shared, so every arm resets the branch and any pull request an earlier run left. */
function resetRemote(ctx: StageContext): void {
  ctx.anchorRemote()
  ctx.git('branch', '-M', 'main')

  ctx.git('push', '--force', 'origin', 'HEAD:main', '-q')
  ctx.run('git', ['push', 'origin', '--delete', BRANCH, '-q'], {
    stderr: 'ignore',
    allowFailure: true,
  })
}

/** Opens the pull request every arm closes and returns its number. */
function openPullRequest(ctx: StageContext): string {
  ctx.git('checkout', '-b', BRANCH, '-q')
  ctx.git('commit', '--allow-empty', '-m', 'feat(utils): add a helper', '-q')
  ctx.git('push', '-u', 'origin', BRANCH, '-q')

  const created = ctx.read('gh', [
    'pr',
    'create',
    '--title',
    'feat(utils): add a helper',
    '--body',
    'Adds a helper to utils.',
    '--head',
    BRANCH,
    '--base',
    'main',
  ])
  return (
    /(\d+)\s*$/.exec(created)?.[1] ??
    ctx.fail(`gh pr create printed no number: ${created}`)
  )
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  anchor: true,
  arms: {
    'with-reason': (ctx) => {
      resetRemote(ctx)
      const number = openPullRequest(ctx)

      ctx.log.step('Scenario ready: one open PR to close for a stated reason')
      ctx.log.info(`Context: ${BRANCH} has open PR #${number}`)
      ctx.log.info(
        `Action:  /git-pr-close close #${number}, the helper is no longer needed`,
      )
      ctx.log.info(
        'Expect:  reason file written -> canon pr close -> comment, close, branch deleted',
      )
    },
    'no-reason-guard': (ctx) => {
      resetRemote(ctx)
      const number = openPullRequest(ctx)

      ctx.log.step('Scenario ready: one open PR and no reason given')
      ctx.log.info(`Context: ${BRANCH} has open PR #${number}`)
      ctx.log.info(`Action:  /git-pr-close close #${number}`)
      ctx.log.info('Expect:  guard fires asking why, nothing is closed')
    },
  },
})
