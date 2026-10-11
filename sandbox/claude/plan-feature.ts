import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    full: (ctx) => {
      ctx.fixtures('claude', 'plan-feature', 'full', '01-initial')

      ctx.mkdir('.claude')

      ctx.mkdir('src')
      ctx.mkdir('src/routes')

      ctx.mkdir('.canon/tasks')

      ctx.git('add', '.')
      ctx.commit('feat(api): initial task endpoints')

      ctx.log.step('Scenario ready: feature planning (full mode)')
      ctx.log.info(
        'Context: task API with SQLite, Express routes, CLAUDE.md, and .canon/tasks/ present',
      )
      ctx.log.info(
        'Action:  /plan-feature (reference the task in .canon/tasks/)',
      )
      ctx.log.info(
        "Expect:  plan written to .canon/plans/feature-<slug>.md with files to touch, risks, and questions, each question carrying a Suggested line and an Answer slot, and v01.0-due-dates.md's Plan: line points at it",
      )
    },
    sourced: (ctx) => {
      ctx.fixtures('claude', 'plan-feature', 'sourced', '01-initial')

      ctx.mkdir('.claude')

      ctx.mkdir('src')
      ctx.mkdir('src/routes')

      ctx.mkdir('.canon/tasks')

      ctx.git('add', '.')
      ctx.commit('feat(api): initial charge endpoint')

      ctx.log.step('Scenario ready: feature planning (sourced)')
      ctx.log.info(
        'Context: charge endpoint calling a payment API, one task whose outcome rests on how that API treats a repeated idempotency key',
      )
      ctx.log.info(
        'Action:  /canon:plan-feature plan the task in .canon/tasks/v01.0-retry-charge.md',
      )
      ctx.log.info(
        "Expect:  plan carries a Sources section whose entry pairs an https link to the payment API's documentation with a double-quoted passage, or marks the source unverified. Needs outbound network",
      )
    },
    small: (ctx) => {
      ctx.fixtures('claude', 'plan-feature', 'small', '01-initial')

      ctx.mkdir('.claude')

      ctx.mkdir('.canon/tasks')

      ctx.git('add', '.')
      ctx.commit('chore(notes): initial notes repo')

      ctx.log.step('Scenario ready: feature planning (small mode)')
      ctx.log.info(
        'Context: prose-only repo, single README task, decoy DESIGN with sentinel text',
      )
      ctx.log.info(
        'Action:  /plan-feature (reference the task in .canon/tasks/)',
      )
      ctx.log.info(
        'Expect:  chat-only output, NO .canon/plans/ file written, decoys NOT surfaced',
      )
    },
    'multi-concern': (ctx) => {
      ctx.fixtures('claude', 'plan-feature', 'multi-concern', '01-initial')

      ctx.mkdir('src/routes')
      ctx.mkdir('docs')

      ctx.mkdir('.canon/tasks')

      ctx.git('add', '.')
      ctx.commit('chore(sandbox): initial state')

      ctx.log.step('Scenario ready: feature planning (multi-concern)')
      ctx.log.info(
        'Context: two unrelated tasks in .canon/tasks/, one API change and one prose edit',
      )
      ctx.log.info(
        "Action:  /plan-feature 'add pagination to /users and tighten the docs intro'",
      )
      ctx.log.info(
        "Expect:  two plan files in .canon/plans/, one per concern, not a single bundled slug, and each task's Plan: line points at its own plan",
      )
    },
    stacked: (ctx) => {
      ctx.fixtures('claude', 'plan-feature', 'stacked', '01-initial')

      ctx.mkdir('src/form')

      ctx.mkdir('.canon/tasks')

      ctx.git('add', '.')
      ctx.commit('feat(form): initial signup form')

      ctx.log.step('Scenario ready: feature planning (stacked)')
      ctx.log.info(
        'Context: one task with three outcomes that build in sequence over the same three source files',
      )
      ctx.log.info("Action:  /plan-feature 'plan the task'")
      ctx.log.info(
        'Expect:  one plan file in .canon/plans/, or every extra plan carrying a Judged apart from constraint with a reason, and canon records validate plans reports no stack-foldable',
      )
    },
    constraint: (ctx) => {
      ctx.fixtures('claude', 'plan-feature', 'constraint', '01-initial')

      ctx.mkdir('docs')
      ctx.mkdir('canon/context')

      ctx.mkdir('.canon/tasks')

      ctx.git('add', '.')
      ctx.commit('docs(reference): initial reference doc')

      ctx.log.step('Scenario ready: feature planning (constraint)')
      ctx.log.info(
        'Context: docs/reference.md split into a folder, cited by docs/onboarding.md and canon/context/pipeline.md',
      )
      ctx.log.info(
        "Action:  /plan-feature 'split docs/reference.md per the task. Constraint: leave canon/context/pipeline.md alone.'",
      )
      ctx.log.info(
        "Expect:  the plan's Constraints entry resolves both acts for pipeline.md, forbidding conforming it to the new shape and requiring its citations of the deleted path be retargeted, and v01.0-reference-split.md's Plan: line points at the plan",
      )
    },
    layout: (ctx) => {
      // Two roles share one flat folder: generic primitives any screen renders
      // and pieces only the cart screen renders. The arm scores whether the plan
      // adds three more components beside them or places them by role.
      ctx.fixtures('claude', 'plan-feature', 'layout', '01-initial')

      ctx.mkdir('src/components')
      ctx.mkdir('e2e')
      for (const component of [
        'Button',
        'Card',
        'Dialog',
        'Input',
        'Select',
        'Spinner',
        'Tooltip',
      ])
        ctx.write(
          `src/components/${component}.tsx`,
          `export function ${component}(props: { children?: React.ReactNode }) {\n  return <div className="${component}">{props.children}</div>\n}\n`,
        )
      for (const component of [
        'CartLine',
        'CartSummary',
        'CartEmpty',
        'CouponField',
        'ShippingPicker',
      ])
        ctx.write(
          `src/components/${component}.tsx`,
          `import { Card } from './Card'\n\nexport function ${component}() {\n  return <Card>${component}</Card>\n}\n`,
        )

      ctx.mkdir('.canon/tasks')

      ctx.git('add', '.')
      ctx.commit('feat(shop): initial storefront and cart')

      ctx.log.step('Scenario ready: feature planning (layout)')
      ctx.log.info(
        'Context: flat src/components/ mixing 7 primitives with 5 cart pieces, flat e2e/ mixing 2 specs with 2 helpers, one wishlist task',
      )
      ctx.log.info(
        'Before:  rm -rf .claude/skills/codebase-layout .claude/skills/plan-feature, since the injected copies carry no references/ and shadow the plugin',
      )
      ctx.log.info(
        'Action:  /canon:plan-feature plan the wishlist task in .canon/tasks/v01.0-wishlist.md',
      )
      ctx.log.info(
        "Expect:  plan names its new components under a subfolder rather than flat in src/components/, its new e2e helper outside the specs' folder, and a placement reason on each new path",
      )
    },
    vague: (ctx) => {
      // The ask names no number, so the only measurable criterion in reach is
      // the budget this file states. The arm scores whether the plan carries it.
      ctx.fixtures('claude', 'plan-feature', 'vague', '01-initial')

      ctx.mkdir('canon')

      ctx.mkdir('src/routes')

      ctx.git('add', '.')
      ctx.commit('feat(api): initial task list')

      ctx.log.step('Scenario ready: feature planning (vague)')
      ctx.log.info(
        'Context: task list API that filters in memory, canon/REQUIREMENTS.md states a 200 ms p95 budget for GET /tasks',
      )
      ctx.log.info('Action:  /canon:plan-feature make the task list faster')
      ctx.log.info(
        'Expect:  plan written whose Verification carries the stated budget as a number with a unit, with the success criteria settled before the file list',
      )
    },
    underspecified: (ctx) => {
      ctx.fixtures('claude', 'plan-feature', 'underspecified', '01-initial')

      ctx.mkdir('src')

      ctx.git('add', '.')
      ctx.commit('chore(app): initial app')

      ctx.log.step('Scenario ready: feature planning (underspecified)')
      ctx.log.info(
        'Context: one-line CLAUDE.md and one source file, no requirements, no tasks',
      )
      ctx.log.info('Action:  /canon:plan-feature improve the app')
      ctx.log.info(
        'Expect:  NO .canon/plans/ file written, and the session asks what the improvement must achieve before planning',
      )
    },
  },
})
