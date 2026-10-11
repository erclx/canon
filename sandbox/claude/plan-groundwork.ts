import { type StageContext, scenario } from '@/sandbox/scenario'

function seedDuplicatedWorkspace(ctx: StageContext): void {
  ctx.fixtures('claude', 'plan-groundwork', 'shared', 'duplicated-workspace')

  for (const pkg of ['api', 'web', 'worker']) {
    ctx.mkdir(`packages/${pkg}/src`)
    ctx.write(
      `packages/${pkg}/package.json`,
      `{\n  "name": "@sandbox/${pkg}",\n  "version": "1.0.0",\n  "private": true,\n  "type": "module",\n  "scripts": {\n    "lint": "eslint src",\n    "typecheck": "tsc --noEmit"\n  }\n}\n`,
    )
  }

  ctx.write('packages/api/src/index.ts', 'export const api = () => "api";\n')
  ctx.write('packages/web/src/index.ts', 'export const web = () => "web";\n')
  ctx.write(
    'packages/worker/src/index.ts',
    'export const worker = () => "worker";\n',
  )
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  prepare: (ctx) => {
    ctx.log.step('Groundwork sandbox')
    ctx.log.info(
      'open    : drifted workspace, no .canon/groundwork/ folder yet',
    )
    ctx.log.info(
      'resume  : live folder with README.md and 01-current-state.md, no decision',
    )
    ctx.log.info('decline : one-file change already decided in .canon/tasks/')
    ctx.log.info('')
    ctx.log.info(
      'Invoke the prefixed form. The dev-skill injection copies SKILL.md alone,',
    )
    ctx.log.info(
      'so the unprefixed copy cannot resolve the bundled claude/skills/plan-groundwork/references/groundwork.md.',
    )
    ctx.log.info(
      'Launch with: claude --plugin-dir <worktree-root>/claude --model sonnet',
    )
  },
  arms: {
    open: (ctx) => {
      seedDuplicatedWorkspace(ctx)

      ctx.mkdir('.claude')
      ctx.fixtures('claude', 'plan-groundwork', 'open', '01-initial')

      ctx.mkdir('.canon/tasks')

      ctx.git('add', '.')
      ctx.commit('feat(workspace): three packages with independent tooling')

      ctx.log.step('Scenario ready: groundwork open mode')
      ctx.log.info(
        'Context: three packages with drifted eslint and tsconfig, drift never measured',
      )
      ctx.log.info(
        '         Two or more approaches are live and no .canon/groundwork/ folder exists',
      )
      ctx.log.info(
        'Action:  /canon:plan-groundwork tooling config drift across the three packages',
      )
      ctx.log.info(
        'Expect:  qualifying test passes, folder created at .canon/groundwork/<nn>-<slug>/',
      )
      ctx.log.info(
        '         README.md written first, then 01-current-state.md with measured drift',
      )
      ctx.log.info(
        '         NOTHING written to .canon/plans/, packages/, or any config file',
      )
      ctx.log.info(
        '         Output lists full relative paths and the open questions',
      )
    },
    resume: (ctx) => {
      seedDuplicatedWorkspace(ctx)

      ctx.mkdir('.canon/groundwork/01-tooling-drift')
      ctx.fixtures('claude', 'plan-groundwork', 'resume', '01-initial')

      ctx.git('add', '.')
      ctx.commit('feat(workspace): three packages with independent tooling')

      ctx.log.step('Scenario ready: groundwork resume mode')
      ctx.log.info(
        'Context: .canon/groundwork/01-tooling-drift/ exists with README.md and 01-current-state.md',
      )
      ctx.log.info('         No 06-decision.md, so the folder is live')
      ctx.log.info(
        '         01-current-state.md was measured at two packages and the workspace now has three',
      )
      ctx.log.info('         It carries two open questions at the end')
      ctx.log.info('Action:  /canon:plan-groundwork tooling drift')
      ctx.log.info(
        'Expect:  resume detected from the folder, never asked about',
      )
      ctx.log.info(
        '         README.md and its file map read first, then 01-current-state.md',
      )
      ctx.log.info(
        '         Continues from the two open questions instead of restarting the folder',
      )
      ctx.log.info(
        '         Re-measures only because the project moved, and marks what changed',
      )
    },
    decline: (ctx) => {
      ctx.fixtures('claude', 'plan-groundwork', 'decline', '01-initial')

      ctx.mkdir('src')
      ctx.mkdir('.claude')

      ctx.mkdir('.canon/tasks')

      ctx.git('add', '.')
      ctx.commit('feat(cli): version flag and usage line')

      ctx.log.step('Scenario ready: groundwork qualifying test declines')
      ctx.log.info(
        'Context: one-file change, current state known, approach already decided in .canon/tasks/',
      )
      ctx.log.info('         Only one of the three qualifying tests can hold')
      ctx.log.info('Action:  /canon:plan-groundwork adding a --help flag')
      ctx.log.info('Expect:  skill declines and points at /plan-feature')
      ctx.log.info('         NO folder created under .canon/groundwork/')
      ctx.log.info('         No measuring pass, no README.md')
    },
  },
})
