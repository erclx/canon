---
description: Enforce which specs and which engines an end-to-end run covers at each point in the loop
paths:
  - 'e2e/*.ts'
  - 'e2e/**/*.ts'
---

# Test scope standards

## Selecting a run

- Narrow an end-to-end run by spec path or by test name. Never narrow it by engine.
- Run one named test while iterating on a behavior: `bun run test:e2e -- -g '<name>'`.
- Run one surface while iterating on that surface: `bun run test:e2e -- e2e/<area>.spec.ts`.
- Run `bun run test:e2e:changed` to select specs from the import graph.
- Run the whole suite before pushing.
- Pass `--project` in a local run only to reproduce a failure that engine has already reported. The CI matrix passes it on every job, one engine per leg, which is the gate rather than a narrowed run.
- Do not add a script that pins a default run to one engine.

## Instruments

- Answer a question about the running page with a script against the dev server rather than with the suite.
- Do not enable `fullyParallel` in `playwright.config.ts`.
- Follow `.claude/rules/canon/ui/440-surface-capture.md` for capture scope.
- Follow `.claude/rules/canon/lib/305-e2e-reliability.md` for waits and guards.
