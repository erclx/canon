import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      // Staleness seed in canon/context/api.md. Every path this entry names resolved
      // when it was written and two of them no longer do, which is the axis no verb
      // answers. The count in the Layout lead-in is the second testable claim shape.
      //
      // Length seed in docs/overview.md. One paragraph past the sentence and
      // character checkpoints, and one top-level bullet carrying a paragraph's worth
      // of text behind a dash.
      //
      // Structure seed in canon/context/pipeline.md. One entry past the line
      // checkpoint holding three stage domains under Layout, which earns a
      // structure line proposing a split by heading.
      //
      // Doubled seed in src/auth. Both canon/context/api.md and auth.md claim the
      // folder as a Layout H3. auth.md holds the area's trap and api.md holds only
      // the H3, so auth.md is the owner a structure line proposes.
      ctx.fixtures('claude', 'document-health', 'shared', '01-initial')

      ctx.git('add', '.')
      ctx.commit('docs(project): initial project scaffold')

      ctx.log.step('Scenario ready: document health across three axes')
      ctx.log.info(
        'Context: a project whose documents have rotted in three different ways:',
      )
      ctx.log.info(
        '  1. canon/context/api.md names src/api/serialize.ts and src/api/errors.ts, neither of which exists',
      )
      ctx.log.info(
        "  2. canon/context/api.md states 'Three files carry the domain' against a tree holding one",
      )
      ctx.log.info(
        "  3. canon/context/api.md names 'canon api verify --strict', a command that does not exist",
      )
      ctx.log.info(
        '  4. docs/overview.md carries a paragraph past the sentence and character checkpoints',
      )
      ctx.log.info(
        '  5. docs/overview.md carries a top-level bullet past the character checkpoint',
      )
      ctx.log.info(
        '  6. canon/context/pipeline.md is past the line checkpoint and holds three stage domains',
      )
      ctx.log.info(
        '  7. src/auth is claimed as a Layout H3 by both api.md and auth.md, and auth.md holds its trap',
      )
      ctx.log.info('Action:  /document-health')
      ctx.log.info(
        'Expect:  one section per document across length, placement, and staleness.',
      )
      ctx.log.info(
        "         Length findings on docs/overview.md read as 'measured', citing the checkpoint",
      )
      ctx.log.info(
        '         the markdown audit record returned rather than a number from the skill body.',
      )
      ctx.log.info(
        "         Every staleness finding on canon/context/api.md is marked 'read', not measured.",
      )
      ctx.log.info(
        '         No verdict across the three axes and no score across the documents.',
      )
      ctx.log.info(
        '         A structure line proposes splitting pipeline.md by its Ingest, Transform,',
      )
      ctx.log.info(
        '         and Publish headings, naming the headings each entry takes and why.',
      )
      ctx.log.info(
        '         A doubled finding on src/auth proposes auth.md as the owner, since it',
      )
      ctx.log.info(
        '         holds the area trap and api.md holds only the heading.',
      )
      ctx.log.info(
        '         Nothing is repaired: both files are byte-identical after the run.',
      )
    },
  },
})
