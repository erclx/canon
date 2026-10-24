import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { type StageContext, scenario } from '@/sandbox/scenario'
import { hashContent } from '@/sync/stamp'

const CUSTOMIZED_RULE = join('.claude', 'rules', 'canon', 'canon', 'context.md')
const STALE_RULE = join('.claude', 'rules', 'canon', 'canon', 'git.md')
const STAMP = join('canon', 'config', 'config.json')

/** The second release heading in the checkout's changelog, so the range holds one entry. */
function previousRelease(ctx: StageContext): string {
  const headings = [
    ...readFileSync(join(ctx.root, 'CHANGELOG.md'), 'utf8').matchAll(
      /^## \[(\d+\.\d+\.\d+)\]/gm,
    ),
  ]
  const version = headings[1]?.[1]
  if (!version) ctx.fail('CHANGELOG.md carries fewer than two release headings')
  return version as string
}

/**
 * Stages a target one release behind the toolkit: a project bullet on a rule
 * the sync must keep, and a stale copy of another it must restore. The stale
 * copy loses its H1 and takes a stamp hash over the edited bytes, so it reads
 * as untouched and behind rather than customized. Both rules are pinned by
 * path because the arms' expectations name them.
 */
function stageBehind(ctx: StageContext): void {
  for (const rule of [CUSTOMIZED_RULE, STALE_RULE]) {
    if (!existsSync(join(ctx.dir, rule))) {
      ctx.fail(`Pinned rule ${rule} is missing, so the arm cannot stage it`)
    }
  }
  ctx.append(
    CUSTOMIZED_RULE,
    '\n- A project-written bullet the toolkit never shipped.\n',
  )

  const lines = ctx.readFile(STALE_RULE).split('\n')
  const heading = lines.findIndex((line) => line.startsWith('# '))
  if (heading < 0) ctx.fail(`${STALE_RULE} carries no H1 line to delete`)
  const stale = lines.filter((_, index) => index !== heading).join('\n')
  ctx.write(STALE_RULE, stale)

  const stamp = JSON.parse(ctx.readFile(STAMP)) as {
    domains: { governance: { version: string; files: Record<string, string> } }
  }
  const governance = stamp.domains.governance
  governance.files[STALE_RULE] = hashContent(stale)
  governance.version = previousRelease(ctx)
  ctx.write(STAMP, `${JSON.stringify(stamp, null, 2)}\n`)

  ctx.git('add', '.')
  ctx.commit('docs(rules): stage a target behind the toolkit')
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
      stageBehind(ctx)

      ctx.log.step(
        'Scenario ready: update skill on a target behind the toolkit with an edited rule',
      )
      ctx.log.info(
        `Context: ${CUSTOMIZED_RULE} carries a bullet the project wrote, and ${STALE_RULE} is behind the toolkit`,
      )
      ctx.log.info(
        'Action:  /canon:target-update, and go ahead with the defaults the preview names, taking the worktree',
      )
      ctx.log.info(
        `Expect:  the preview lists ${CUSTOMIZED_RULE} as customized and ${STALE_RULE} as stale under drift, names the worktree it will enter under Where it lands, and stops for the go-ahead, which the prompt carries. The sync runs in the worktree and ${CUSTOMIZED_RULE} still holds the project bullet afterward. No commit subject names a canon version. The shared checkout stays on main and the commits sit on the worktree's branch.`,
      )
    },
    declined: (ctx) => {
      stageBehind(ctx)

      ctx.log.step('Scenario ready: update skill when the worktree is declined')
      ctx.log.info(
        `Context: ${CUSTOMIZED_RULE} carries a bullet the project wrote, and ${STALE_RULE} is behind the toolkit`,
      )
      ctx.log.info(
        'Action:  /canon:target-update, and go ahead with the defaults but decline the worktree',
      )
      ctx.log.info(
        'Expect:  the preview names a branch created in place under Where it lands. After the go-ahead the skill creates it through git-branch, and the commits sit on it with the checkout off main.',
      )
    },
  },
})
