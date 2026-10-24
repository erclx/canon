import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    drift: (ctx) => {
      ctx.fixtures('claude', 'context-fold', 'drift', '01-initial')
      ctx.git('add', '.')
      ctx.commit('feat(api): initial task endpoints')

      ctx.fixtures('claude', 'context-fold', 'drift', '02-postgres')
      ctx.git('add', '.')
      ctx.commit(
        'feat(api): migrate storage to Postgres and scope tasks to users',
      )

      ctx.fixtures('claude', 'context-fold', 'drift', '03-plans')

      ctx.log.step('Scenario ready: docs drift after a session pivot')
      ctx.log.info('Context: planning docs are stale relative to HEAD')
      ctx.log.info(
        '  canon/context/storage.md still says SQLite, but src/db.ts now uses Postgres',
      )
      ctx.log.info(
        "  REQUIREMENTS.md lists 'no multi-user support' as a non-goal, but createTask now takes userId",
      )
      ctx.log.info(
        '  .canon/plans/feature-postgres-migration.md and feature-some-old-plan.md must stay live',
      )
      ctx.log.info('')
      ctx.log.info(
        'Before invoking the skill, narrate the pivot to Claude in chat:',
      )
      ctx.log.info(
        "  'We pivoted this session: switched storage from SQLite to Postgres,'",
      )
      ctx.log.info(
        "  'and promoted multi-user support from non-goal to in-scope.'",
      )
      ctx.log.info('')
      ctx.log.info(
        'The diff makes the SQLite bullet in canon/context/storage.md untrue, so that entry is rewritten in place.',
      )
      ctx.log.info(
        'REQUIREMENTS.md stays unwritten. The fold reports the direction change and names document-health.',
      )
      ctx.log.info(
        "The fold writes no task file. Marking the shipped outcome is task-complete's.",
      )
      ctx.log.info('')
      ctx.log.info('Action:  /context-fold')
      ctx.log.info(
        'Expect:  declared in fixtures/claude/context-fold/drift/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:context-fold drift',
      )
      ctx.log.info(
        '         Two prose expectations need a reader and report as unchecked.',
      )
    },
    'context-entries': (ctx) => {
      ctx.fixtures('claude', 'context-fold', 'context-entries', '01-initial')
      ctx.git('add', '.')
      ctx.commit('feat(web): initial chat shell')

      ctx.git('checkout', '-b', 'feat/provider-switch', '-q')
      ctx.fixtures(
        'claude',
        'context-fold',
        'context-entries',
        '02-provider-switch',
      )
      ctx.git('add', '.')
      ctx.commit('feat(web): provider switch at the gate')

      ctx.fixtures('claude', 'context-fold', 'context-entries', '03-plan')

      ctx.log.step('Scenario ready: docs refreshes context entry from diff')
      ctx.log.info(
        'Context: feat/provider-switch branch with diff in src/features/chat/',
      )
      ctx.log.info(
        '         canon/context/development/web.md already exists. Its Layer responsibilities section names src/features/chat/.',
      )
      ctx.log.info('Action:  /context-fold')
      ctx.log.info(
        'Expect:  The fold reads the diff, maps src/features/chat/api-key-gate.tsx to web.md (which references that path)',
      )
      ctx.log.info(
        '         Rewrites the relevant section of canon/context/development/web.md from the diff content',
      )
      ctx.log.info(
        '         Does NOT create new entries (no auto-creation per design)',
      )
      ctx.log.info(
        '         Outputs a reminder line to run canon indexes regen',
      )
    },
  },
})
