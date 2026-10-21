import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { type StageContext, scenario } from '@/sandbox/scenario'

/** The first installed rule, so the arm edits a file the stamp covers. */
function firstRule(ctx: StageContext): string {
  const base = join('.claude', 'rules', 'canon')
  const hit = readdirSync(join(ctx.dir, base), { recursive: true })
    .map(String)
    .filter((rel) => rel.endsWith('.md'))
    .sort()[0]
  if (!hit) ctx.fail('No installed rule under .claude/rules/canon/')
  return join(base, hit)
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
    SANDBOX_INJECT_GOV: 'true',
  },
  prepare: (ctx) => {
    ctx.fixtures('infra', 'claude', 'shared', 'package')
    ctx.git('add', '.')
    ctx.commit('chore(sandbox): project carrying the toolkit')
  },
  arms: {
    current: (ctx) => {
      ctx.log.step('Scenario ready: update skill on a current target')
      ctx.log.info(
        'Context: seeds and base governance installed by this checkout',
      )
      ctx.log.info('Action:  /canon:target-update')
      ctx.log.info(
        'Expect:  the preview reads an empty changelog range, no pending migration, and no drift a step would take, so the skill writes nothing, invokes target-check, and reports the target current. No commit lands.',
      )
    },
    customized: (ctx) => {
      const rule = firstRule(ctx)
      ctx.append(
        rule,
        '\n- A project-written bullet the toolkit never shipped.\n',
      )
      ctx.git('add', '.')
      ctx.commit('docs(rules): add a project bullet to an installed rule')

      ctx.log.step(
        'Scenario ready: update skill on a target with an edited rule',
      )
      ctx.log.info(`Context: ${rule} carries a bullet the project wrote`)
      ctx.log.info('Action:  /canon:target-update')
      ctx.log.info(
        `Expect:  the preview lists ${rule} as customized under drift and names keeping it as a call for the operator, then stops for the go-ahead. On approval the sync runs and ${rule} still holds the project bullet afterward, with the toolkit change reported as skipped. No commit subject names a canon version.`,
      )
    },
  },
})
