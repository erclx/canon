import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      ctx.fixtures('claude', 'ui-audit', 'shared', '01-initial')

      ctx.mkdir('.claude')
      ctx.git('add', '.')
      ctx.commit('feat(ui): initial task list and add modal')

      ctx.log.step('Scenario ready: UI audit with seeded drift')
      ctx.log.info(
        'Context: small Vite/React app with DESIGN.md and components that drift on purpose',
      )
      ctx.log.info('Seeded drift to look for in the audit:')
      ctx.log.info("  Button.tsx adds a third variant 'ghost' not in DESIGN.md")
      ctx.log.info('  Button.css uses raw 12px/18px instead of --space tokens')
      ctx.log.info(
        '  TaskList.tsx mixes Lucide and MUI icons (DESIGN.md says Lucide only)',
      )
      ctx.log.info('  TaskList.tsx uses inline px styles instead of tokens')
      ctx.log.info(
        '  TaskList.tsx renders nothing while loading (no skeleton state in DESIGN.md)',
      )
      ctx.log.info(
        '  TaskList.tsx has no empty state (DESIGN.md describes one)',
      )
      ctx.log.info('  TaskList.tsx has no error state')
      ctx.log.info(
        '  AddTaskModal.tsx has two primary buttons. Cancel should be secondary',
      )
      ctx.log.info('Action:  /ui-audit')
      ctx.log.info(
        'Expect:  observations grouped by surface, written to .canon/review/ui-audit-<slug>.md',
      )
    },
  },
})
