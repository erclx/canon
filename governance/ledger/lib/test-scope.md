---
title: Test scope rule ledger
description: Sources for governance/rules/lib/test-scope.md, one row per bullet
---

# Test scope rule ledger

The field is browser test automation, and the authority is the Playwright documentation, read at playwright.dev and from its source in the microsoft/playwright repository. The rule ships to every Playwright target, so it names the Playwright CLI rather than a package script a target may not carry. None of the pages read names a Playwright major, so the rows record the read date alone.

## Selecting a run

| Bullet                               | Source                                                                                                                                                                                                                 | Read       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Narrow by path or name, never engine | House choice: a run narrowed to one engine passes while another engine fails, and the gap surfaces only in CI                                                                                                          | 2026-10-18 |
| One test by name                     | [Command line](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/test-cli-js.md): `-g` will "Only run tests matching this regular expression"                                                       | 2026-10-18 |
| One surface by path                  | [Command line](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/test-cli-js.md): "Run a single test file" by passing its path                                                                      | 2026-10-18 |
| `--only-changed`                     | [Command line](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/test-cli-js.md): "Only run test files that have been changed between 'HEAD' and 'ref'"                                             | 2026-10-18 |
| Whole suite before push              | House choice: a narrowed run skips the specs a change broke without touching, which the push would hand to CI                                                                                                          | 2026-10-18 |
| `--project` only to reproduce        | [Command line](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/test-cli-js.md): `--project` will "Only run tests from the specified list of projects", where the default is to "run all projects" | 2026-10-18 |
| No one-engine script                 | House choice: a script pinning one engine becomes the run everyone types, which is the engine narrowing the first bullet bans                                                                                          | 2026-10-18 |

## Instruments

| Bullet                       | Source                                                                                                                                                                                                      | Read       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A script, not the suite      | House choice: a suite run answers a question about the page only through assertions written for another question, and costs the whole run                                                                   | 2026-10-18 |
| No `fullyParallel`           | [Parallelism](https://playwright.dev/docs/test-parallel): by default "Tests in a single file are run in order, in the same worker process", and parallel tests "cannot share any state or global variables" | 2026-10-18 |
| Pointer to `ui-craft`        | House choice: a pointer to the skill that owns capture scope, claiming no practice of its own                                                                                                               | 2026-10-18 |
| Pointer to `e2e-reliability` | House choice: a pointer to the rule that owns waits and guards, claiming no practice of its own                                                                                                             | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### A script a target may lack

- Replaced `bun run test:e2e -- -g '<name>'` with `playwright test -g '<name>'`. The `test:e2e` scripts are this toolkit's alone, and the rule ships to every Playwright target.
- Replaced `bun run test:e2e -- e2e/<area>.spec.ts` with the CLI's path argument.
- Replaced `bun run test:e2e:changed`, which selected specs from the import graph, with `--only-changed`, the CLI's own selection by git diff.

### Merged or reworded

- Named the Playwright config in the `fullyParallel` bullet rather than the `playwright.config.ts` filename, since a target may write the config in JavaScript.
