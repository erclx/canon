import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    resolved: (ctx) => {
      ctx.fixtures('claude', 'record-screencast', 'resolved', '01-initial')

      ctx.git('add', '.')
      ctx.commit('feat(demo): cold-open draft and a resolved plan')

      ctx.log.step('Scenario ready: run a resolved plan (record-screencast)')
      ctx.log.info(
        'Context: demos/cold-open/beats.md paired with demos/cold-open/plan.json, already compiled and fully filled',
      )
      ctx.log.info(
        'Before:  bun install, then bunx playwright install chromium. Neither is seeded, since a sandbox provisions files and cannot fetch a browser.',
      )
      ctx.log.info(
        "Before:  serve board.html on port 4173, e.g. python3 -m http.server 4173, since the plan's url points there",
      )
      ctx.log.info('Action:  /canon:record-screencast demos/cold-open/beats.md')
      ctx.log.info(
        'Expect:  demos/cold-open/plan.json already exists, so the session skips canon demo compile entirely and never touches the plan',
      )
      ctx.log.info(
        'Expect:  canon demo run drives the page and reports the webm, the mp4 if ffmpeg is on PATH, the still, and the timeline, each on its own line',
      )
    },
    refused: (ctx) => {
      ctx.fixtures('claude', 'record-screencast', 'refused', '01-initial')

      ctx.git('add', '.')
      ctx.commit(
        'feat(demo): empty-state-tour draft and a plan missing its url',
      )

      ctx.log.step(
        'Scenario ready: refuse an unresolved plan (record-screencast)',
      )
      ctx.log.info(
        'Context: demos/empty-state-tour/beats.md paired with demos/empty-state-tour/plan.json, already compiled but url is still empty',
      )
      ctx.log.info(
        'Action:  /canon:record-screencast demos/empty-state-tour/beats.md',
      )
      ctx.log.info(
        'Expect:  demos/empty-state-tour/plan.json already exists, so the session skips canon demo compile and calls canon demo run directly',
      )
      ctx.log.info(
        'Expect:  the run refuses with reason plan-unresolved, the session reports url as the missing field, and it stops',
      )
      ctx.log.info(
        'Expect:  no browser launch, no guessed url, and no edit to demos/empty-state-tour/plan.json',
      )
    },
  },
})
