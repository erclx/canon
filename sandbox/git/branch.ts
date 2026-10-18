import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  arms: {
    default: (ctx) => {
      ctx.write('README.md', 'Base project\n')
      ctx.git('add', '.')
      ctx.commit('chore(project): init base')

      ctx.git('checkout', '-b', 'feat/clean-feature', '-q')
      ctx.write('feature.js', 'valid code\n')
      ctx.git('add', '.')
      ctx.commit('feat(core): compliant feature work')

      ctx.git('checkout', '-b', 'temp/wip-stuff', '-q')
      ctx.write('wip.js', 'messy code\n')
      ctx.git('add', '.')
      ctx.commit('feat(wip): messy work in progress')

      ctx.log.step('Scenario ready: branch naming compliance')

      ctx.log.info("Test A (current branch): 'temp/wip-stuff'")
      ctx.log.info('  Action: /canon:git-branch')
      ctx.log.info("  Expect: Suggest rename to 'feat/wip-messy-work'")

      ctx.log.bar()

      ctx.log.info("Test B (toggle): 'git checkout feat/clean-feature'")
      ctx.log.info('  Action: /canon:git-branch')
      ctx.log.info("  Expect: '✅ Branch name already follows conventions'")
    },
    main: (ctx) => {
      ctx.write('README.md', 'Base project\n')
      ctx.git('add', '.')
      ctx.commit('chore(project): init base')

      ctx.git('branch', 'feat/taken-locally')

      const remote = mkdtempSync(join(tmpdir(), 'branch-remote-'))
      ctx.run('git', ['init', '--bare', '-q', remote])
      ctx.git('remote', 'add', 'origin', remote)
      ctx.git('branch', 'feat/taken-remotely')
      ctx.git('push', '-q', 'origin', 'feat/taken-remotely')
      ctx.git('branch', '-D', 'feat/taken-remotely')

      ctx.log.step('Scenario ready: branch creation from main')

      ctx.log.info('Test A (create from a name):')
      ctx.log.info('  Action: /canon:git-branch feat/example-thing')
      ctx.log.info(
        "  Expect: '✅ Created: feat/example-thing', now the current branch",
      )

      ctx.log.bar()

      ctx.log.info('Test B (standard breach):')
      ctx.log.info('  Action: /canon:git-branch feat/bad_name')
      ctx.log.info('  Expect: refusal naming the underscore, no ref created')

      ctx.log.bar()

      ctx.log.info('Test C (local collision):')
      ctx.log.info('  Action: /canon:git-branch feat/taken-locally')
      ctx.log.info('  Expect: refusal, HEAD still on the base branch')

      ctx.log.bar()

      ctx.log.info('Test D (remote collision):')
      ctx.log.info('  Action: /canon:git-branch feat/taken-remotely')
      ctx.log.info('  Expect: refusal naming origin, no ref created')
    },
  },
})
