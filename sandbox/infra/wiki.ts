import { join } from 'node:path'
import { type StageContext, scenario } from '@/sandbox/scenario'

function wikiInit(ctx: StageContext): void {
  ctx.run('bun', [join(ctx.root, 'src', 'cli.ts'), 'wiki', 'init', '.'])
}

export default scenario({
  prepare: (ctx) => {
    ctx.log.step('Wiki sandbox')
    ctx.log.info('init   : scaffolds .claude/wiki/ folder with stub index.md')
    ctx.log.info('legacy : reports a root wiki/ instead of migrating it')
  },
  arms: {
    init: (ctx) => {
      ctx.log.step('Running: canon wiki init')
      wikiInit(ctx)
      ctx.log.info('Assert:  canon sandbox check infra:wiki init')
    },
    legacy: (ctx) => {
      ctx.fixtures('infra', 'wiki', 'legacy', '01-setup')
      ctx.log.step('Seeded a root wiki/ with an authored page')
      ctx.log.step('Running: canon wiki init')
      wikiInit(ctx)
      ctx.log.info(
        'Expect:  wiki/setup.md still present, .claude/wiki/index.md added',
      )
      ctx.log.info('Assert:  canon sandbox check infra:wiki legacy')
    },
  },
})
