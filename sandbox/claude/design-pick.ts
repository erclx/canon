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
      // The fixture also seeds the references page an earlier design-references run
      // left on the board, so the reference step reuses it rather than reaching the
      // network. Its frames are captioned with structure alone.
      ctx.fixtures('claude', 'design-pick', 'shared', '01-initial')
      // Frameboard names its marker board.json, which the folder-name gate reads as a
      // repeat, so the scenario writes it rather than the fixture tree.
      ctx.write('.canon/board/board.json', '{"version": 1}\n')

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
        '         canon/DESIGN.md names Draw widths 320, 768, and 1440 under ## Layout, so a round',
      )
      ctx.log.info(
        '         draws each arm at those rather than at the 390, 834, 1440 fallback',
      )
      ctx.log.info(
        '         .canon/board/picks/references/ holds a references page an earlier run left,',
      )
      ctx.log.info(
        '         so the reference step reuses it and each arm names the frame it draws on',
      )
      ctx.log.info(
        'Browser: machine-dependent, and the sandbox does not decide it. The run serves a',
      )
      ctx.log.info(
        '         Frameboard board with frameboard serve and captures through frameboard capture,',
      )
      ctx.log.info(
        '         reached as bunx -y frameboard where no binary is on PATH. The render works',
      )
      ctx.log.info(
        '         wherever bunx playwright install chromium has run once, and capture refuses with',
      )
      ctx.log.info(
        '         browser-not-found everywhere else, which the run reports before drafting further.',
      )
      ctx.log.info(
        'Action:  /canon:design-pick draft candidates for the callout treatment on index.html, and take arm 2 when you put the pick to me',
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
        '         every arm captured at each round width under .canon/picks/, the references page',
      )
      ctx.log.info(
        '         archived under .canon/picks/references/ and still on the board, and the round pages the run added gone',
      )
      ctx.log.info(
        '         from frameboard list. Not yet measured on Frameboard.',
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
