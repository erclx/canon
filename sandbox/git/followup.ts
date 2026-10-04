import { type StageContext, scenario } from '@/sandbox/scenario'

const BRANCH = 'feat/utils-followup'

/** The anchor is shared, so every arm resets the branch and any pull request an earlier run left. */
function resetRemote(ctx: StageContext): void {
  ctx.anchorRemote()
  ctx.git('branch', '-M', 'main')

  ctx.git('push', '--force', 'origin', 'HEAD:main', '-q')
  ctx.run('git', ['push', 'origin', '--delete', BRANCH, '-q'], {
    stderr: 'ignore',
    allowFailure: true,
  })
  const open = ctx.read(
    'gh',
    [
      'pr',
      'list',
      '--head',
      BRANCH,
      '--state',
      'open',
      '--json',
      'number',
      '-q',
      '.[].number',
    ],
    { stderr: 'ignore', allowFailure: true },
  )
  for (const number of open.split('\n').filter((n) => n.trim() !== ''))
    ctx.run('gh', ['pr', 'close', number, '-d', '-c', 'scenario reset'], {
      stdout: 'ignore',
      stderr: 'ignore',
      allowFailure: true,
    })
}

/** Opens the pull request every PR-holding arm starts from and returns what `gh` printed. */
function openLowercasePullRequest(ctx: StageContext): string {
  ctx.git('checkout', '-b', BRANCH, '-q')

  ctx.fixtures('git', 'followup', 'shared', '01-lowercase')
  ctx.git('add', 'utils.js')
  ctx.commit('feat(utils): add lowercase helper')
  ctx.git('push', '-u', 'origin', BRANCH, '-q')

  return ctx.read('gh', [
    'pr',
    'create',
    '--title',
    'feat(utils): add lowercase helper',
    '--body',
    'Adds lowercase helper to utils.',
    '--head',
    BRANCH,
    '--base',
    'main',
  ])
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  anchor: true,
  arms: {
    'open-pr': (ctx) => {
      resetRemote(ctx)
      openLowercasePullRequest(ctx)

      ctx.fixtures('git', 'followup', 'open-pr', '02-trim')

      ctx.log.step('Scenario ready: open PR with one followup edit')
      ctx.log.info(
        'Context: feat/utils-followup tracks origin, PR open, unstaged trim() addition',
      )
      ctx.log.info('Action:  /git-followup')
      ctx.log.info(
        'Expect:  stage -> commit -> push -> PR body updated to mention trim helper',
      )
    },
    'review-comment': (ctx) => {
      resetRemote(ctx)
      const created = openLowercasePullRequest(ctx)
      const number =
        /(\d+)\s*$/.exec(created)?.[1] ??
        ctx.fail(`gh pr create printed no number: ${created}`)

      const line =
        ctx
          .readFile('utils.js')
          .split('\n')
          .findIndex((l) => l.includes('toLowerCase')) + 1
      const head = ctx.read('git', ['rev-parse', 'HEAD']).trim()
      ctx.run(
        'gh',
        [
          'api',
          `repos/{owner}/{repo}/pulls/${number}/comments`,
          '-f',
          'body=Guard against a null argument here.',
          '-f',
          `commit_id=${head}`,
          '-f',
          'path=utils.js',
          '-F',
          `line=${line === 0 ? '' : line}`,
          '-f',
          'side=RIGHT',
        ],
        { stdout: 'ignore' },
      )

      ctx.fixtures('git', 'followup', 'review-comment', '02-lowercase-safe')

      ctx.log.step(
        'Scenario ready: open PR with a review comment and an unstaged fix',
      )
      ctx.log.info(
        'Context: feat/utils-followup tracks origin, PR open with one review comment, unstaged null-guard addition',
      )
      ctx.log.info('Action:  /git-followup')
      ctx.log.info(
        'Expect:  stage -> commit -> push -> reply comment posted on the PR',
      )
    },
    'no-pr-guard': (ctx) => {
      resetRemote(ctx)
      ctx.git('checkout', '-b', BRANCH, '-q')
      ctx.git('commit', '--allow-empty', '-m', 'chore: bootstrap branch', '-q')
      ctx.git('push', '-u', 'origin', BRANCH, '-q')
      ctx.append('utils.js', '// followup\n')

      ctx.log.step('Scenario ready: branch tracks origin but no open PR')
      ctx.log.info(
        'Context: feat/utils-followup pushed, no PR opened, unstaged edit',
      )
      ctx.log.info('Action:  /git-followup')
      ctx.log.info('Expect:  no-PR guard fires, suggests git-ship instead')
    },
    'main-guard': (ctx) => {
      resetRemote(ctx)
      ctx.append('utils.js', '// stray edit\n')

      ctx.log.step('Scenario ready: changes on main')
      ctx.log.info('Context: user is on main with unstaged changes')
      ctx.log.info('Action:  /git-followup')
      ctx.log.info('Expect:  guard fires, refuses to ship from main')
    },
  },
})
