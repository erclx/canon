import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      // One function with the test that covers it, both already committed. The
      // pairing convention is the one the loop reads: a subject at `foo.ts` takes
      // its test at `foo.test.ts` beside it. Seeding the pair rather than
      // describing it leaves the run a shape to copy instead of a rule to recall.
      ctx.fixtures('claude', 'test-first', 'shared', 'greeter')

      ctx.mkdir('src')

      ctx.git('add', '.')
      ctx.commit('feat(greeting): add the greet helper and its test')

      ctx.log.step(
        'Scenario ready: a paired function and test, with a sibling function still to write',
      )
      ctx.log.info(
        'Context: src/index.ts carries greet with src/index.test.ts beside it, committed.',
      )
      ctx.log.info(
        '         Nothing covers the farewell function the prompt asks for, so the test',
      )
      ctx.log.info(
        '         for it has to be written before the code that satisfies it.',
      )
      ctx.log.info(
        "Action:  /canon:test-first, asking for a farewell function returning 'Goodbye, <name>!'",
      )
      ctx.log.info(
        'Expect:  canon:test-craft loaded at step 1 and the layer named as unit, since',
      )
      ctx.log.info(
        '         farewell is pure logic. Then a case added to src/index.test.ts naming',
      )
      ctx.log.info(
        '         what farewell proves, run once against the unchanged src/index.ts and',
      )
      ctx.log.info(
        '         read as failing for the missing export rather than for a typo or a bad',
      )
      ctx.log.info(
        '         import, then the smallest implementation, then the same test run green',
      )
      ctx.log.info(
        "         and the file's other case still passing, then a refactor pass with the",
      )
      ctx.log.info('         suite re-run green after it.')
      ctx.log.info(
        "Read:    the ordering off the session's own turns, which means reading this arm",
      )
      ctx.log.info(
        '         interactively. The tree a correct run leaves and the tree a run that',
      )
      ctx.log.info(
        '         wrote both halves at once leaves are identical, and run.sh keeps the',
      )
      ctx.log.info(
        '         result rather than the turns, so a headless pass covers the artifact',
      )
      ctx.log.info(
        '         and says nothing about the order. A run reporting that it went red',
      )
      ctx.log.info('         first is not evidence that it did.')
      ctx.log.info(
        'Driven:  twice on sonnet, at 8 and 9 turns and 0.16 dollars each, on 2026-09-07.',
      )
      ctx.log.info(
        '         Both left the case, the smallest implementation, and greet still',
      )
      ctx.log.info(
        '         passing, and both claimed a red run that neither could be checked on.',
      )
      ctx.log.info(
        '         Both runs predate the layer hop and the refactor step, so neither',
      )
      ctx.log.info('         covers them.')
    },
  },
})
