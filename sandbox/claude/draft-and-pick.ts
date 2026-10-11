import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      // The page carries one unresolved treatment and nothing else worth deciding,
      // so a run has one subject to draft arms against. The callout ships flat, which
      // is arm 0 for any candidate set drawn off this page.
      ctx.fixtures('claude', 'draft-and-pick', 'shared', '01-initial')

      ctx.mkdir('.claude')
      ctx.git('add', '.')
      ctx.commit(
        'feat(page): release notes with an undecided callout treatment',
      )

      ctx.log.step(
        'Scenario ready: a stated visual decision with one treatment undecided',
      )
      ctx.log.info(
        'Context: index.html carries one flat callout, and canon/DESIGN.md states the',
      )
      ctx.log.info(
        '         treatment as undecided between a border, a ground shift, and an edge rule',
      )
      ctx.log.info(
        'Browser: machine-dependent, and the sandbox does not decide it. The run serves the canvas',
      )
      ctx.log.info(
        '         with canon canvas serve and captures through canon canvas capture, which resolve',
      )
      ctx.log.info(
        '         playwright-core through the installed canon rather than this project, so the',
      )
      ctx.log.info(
        '         render works wherever bunx playwright install chromium has run once and takes',
      )
      ctx.log.info(
        '         the refusal path everywhere else. A canon lacking the canvas client packages',
      )
      ctx.log.info(
        '         refuses serve with missing-client-deps, and the run stops before drafting.',
      )
      ctx.log.info(
        'Action:  /canon:draft-and-pick draft candidates for the callout treatment on index.html, and take arm 2 when you put the pick to me',
      )
      ctx.log.info(
        'Expect:  the closed state. A headless run has no operator to say the pick is right, so it',
      )
      ctx.log.info(
        '         carries the pre-supplied pick through step 6 rather than parking at the hand-off:',
      )
      ctx.log.info(
        '         the arm applied to the callout in index.html, the rest of that page untouched,',
      )
      ctx.log.info(
        '         every arm captured under .canon/picks/, and the round pages the run added gone',
      )
      ctx.log.info(
        '         from canon canvas list. Not yet measured on the canvas.',
      )
      ctx.log.info(
        'Not reached: the loop, the pick, and the hand-off. The loop stops on a person saying the',
      )
      ctx.log.info(
        '         pick is right and no fixture supplies one, so a pass here is not coverage of them.',
      )
    },
  },
})
