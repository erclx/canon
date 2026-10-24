---
description: Enforce which specs and which engines an end-to-end run covers at each point in the loop
paths:
  - '**/e2e/**/*.ts'
---

# Test scope standards

## Selecting a run

- Narrow an end-to-end run by spec path or by test name. Never narrow it by engine.
- Run `playwright test -g '<name>'` for one named test while iterating on a behavior.
- Run `playwright test e2e/<area>.spec.ts` for one surface while iterating on that surface.
- Run `playwright test --only-changed` to select the specs a branch changed.
- Run the whole suite before pushing.
- Pass `--project` in a local run only to reproduce a failure that engine has already reported. The CI matrix passes it on every job, one engine per leg, which is the gate rather than a narrowed run.
- Do not add a script that pins a default run to one engine.

## Instruments

- Answer a question about the running page with a script against the dev server rather than with the suite.
- Do not enable `fullyParallel` in the Playwright config.
- Follow the `canon:ui-craft` skill's capture reference for capture scope, reporting it when the skill does not resolve.
- Follow `.claude/rules/canon/lib/e2e-reliability.md` for waits and guards.
