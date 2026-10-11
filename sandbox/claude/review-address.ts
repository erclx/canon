import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { type StageContext, scenario } from '@/sandbox/scenario'

/** Empties the tree the anchor staged, `.git` aside, so the arm starts clean. */
function wipeTree(ctx: StageContext): void {
  ctx.run('find', [
    '.',
    '-maxdepth',
    '1',
    '!',
    '-name',
    '.git',
    '!',
    '-name',
    '.',
    '-exec',
    'rm',
    '-rf',
    '{}',
    '+',
  ])
}

function seedBaseTree(ctx: StageContext): void {
  wipeTree(ctx)

  ctx.write(
    '.gitignore',
    'node_modules\n.canon/plans/\n.canon/review/\n.canon/tmp/\n',
  )

  ctx.fixtures('claude', 'review-address', 'shared', '01-base-tree')

  ctx.run('bash', ['scripts/regen-index.sh'])
}

function startFeatureBranch(ctx: StageContext): void {
  ctx.run('git', ['push', 'origin', '--delete', 'feat/create-endpoint', '-q'], {
    stderr: 'ignore',
    allowFailure: true,
  })
  ctx.git('checkout', '-b', 'feat/create-endpoint', '-q')

  ctx.fixtures('claude', 'review-address', 'shared', '02-create-handler')

  ctx.git('add', '.')
  ctx.commit('feat(api): add create handler')
}

function openPullRequest(
  ctx: StageContext,
  body = 'Adds the POST /tasks handler for v0.1.',
): void {
  ctx.git('push', '--force', 'origin', 'HEAD', '-q')

  // The view stands in for a create that failed because the pull request
  // already exists, so a missing one stops the arm as the bash form did.
  let prUrl = ctx
    .read(
      'gh',
      [
        'pr',
        'create',
        '--draft',
        '--title',
        'feat(api): add create handler',
        '--body',
        body,
        '--head',
        'feat/create-endpoint',
        '--base',
        'main',
      ],
      { stderr: 'ignore', allowFailure: true },
    )
    .trim()
  if (prUrl === '')
    prUrl = ctx
      .read(
        'gh',
        ['pr', 'view', 'feat/create-endpoint', '--json', 'url', '-q', '.url'],
        { stderr: 'ignore' },
      )
      .trim()

  // Seed a review finding the worker must address.
  const status = ctx.run(
    'gh',
    [
      'pr',
      'review',
      prUrl,
      '--comment',
      '--body',
      '1 should-fix. src/tasks.ts: handleCreate does not reject an empty title. Add a guard before createTask.',
    ],
    { allowFailure: true },
  )
  if (status !== 0)
    ctx.log.info('Could not seed review; post one manually before testing.')
}

export default scenario({
  anchor: true,
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
  },
  prepare: (ctx) => {
    ctx.log.info(
      'findings  : open PR with one should-fix finding, branch still merges',
    )
    ctx.log.info(
      'stale     : same PR, plus a sibling merged into main the branch conflicts with',
    )
    ctx.log.info(
      'body-sync : same PR, the fix invalidates a claim the body itself makes',
    )
    ctx.log.info(
      "stale-head: same PR, a commit pushed after it opened, so the object's head trails the tip",
    )
  },
  arms: {
    findings: (ctx) => {
      ctx.log.step(
        `Configuring address-review environment (${ctx.env.ANCHOR_REPO})`,
      )
      ctx.anchorRemote()
      seedBaseTree(ctx)
      ctx.git('add', '.')
      ctx.git(
        'commit',
        '--allow-empty',
        '-m',
        'feat(api): task list endpoint',
        '--no-verify',
        '-q',
      )
      ctx.git('push', '--force', 'origin', 'HEAD:main')
      startFeatureBranch(ctx)
      openPullRequest(ctx)

      ctx.log.step('Scenario ready: worker addresses a posted PR review')
      ctx.log.info(
        'Context: open PR on feat/create-endpoint with one should-fix review finding posted',
      )
      ctx.log.info('Action:  /review-address')
      ctx.log.info(
        'Expect:  reads the finding, adds the empty-title guard, verify passes',
      )
      ctx.log.info(
        '         refreshes the now-stale canon/context/api.md validation line',
      )
      ctx.log.info(
        '         pushes a follow-up commit, then posts a summary reply comment, does NOT merge',
      )
      ctx.log.info(
        '         once CI goes green, edits that reply in place for the closing confirmation',
      )
      ctx.log.info('         rather than posting it as a second comment')
    },
    stale: (ctx) => {
      ctx.log.step(
        `Configuring address-review environment (${ctx.env.ANCHOR_REPO})`,
      )
      ctx.anchorRemote()
      seedBaseTree(ctx)
      ctx.git('add', '.')
      ctx.git(
        'commit',
        '--allow-empty',
        '-m',
        'feat(api): task list endpoint',
        '--no-verify',
        '-q',
      )
      ctx.git('push', '--force', 'origin', 'HEAD:main')
      const baseCommit = ctx.read('git', ['rev-parse', 'HEAD']).trim()
      startFeatureBranch(ctx)

      ctx.fixtures('claude', 'review-address', 'stale', '01-handlers')

      ctx.run('bash', ['scripts/regen-index.sh'])

      ctx.fixtures('claude', 'review-address', 'stale', '02-api-link')

      ctx.git('add', '.')
      ctx.commit('docs(context): record the handler request shape')

      openPullRequest(ctx)

      // The sibling lands on main after the PR opens, which is what makes the branch stale.
      ctx.git('checkout', '-q', '-B', 'sibling', baseCommit)

      ctx.fixtures('claude', 'review-address', 'stale', '03-limits')

      ctx.run('bash', ['scripts/regen-index.sh'])

      ctx.fixtures('claude', 'review-address', 'stale', '04-api-limiter')

      ctx.git('add', '.')
      ctx.commit('feat(api): rate limit the task endpoints')
      ctx.git('push', '--force', 'origin', 'HEAD:main')
      ctx.git('checkout', 'feat/create-endpoint', '-q')

      ctx.log.step(
        'Scenario ready: worker rebases a branch that went stale during review',
      )
      ctx.log.info(
        'Context: open PR on feat/create-endpoint with one should-fix review finding posted',
      )
      ctx.log.info(
        '  A sibling landed on main after the PR opened, touching the same two files',
      )
      ctx.log.info(
        '  canon/context/api.md conflicts and both sides are content worth keeping',
      )
      ctx.log.info(
        '  canon/context/index.md conflicts and bun run check rebuilds it',
      )
      ctx.log.info('')
      ctx.log.info('Action:  /review-address')
      ctx.log.info(
        'Expect:  addresses the finding first, then detects the branch no longer merges',
      )
      ctx.log.info(
        '         rebases onto origin/main rather than merging main into the branch',
      )
      ctx.log.info(
        '         keeps both the handler and rate-limit sentences in api.md',
      )
      ctx.log.info(
        '         leaves index.md to bun run check, which lists api, handlers, and limits',
      )
      ctx.log.info(
        '         force-pushes once and names the rebase in the reply comment',
      )
    },
    'body-sync': (ctx) => {
      ctx.log.step(
        `Configuring address-review environment (${ctx.env.ANCHOR_REPO})`,
      )
      ctx.anchorRemote()
      seedBaseTree(ctx)
      ctx.git('add', '.')
      ctx.git(
        'commit',
        '--allow-empty',
        '-m',
        'feat(api): task list endpoint',
        '--no-verify',
        '-q',
      )
      ctx.git('push', '--force', 'origin', 'HEAD:main')
      startFeatureBranch(ctx)

      // Command substitution drops trailing newlines, so the body does too.
      const staleBody = readFileSync(
        join(
          ctx.root,
          'sandbox/fixtures/claude/review-address/body-sync/stdin/pr-body.md.fixture',
        ),
        'utf8',
      ).replace(/\n+$/, '')

      openPullRequest(ctx, staleBody)

      ctx.log.step(
        "Scenario ready: the review fix invalidates the PR body's own claim",
      )
      ctx.log.info(
        'Context: open PR body says the handler takes any title with no validation',
      )
      ctx.log.info(
        '  the posted finding asks for exactly the guard that claim says does not exist',
      )
      ctx.log.info('Action:  /review-address')
      ctx.log.info('Expect:  adds the empty-title guard, verify passes')
      ctx.log.info(
        '         git-followup syncs the PR body so it no longer claims no validation runs',
      )
      ctx.log.info(
        '         pushes a follow-up commit, then posts a summary reply comment, does NOT merge',
      )
    },
    'stale-head': (ctx) => {
      ctx.log.step(
        `Configuring address-review environment (${ctx.env.ANCHOR_REPO})`,
      )
      ctx.anchorRemote()
      seedBaseTree(ctx)
      ctx.git('add', '.')
      ctx.git(
        'commit',
        '--allow-empty',
        '-m',
        'feat(api): task list endpoint',
        '--no-verify',
        '-q',
      )
      ctx.git('push', '--force', 'origin', 'HEAD:main')
      startFeatureBranch(ctx)
      openPullRequest(ctx)

      const objectHead = ctx.read('git', ['rev-parse', 'HEAD']).trim()

      // A second commit pushed after the pull request opened. The object keeps
      // naming the commit it was created against for up to a minute, which is the
      // window every head-sensitive read here has to survive.
      ctx.fixtures('claude', 'review-address', 'stale-head', '01-list-handler')

      ctx.git('add', '.')
      ctx.commit('feat(api): add list handler')
      ctx.git('push', '--force', 'origin', 'HEAD', '-q')

      ctx.log.step(
        "Scenario ready: the pull request object's head trails the branch tip",
      )
      ctx.log.info(
        'Context: open PR on feat/create-endpoint with one should-fix review finding posted',
      )
      ctx.log.info('  a second commit was pushed after the PR opened')
      ctx.log.info(
        `  the object was created against ${objectHead} and the remote now carries ${ctx.read('git', ['rev-parse', 'HEAD']).trim()}`,
      )
      ctx.log.info('')
      ctx.log.info('Action:  /review-address')
      ctx.log.info(
        'Expect:  reads CI with canon pr checks --json rather than gh pr checks',
      )
      ctx.log.info(
        '         reads the review over gh api reviews and issues/comments, posts the reply with an issues/comments POST, no gh pr call',
      )
      ctx.log.info(
        "         the record's tip is the remote's head, not the object's headRefOid",
      )
      ctx.log.info(
        '         reports pending while the runs read belong to a different sha',
      )
      ctx.log.info(
        '         does NOT claim CI green off a run that belongs to the earlier commit',
      )
    },
  },
})
