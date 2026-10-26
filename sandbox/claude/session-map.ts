import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      ctx.fixtures('claude', 'session-map', 'shared', '01-initial')

      ctx.git('add', '.')
      ctx.commit('feat(api): scaffold the task API and its board')

      ctx.git('checkout', '-b', 'feat/csv-export', '-q')

      // Left untracked on purpose. `## State` owes the reader any untracked file that
      // needs committing, so a map filled from boilerplate rather than from a read of
      // the tree is separable from one filled correctly.
      ctx.fixtures('claude', 'session-map', 'shared', '02-untracked')

      ctx.log.step(
        'Scenario ready: a cold session on a feature branch with a board to report on',
      )
      ctx.log.info(
        'Context: the branch is feat/csv-export, so the slug drops the type and',
      )
      ctx.log.info('  the map lands at .canon/tasks/session-csv-export.md')
      ctx.log.info(
        '  The board carries v01.0 shipped and v02.0 and v03.0 open, and',
      )
      ctx.log.info(
        '  Every board row resolves to a plan, so a dangling link is never',
      )
      ctx.log.info('  state a cold session has to report')
      ctx.log.info(
        '  .canon/plans/feature-csv-export.md is the plan behind the branch',
      )
      ctx.log.info(
        '  src/routes/export.ts is untracked, which is what ## State owes a reader',
      )
      ctx.log.info('')
      ctx.log.info(
        "The project carries no claude/skills/ corpus, so the drift step's verb",
      )
      ctx.log.info(
        'refuses and the map records the refusal rather than a name. The only',
      )
      ctx.log.info(
        'commit is newer than any session window, so the elapsed-time ref',
      )
      ctx.log.info(
        'recovery returns empty and item 3 of the standard answers it.',
      )
      ctx.log.info('')
      ctx.log.info(
        'Both defects this arm covers came out of cold headless runs recorded on',
      )
      ctx.log.info(
        'pull request #1097, which states their conditions rather than the',
      )
      ctx.log.info(
        'prompt each used. Those runs named no skill, to settle routing. This',
      )
      ctx.log.info(
        'arm names one, since routing is settled and the steps are not.',
      )
      ctx.log.info('')
      ctx.log.info(
        'The prompt states the reasoning, since a cold sandbox holds none of its',
      )
      ctx.log.info(
        "own and the skill's decline guard answers a session that holds nothing",
      )
      ctx.log.info(
        'git does not. It carries one mistake and one caution and no tree fact,',
      )
      ctx.log.info(
        'so the export.ts block still proves the session read the tree.',
      )
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:session-map we are about to compact. I lost twenty minutes',
      )
      ctx.log.info(
        '         checking the export with curl against port 3000, which serves the',
      )
      ctx.log.info(
        "         main checkout rather than this branch, so start this branch's server",
      )
      ctx.log.info(
        '         on its own port first. bun run check is lint and typecheck only, so',
      )
      ctx.log.info(
        '         a green check says nothing about whether a quoted title survives',
      )
      ctx.log.info('         the CSV writer.')
      ctx.log.info(
        'Expect:  declared in fixtures/claude/session-map/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:session-map',
      )
      ctx.log.info(
        "         A map carrying the three core sections, the drift verb's own",
      )
      ctx.log.info(
        '         refusal, and the untracked file. The board ends the run',
      )
      ctx.log.info('         untouched.')
      ctx.log.info(
        '         What the map says about the empty window is a reader',
      )
      ctx.log.info(
        '         expectation, since item 3 fixes what a writer must say and',
      )
      ctx.log.info('         not the words to say it in.')
      ctx.log.info(
        '         Five expectations need a reader and report as unchecked.',
      )
    },
  },
})
