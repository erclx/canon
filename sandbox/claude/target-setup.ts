import { readdirSync, renameSync, rmSync, rmdirSync } from 'node:fs'
import { join } from 'node:path'

import { type StageContext, scenario } from '@/sandbox/scenario'

/** `bun create` into a scratch folder and hoist it, dotfiles included, as the bash arm did. */
function scaffold(
  ctx: StageContext,
  scratch: string,
  createArgs: readonly string[],
): void {
  ctx.run('bun', ['create', ...createArgs], {
    stdout: 'ignore',
    stderr: 'ignore',
  })
  rmSync(join(ctx.dir, scratch, '.git'), { recursive: true, force: true })
  for (const entry of readdirSync(join(ctx.dir, scratch)))
    renameSync(join(ctx.dir, scratch, entry), join(ctx.dir, entry))
  rmdirSync(join(ctx.dir, scratch))
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
  },
  arms: {
    fresh: (ctx) => {
      ctx.fixtures('claude', 'target-setup', 'fresh', '01-initial')

      ctx.git('add', '.')
      ctx.commit('chore(sandbox): fresh empty project')

      ctx.log.step('Scenario ready: setup skill on an empty repo')
      ctx.log.info('Context: package.json only, no framework evidence')
      ctx.log.info('Action:  /canon:target-setup')
      ctx.log.info(
        "Expect:  stack resolves to 'base' and the preview marks it a fallback, canon init lands .claude/rules/ and stamps canon/config/config.json, tooling sync is skipped (tooling stack also 'base' = already synced), the verify phase finds no stack scripts and reports base scripts only, the indexes phase then runs and finds no candidate folder on the empty tree, and the report names git-commit as outside the chain",
      )
    },
    'no-stack': (ctx) => {
      ctx.fixtures('claude', 'target-setup', 'no-stack', '01-initial')

      ctx.git('add', '.')
      ctx.commit(
        'chore(sandbox): go project the toolkit ships no governance stack for',
      )

      ctx.log.step(
        'Scenario ready: setup skill on a language with no governance stack',
      )
      ctx.log.info(
        'Context: go.mod and main.go, no package.json and no JavaScript evidence',
      )
      ctx.log.info('Action:  /canon:target-setup')
      ctx.log.info(
        "Expect:  the governance stack resolves to 'base' and the preview marks it a fallback, with the Go language rule passed through --add. The tooling stack resolves to 'go' on a canon whose catalog carries it, and the preview names it with no fallback mark. The chain runs rather than stopping, the indexes phase runs and finds no candidate folder, and the report names git-commit as outside the chain.",
      )
    },
    monorepo: (ctx) => {
      ctx.fixtures('claude', 'target-setup', 'monorepo', '01-initial')

      ctx.git('add', '.')
      ctx.commit(
        'chore(sandbox): monorepo with web, api, and svc language roots',
      )

      ctx.log.step(
        'Scenario ready: setup skill on a monorepo with subfolder language roots',
      )
      ctx.log.info(
        'Context: root package.json with no dependencies, web/ holding react and vite, api/pyproject.toml, svc/go.mod',
      )
      ctx.log.info('Action:  /canon:target-setup')
      ctx.log.info(
        "Expect:  the preview lists one tooling row per language root (web, api, svc) with its path and command, the root row resolving to 'base' with no command of its own. Governance resolves once at the root to 'base' with the React, Python, and Go rules passed through --add. One canon init runs at the root, and each subfolder takes its own tooling sync with --skip base, so no subfolder carries .husky or .github.",
      )
    },
    'vite-react': (ctx) => {
      ctx.log.step('Running bun create vite')
      scaffold(ctx, '_tmp_vite', [
        'vite@latest',
        '_tmp_vite',
        '--template',
        'react-ts',
      ])

      ctx.git('add', '.')
      ctx.commit('chore(sandbox): vite + react scaffold via bun create vite')

      ctx.log.step('Scenario ready: setup skill on a Vite + React project')
      ctx.log.info(
        'Context: real bunx create-vite output (index.html, public/, src/App.tsx, src/index.css)',
      )
      ctx.log.info('Action:  /canon:target-setup')
      ctx.log.info(
        "Expect:  governance stack 'node' with 200-react proposed as an extra, tooling stack 'vite-react', canon init lands .claude/rules/ with 200-react.md and no 230-nextjs.md under .claude/rules/canon/framework/, tooling sync drops golden configs from tooling/web and tooling/vite-react, the verify phase runs lint/typecheck/check/test/build, the indexes phase then runs over the scaffold's own docs, and the report names git-commit as outside the chain",
      )
    },
    astro: (ctx) => {
      ctx.log.step('Running bun create astro')
      scaffold(ctx, '_tmp_astro', [
        'astro@latest',
        '_tmp_astro',
        '--',
        '--template',
        'minimal',
        '--typescript',
        'strict',
        '--no-install',
        '--no-git',
        '--skip-houston',
        '--yes',
      ])

      ctx.git('add', '.')
      ctx.commit('chore(sandbox): astro scaffold via bun create astro')

      ctx.log.step('Scenario ready: setup skill on an Astro project')
      ctx.log.info(
        'Context: real bunx create-astro output (src/pages, astro.config.mjs, tsconfig.json)',
      )
      ctx.log.info('Action:  /canon:target-setup')
      ctx.log.info(
        "Expect:  governance stack 'node' with 210-astro proposed as an extra, tooling stack 'astro', canon init lands .claude/rules/, tooling sync drops golden configs from tooling/web and tooling/astro, the verify phase runs lint/typecheck/check/test/build, the indexes phase then runs over the scaffold's own docs, and the report names git-commit as outside the chain",
      )
    },
    'verify-pass': (ctx) => {
      ctx.fixtures('claude', 'target-setup', 'verify-pass', '01-initial')

      ctx.git('add', '.')
      ctx.commit('chore(sandbox): scaffolded project with passing scripts')

      ctx.log.step('Scenario ready: setup verify phase, happy path')
      ctx.log.info(
        'Context: package.json with lint:fix, typecheck, check, test:run, build all echoing ok',
      )
      ctx.log.info('Action:  /canon:target-setup verify')
      ctx.log.info(
        "Expect:  five green checks, summary 'Scaffold verified' naming the default depth",
      )
    },
    'verify-fail': (ctx) => {
      ctx.fixtures('claude', 'target-setup', 'verify-fail', '01-initial')

      ctx.git('add', '.')
      ctx.commit('chore(sandbox): scaffolded project with failing typecheck')

      ctx.log.step('Scenario ready: setup verify phase, fail path')
      ctx.log.info('Context: package.json with typecheck that exits non-zero')
      ctx.log.info('Action:  /canon:target-setup verify')
      ctx.log.info(
        'Expect:  lint passes, typecheck fails, run stops before check/test/build, failing output surfaced',
      )
    },
    'smoke-pass': (ctx) => {
      ctx.fixtures('claude', 'target-setup', 'smoke-pass', '01-initial')

      ctx.git('add', '.')
      ctx.commit(
        'chore(sandbox): scaffolded project with passing smoke scripts',
      )

      ctx.log.step(
        'Scenario ready: setup verify phase at deep depth, happy path',
      )
      ctx.log.info(
        'Context: package.json with dev, preview, test:e2e, screenshot all succeeding',
      )
      ctx.log.info('Action:  /canon:target-setup verify deep')
      ctx.log.info(
        "Expect:  four green checks, summary 'Scaffold verified' naming the deep depth",
      )
    },
    'smoke-fail': (ctx) => {
      ctx.fixtures('claude', 'target-setup', 'smoke-fail', '01-initial')

      ctx.git('add', '.')
      ctx.commit(
        'chore(sandbox): scaffolded project with failing end-to-end suite',
      )

      ctx.log.step(
        'Scenario ready: setup verify phase at deep depth, fail path',
      )
      ctx.log.info('Context: package.json with test:e2e exiting non-zero')
      ctx.log.info('Action:  /canon:target-setup verify deep')
      ctx.log.info(
        'Expect:  dev and preview pass, test:e2e fails, run stops before screenshot, failing output surfaced',
      )
    },
  },
})
