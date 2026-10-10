import { join } from 'node:path'
import { scenario } from '@/sandbox/scenario'

export default scenario({
  arms: {
    default: (ctx) => {
      ctx.log.step('Initializing package')
      ctx.fixtures('tooling', 'claude', 'shared', 'package')
      ctx.log.info('package.json created')

      ctx.fixtures('tooling', 'claude', 'shared', 'gitignore')
      ctx.log.info('.gitignore created')

      ctx.log.step('Injecting governance rules')
      ctx.run('bun', [
        join(ctx.root, 'src', 'cli.ts'),
        'gov',
        'install',
        'base',
        '.',
      ])
      ctx.log.info('Base rules injected into .claude/rules/')

      ctx.log.step('Scenario ready: Claude workflow')
      ctx.log.info('Context: Empty project with base gov rules injected')
      ctx.log.info('')
      ctx.log.info('Test sequence:')
      ctx.log.info(
        '  1. canon claude init        : seed .claude/ and verify DESIGN.md prompt',
      )
      ctx.log.info(
        '  2. canon claude sync        : verify .gitignore reconciles against the manifest',
      )
      ctx.log.info('')
      ctx.log.info('Verify after init:')
      ctx.log.info('  .canon/tasks/index.md, REQUIREMENTS.md exist')
      ctx.log.info('  canon/wireframes/index.md exists')
      ctx.log.info('  canon/DESIGN.md exists only if UI was selected')
      ctx.log.info('  .gitignore contains .canon/tmp/')
    },
  },
})
