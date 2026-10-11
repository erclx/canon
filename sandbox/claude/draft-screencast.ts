import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    'with-context': (ctx) => {
      ctx.fixtures('claude', 'draft-screencast', 'with-context', '01-initial')

      ctx.mkdir('.claude')
      ctx.git('add', '.')
      ctx.commit('feat(notes): v2 scope notes')

      ctx.log.step('Scenario ready: screencast draft (with project context)')
      ctx.log.info(
        'Context: notes app v2 launch with REQUIREMENTS, .canon/tasks/, and CLAUDE.md present',
      )
      ctx.log.info("Action:  /canon:draft-screencast 'v2 inline edit launch'")
      ctx.log.info(
        'Expect:  4 discovery questions with seeded defaults, then draft to demos/<slug>/beats.md with 9 sections and 5 pre-seeded beats',
      )
      ctx.log.info(
        'Expect:  the closing block names canon demo compile as the next step and the session stops there rather than compiling or recording',
      )
    },
    bare: (ctx) => {
      ctx.fixtures('claude', 'draft-screencast', 'bare', '01-initial')

      ctx.git('add', '.')
      ctx.commit('chore: initial state')

      ctx.log.step('Scenario ready: screencast draft (no project context)')
      ctx.log.info('Context: bare repo, no CLAUDE.md or .canon/tasks/')
      ctx.log.info(
        "Action:  /canon:draft-screencast 'cli onboarding walkthrough'",
      )
      ctx.log.info(
        'Expect:  discovery falls back to generic defaults and the draft is still written',
      )
      ctx.log.info(
        'Expect:  no recording tool, editing tool, font, or window manager inside the draft, and no selector, URL, or timing on a beat',
      )
    },
  },
})
