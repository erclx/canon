import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      ctx.fixtures('claude', 'ui-measure', 'shared', '01-initial')

      ctx.git('add', '.')
      ctx.commit('feat(ui): task list served by vite preview')

      ctx.log.step(
        'Scenario ready: runtime measurement with a detectable harness',
      )
      ctx.log.info(
        'Context: Vite/React app carrying a preview command, a documented port, and Playwright',
      )
      ctx.log.info('Seeded so detection has one answer:')
      ctx.log.info(
        '  playwright.config.ts and @playwright/test make Playwright the harness found',
      )
      ctx.log.info('  preview on 4173 is production-shaped, dev on 5173 is not')
      ctx.log.info(
        '  TaskList.tsx fills its list after 400ms above an unsized banner,',
      )
      ctx.log.info(
        '  so the banner is pushed down and the layout reading is non-zero',
      )
      ctx.log.info(
        'Before:  bun install, then bunx playwright install chromium. Neither is seeded,',
      )
      ctx.log.info(
        '         since a sandbox provisions files and cannot fetch a browser.',
      )
      ctx.log.info('Action:  /ui-measure')
      ctx.log.info(
        'Expect:  Playwright named as the harness, a median per metric beside its threshold,',
      )
      ctx.log.info(
        '         a Shifted line naming the banner img the seeded shift moves,',
      )
      ctx.log.info(
        '         taken off the run that produced the median rather than merged across three,',
      )
      ctx.log.info(
        '         and a reading written to .canon/review/ui-measure-<slug>.md',
      )
      ctx.log.info(
        'Second arm: delete playwright.config.ts and the two Playwright entries in package.json,',
      )
      ctx.log.info(
        '         re-run, and expect a statement of what the measurement needs rather than a failure',
      )
    },
  },
})
