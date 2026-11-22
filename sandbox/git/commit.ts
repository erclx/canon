import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { type StageContext, scenario } from '@/sandbox/scenario'

/** A local bare remote, so `gh` cannot answer and the amend reads trunk history locally. */
function localRemote(ctx: StageContext): void {
  const remote = mkdtempSync(join(tmpdir(), 'commit-remote-'))
  ctx.run('git', ['init', '--bare', '-q', '-b', 'main', remote])
  ctx.git('remote', 'add', 'origin', remote)
}

function stageConfigFix(ctx: StageContext): void {
  ctx.write('config.js', 'export const MAX_CONNECTIONS = 5;\n')
  ctx.git('add', 'config.js')
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  arms: {
    default: (ctx) => {
      ctx.identity()

      ctx.write('config.js', 'export const MAX_CONNECTIONS = "5";\n')
      ctx.git('add', '.')
      ctx.commit('feat(git): initial config')

      stageConfigFix(ctx)

      ctx.log.step('Scenario ready: staged changes (config update)')
      ctx.log.info(
        "Context: modified 'config.js' (MAX_CONNECTIONS string -> number)",
      )
      ctx.log.info('Action:  /canon:git-commit')
      ctx.log.info('Expect:  generates conventional commit message')
    },
    'amend-new-project': (ctx) => {
      ctx.identity()
      localRemote(ctx)
      ctx.git('branch', '-M', 'main')

      ctx.write('config.js', 'export const MAX_CONNECTIONS = "5";\n')
      ctx.git('add', '.')
      ctx.commit('feat(config): add connection limit')
      ctx.git('push', '-q', '-u', 'origin', 'main')

      stageConfigFix(ctx)

      ctx.log.step('Scenario ready: one pushed commit on main, no merges')
      ctx.log.info(
        'Action:  /canon:git-commit amend this into the last commit and push',
      )
      ctx.log.info(
        'Expect:  amends with --no-edit, then runs git push --force-with-lease',
      )
    },
    'amend-merged': (ctx) => {
      ctx.identity()
      localRemote(ctx)
      ctx.git('branch', '-M', 'main')

      ctx.write('README.md', 'Base project\n')
      ctx.git('add', '.')
      ctx.commit('chore(project): init base')

      ctx.git('checkout', '-q', '-b', 'feat/config')
      ctx.write('config.js', 'export const MAX_CONNECTIONS = "5";\n')
      ctx.git('add', '.')
      ctx.commit('feat(config): add connection limit')
      ctx.git('checkout', '-q', 'main')
      ctx.git(
        'merge',
        '-q',
        '--no-ff',
        '-m',
        'Merge feat/config',
        'feat/config',
      )
      ctx.write('README.md', 'Base project with a connection limit\n')
      ctx.git('add', '.')
      ctx.commit('docs(project): describe connection limit')
      ctx.git('push', '-q', '-u', 'origin', 'main')

      stageConfigFix(ctx)

      ctx.log.step(
        'Scenario ready: HEAD sits above a merge on the remote trunk',
      )
      ctx.log.info('Action:  /canon:git-commit amend this into the last commit')
      ctx.log.info('Expect:  refuses, since the trunk holds merged history')
    },
    'amend-foreign': (ctx) => {
      ctx.identity()

      ctx.write('config.js', 'export const MAX_CONNECTIONS = "5";\n')
      ctx.git('add', '.')
      ctx.git(
        'commit',
        '-q',
        '--no-verify',
        '--author',
        'Dana Reyes <dana@example.com>',
        '-m',
        'feat(config): add connection limit',
      )

      stageConfigFix(ctx)

      ctx.log.step('Scenario ready: HEAD authored by another person')
      ctx.log.info('Action:  /canon:git-commit amend this into the last commit')
      ctx.log.info('Expect:  refuses, naming Dana Reyes <dana@example.com>')
    },
  },
})
