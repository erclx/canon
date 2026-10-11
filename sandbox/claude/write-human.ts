import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      // Every sentence in docs/cache.md clears the ban scan. The defect is
      // distribution: nine sentences within a few words of each other, four openings
      // on the same shape, two verbless fragments standing as sentences, one triad,
      // one thing named four ways, and two adverbs standing in for a measurement. A
      // run that reports a clean audit here has read the words rather than the
      // passage.
      ctx.fixtures('claude', 'write-human', 'shared', '01-initial')

      ctx.git('add', '.')
      ctx.commit('docs(cache): describe the response cache')

      ctx.log.step(
        'Scenario ready: prose that clears the ban scan and still reads machine-written',
      )
      ctx.log.info(
        'Context: docs/cache.md, committed, carrying six tells no closed word set matches:',
      )
      ctx.log.info(
        '  1. Uniform cadence: every sentence within a few words of the last',
      )
      ctx.log.info(
        '  2. Repeated openings: four sentences opening on the same shape',
      )
      ctx.log.info('  3. Fragments: two verbless clauses standing as sentences')
      ctx.log.info(
        '  4. Rule of three: an invented triad, and a three-bullet Configuration block',
      )
      ctx.log.info(
        '  5. Synonym cycling: cache, store, buffer, layer for one thing',
      )
      ctx.log.info(
        '  6. Adverb propping and a false range, with no measurement behind either',
      )
      ctx.log.info(
        'Action:  /canon:write-human, asking for a revision of docs/cache.md',
      )
      ctx.log.info(
        'Expect:  a rewrite varying sentence length and opening structure, with the',
      )
      ctx.log.info(
        '         fragments given verbs, one name per thing, and the triad cut to what',
      )
      ctx.log.info(
        '         the subject holds. Read the result against the rhythm rules rather',
      )
      ctx.log.info(
        '         than against the ban list, which the seeded passage already passes.',
      )
    },
  },
})
