---
description: Enforce which specs and which engines an end-to-end run covers at each point in the loop
paths:
  - '**/e2e/**/*.ts'
  - '**/playwright.config.*'
---

# Test scope standards

## Selecting a run

- Narrow an end-to-end run by spec path or by test name. Never narrow it by engine, except with `--project` to reproduce a failure that engine has already reported.
- Run `playwright test -g '<name>'` for one named test while iterating on a behavior.
- Run `playwright test e2e/<area>.spec.ts` for one surface while iterating on that surface.
- Run `playwright test --only-changed` on uncommitted work, and `playwright test --only-changed=<trunk>` before a push.
- Leave the whole suite to CI per the `canon:test-craft` skill, reporting it when the skill does not resolve.
- Declare an engine in the Playwright config only where a CI job runs it. Remove it from the config or add it to CI when the two disagree.
- Do not add a script that pins a default run to one engine.

## Instruments

- Answer a question about the running page with a script against the dev server rather than with the suite.
- Enable `fullyParallel` in the Playwright config only where every test owns its state, such as its own server or data folder for a spec that writes.
- Follow the `canon:ui-craft` skill's capture reference for capture scope, reporting it when the skill does not resolve.
