---
title: Test scope rule ledger
description: Sources for governance/rules/lib/test-scope.md, one row per bullet
---

# Test scope rule ledger

The field is browser test automation, and the authority is the Playwright documentation, read at playwright.dev and from its source in the microsoft/playwright repository. The rule ships to every Playwright target, so it names the Playwright CLI rather than a package script a target may not carry. None of the pages read names a Playwright major, so the rows record the read date alone.

## Selecting a run

| Bullet                                   | Source                                                                                                                                                                                                                                                                                     | Read       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Narrow by path or name, never engine     | House choice: a run narrowed to one engine passes while another engine fails, and the gap surfaces only in CI                                                                                                                                                                              | 2026-11-25 |
| One test by name                         | [Command line](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/test-cli-js.md): `-g` will "Only run tests matching this regular expression"                                                                                                                           | 2026-10-18 |
| One surface by path                      | [Command line](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/test-cli-js.md): "Run a single test file" by passing its path                                                                                                                                          | 2026-10-18 |
| `--only-changed`, bare and with a ref    | [Command line](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/test-cli-js.md): "Only run test files that have been changed between 'HEAD' and 'ref'. Defaults to running all uncommitted changes", so a bare run before a push selects nothing on a committed branch | 2026-11-25 |
| Suite to CI, engines it leaves out local | Routing to `canon:test-craft`, which carries the sourced split. House choice on the engines: a CI job passing one `--project` gates that engine alone, so without a push run the others are tested nowhere                                                                                 | 2026-11-25 |
| `--project` in two cases                 | [Command line](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/test-cli-js.md): `--project` will "Only run tests from the specified list of projects", where the default is to "run all projects"                                                                     | 2026-11-25 |
| No one-engine script                     | House choice: a script pinning one engine becomes the run everyone types, which is the engine narrowing the first bullet bans                                                                                                                                                              | 2026-10-18 |

## Instruments

| Bullet                                | Source                                                                                                                                                                                                                                                                                                    | Read       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A script, not the suite               | House choice: a suite run answers a question about the page only through assertions written for another question, and costs the whole run                                                                                                                                                                 | 2026-10-18 |
| `fullyParallel` where tests own state | [Sharding](https://playwright.dev/docs/test-sharding): "it is recommended to use fullyParallel: true when aiming for balanced distribution across shards". [Parallelism](https://playwright.dev/docs/test-parallel) sets the condition, since parallel tests "cannot share any state or global variables" | 2026-11-25 |
| Pointer to `ui-craft`                 | House choice: a pointer to the skill that owns capture scope, claiming no practice of its own                                                                                                                                                                                                             | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### A script a target may lack

- Replaced `bun run test:e2e -- -g '<name>'` with `playwright test -g '<name>'`. The `test:e2e` scripts are this toolkit's alone, and the rule ships to every Playwright target.
- Replaced `bun run test:e2e -- e2e/<area>.spec.ts` with the CLI's path argument.
- Replaced `bun run test:e2e:changed`, which selected specs from the import graph, with `--only-changed`, the CLI's own selection by git diff.

### Carried by another surface

- Cut the pointer at `e2e-reliability`. Its globs match this rule's, so both always load together and the pointer repeats a load that already happens.

### Merged or reworded

- Named the Playwright config in the `fullyParallel` bullet rather than the `playwright.config.ts` filename, since a target may write the config in JavaScript.

### Overtaken by CI

- Replaced the whole suite before a push with the changed specs. It repeated what CI runs on every pull request, and timeouts on a loaded machine read as failures.
- Cut the sentence naming a CI matrix of one engine per leg. A shipped workflow gating one engine has no such matrix, so the rule now keys on what CI runs.
- Replaced the ban on `fullyParallel`. It held a sharded suite at file granularity even where each test owns its state, and Playwright recommends the setting for balanced shards.
