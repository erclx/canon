import { type StageContext, scenario } from '@/sandbox/scenario'

function configure(ctx: StageContext): void {
  ctx.log.step(`Configuring PR environment (${ctx.env.ANCHOR_REPO})`)
  ctx.anchorRemote()
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  anchor: true,
  arms: {
    'feature-branch': (ctx) => {
      configure(ctx)
      ctx.git('push', '--force', 'origin', 'HEAD:main')
      ctx.run(
        'git',
        ['push', 'origin', '--delete', 'feature/string-utils', '-q'],
        { stderr: 'ignore', allowFailure: true },
      )

      ctx.git('checkout', '-b', 'feature/string-utils', '-q')

      ctx.fixtures('git', 'pr', 'feature-branch', '01-capitalize')

      ctx.git('add', 'utils.js')
      ctx.commit('feat(utils): add capitalize helper')

      ctx.log.step('Scenario ready: feature branch')
      ctx.log.info(
        "Context: branch 'feature/string-utils' with un-pushed commits",
      )
      ctx.log.info('Action:  /canon:git-pr')
      ctx.log.info('Expect:  agent renames branch -> pushes -> opens PR')
    },
    'reused-name': (ctx) => {
      configure(ctx)
      // `git init` runs without `-b`, so the baseline branch follows the
      // machine's init.defaultBranch. This arm returns to it by name.
      ctx.git('branch', '-M', 'main')
      ctx.git('push', '--force', 'origin', 'HEAD:main', '-q')
      ctx.run('git', ['push', 'origin', '--delete', 'feat/slugify', '-q'], {
        stderr: 'ignore',
        allowFailure: true,
      })
      const open = ctx.read(
        'gh',
        [
          'pr',
          'list',
          '--head',
          'feat/slugify',
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

      ctx.git('checkout', '-b', 'feat/slugify', '-q')

      ctx.fixtures('git', 'pr', 'reused-name', '01-slugify')

      ctx.git('add', 'utils.js')
      ctx.commit('feat(utils): add slugify helper')
      ctx.git('push', '-u', 'origin', 'feat/slugify', '-q')

      // The arm closes rather than merges. `gh pr view` resolves by head branch
      // and ignores state, so a closed pull request drives the same lookup a
      // merged one does, without depending on the anchor permitting a squash.
      const created = ctx.read('gh', [
        'pr',
        'create',
        '--title',
        'feat(utils): add slugify helper',
        '--body',
        'Adds slugify helper to utils.',
        '--head',
        'feat/slugify',
        '--base',
        'main',
      ])
      const stale =
        /(\d+)\s*$/.exec(created)?.[1] ??
        ctx.fail(`gh pr create printed no number: ${created}`)

      // `-d` deletes the branch and switches back to main itself, so the
      // checkout and the delete below stay tolerant of whichever half gh did.
      ctx.run(
        'gh',
        ['pr', 'close', stale, '-d', '-c', 'closed to stage the reused name'],
        { stdout: 'ignore' },
      )

      ctx.git('checkout', 'main', '-q')
      ctx.run('git', ['branch', '-D', 'feat/slugify'], {
        stdout: 'ignore',
        stderr: 'ignore',
        allowFailure: true,
      })
      ctx.git('reset', '--hard', 'origin/main', '-q')

      ctx.git('checkout', '-b', 'feat/slugify', '-q')

      ctx.fixtures('git', 'pr', 'reused-name', '02-truncate')

      ctx.git('add', 'utils.js')
      ctx.commit('feat(utils): add truncate helper')

      ctx.log.step('Scenario ready: branch name reused after a non-open PR')
      ctx.log.info(
        `Context: PR #${stale} sits closed on 'feat/slugify', the name now carries unrelated truncate() work`,
      )
      ctx.log.info('Action:  /canon:git-pr')
      ctx.log.info(
        `Expect:  agent opens a NEW pull request. PR #${stale} keeps its original title and body`,
      )
    },
    'draft-guard': (ctx) => {
      ctx.git('checkout', '-b', 'draft/init', '-q')

      ctx.write('feature.js', '')
      ctx.git('add', 'feature.js')
      ctx.commit('feat: work in progress')

      ctx.log.step('Scenario ready: draft/init guard')
      ctx.log.info('Context: user forgot to run /git:branch before /git:pr')
      ctx.log.info('Action:  /canon:git-pr')
      ctx.log.info(
        'Expect:  guard warning. Branch looks unset, run /git:branch first',
      )
    },
  },
})
