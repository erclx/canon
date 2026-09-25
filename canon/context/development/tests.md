---
title: Test scoping
description: Which change runs which src/ test, the census of corpora a src/ test asserts over from outside src/, the vitest invocation forms and their failure signatures, and the include and unused-import gaps
---

# Test scoping

## A `src/` test and the corpus it asserts over

Types and Tests run on a `src/` change, and Tests also runs on a change to any corpus a `src/` test asserts over from outside `src/`. `TEST_CORPORA_PATTERNS` in `src/gate/stages.ts` holds those corpora as patterns, and the Tests stage reads the joined result beside `^src/`, so a branch editing one of them runs the suite that covers it.

### The census

The array and the list below are two copies of one set with nothing comparing them. A corpus joining the census joins `TEST_CORPORA_PATTERNS` in the same change, and the direction that fails silently is the guard going stale while this entry reads current, so this entry is the carrier for that duty. A test asserting the regex against this prose would be a third copy, which a corpus this static does not earn.

- `claude/skills/*/SKILL.md`: `bun --bun vitest run src/claude/cases/all.test.ts`, then `bun --bun vitest run src/claude/skills-headings.test.ts`
- `governance/rules/ui/*.md` frontmatter globs: `bun --bun vitest run src/gov/list.test.ts`
- `governance/rules/` category folders: `bun --bun vitest run src/gov/adapter.test.ts`
- `standards/markdown.md`: `bun --bun vitest run src/standards/read.test.ts`
- `tooling/base/reference.md`: `bun --bun vitest run src/tooling/read.test.ts`
- `.cspell/banned-spellings.txt`: `bun --bun vitest run src/markdown/bans.test.ts`
- `.claude/hooks/` and `tooling/claude/seeds/.claude/hooks/`: `bun --bun vitest run src/hooks-guard.test.ts`
- `claude/skills/role-orchestrator/scripts/poll.sh`: `bun --bun vitest run src/orchestrate-poll.test.ts`
- `tooling/web/configs/scripts/worktree-port.sh`: `bun --bun vitest run src/worktree-port.test.ts`
- `scripts/lib/worktree.sh`: `bun --bun vitest run src/worktree-repair.test.ts`
- `scripts/core/check-ignore-parity.sh`: `bun --bun vitest run src/ignore-parity.test.ts`

The patterns and the rows differ at both ends rather than by an omission. `^claude/skills/` covers both the skill-body row and the `poll.sh` row, `^governance/rules/` covers both governance rows, and the hooks row expands into two patterns because its test reaches the seed copy as well. The patterns that are directory prefixes exist because their tests walk the tree whole, and two of those reach a rule or a skill a branch adds rather than edits. `src/gov/adapter.test.ts` asserts an absence, that `governance/rules/project/` ships empty because the subfolder is reserved for a target, so adding a rule there is what trips it.

### How the census reads a test

The census reads every file under `src/**/*.test.ts` that resolves a path outside `src/` against the repository root and asserts over what it finds there, and it excludes a test reading a fixture as data. That exclusion puts `src/comments/trend.test.ts` outside the set, since it replays fixed git revisions and skips itself when they are unreachable, and `src/commands/exit-code.test.ts`, which copies `src/` and `tsconfig.json` into a temp root. `src/gh-invocations.test.ts` and `src/ui.test.ts` resolve the repository root and then walk `src/` alone.

A temp root is not the repository root, which is the clause that decides three more. `src/commands/records-migrate.test.ts`, `src/commands/tooling-sync.test.ts`, and `src/records/backup.test.ts` each resolve against an `mkdtempSync` directory, so a sweep reading for the resolution form alone counts too many.

A file reaches the root two ways and a sweep reading for one of them undercounts. Most name a root constant, being `PROJECT_ROOT`, `import.meta.dirname`, or `process.cwd()`, and `src/markdown/bans.test.ts` names none: it passes `.cspell/banned-spellings.txt` to `Bun.file` as a bare relative path that resolves against the runner's working directory. Grep for the implicit form as well as the explicit one.

### Why Tests widened and Types did not

Tests admits the census and nothing wider. Widening to every change was the alternative and it charges twice as much for the same exposure: over a sample of 60 commits reaching `origin/main`, 42 already ran Tests under the `^src/` guard, 22 touched a census corpus, and 9 of those 22 ran no Tests stage at all. Widening newly charges the other 18, so the census reaches the whole measured gap at half the added load. The guard also admits `package.json`, `tsconfig.json`, and `vitest.config.ts`, so a release commit touching one of those pays the suite already.

Types was left alone. Every census entry is a test asserting over a corpus, and a typecheck over unchanged TypeScript reports what it reported last run. Types therefore still skips a branch that fails a test through a corpus: dropping `'**/*.astro'` from the `paths:` list in `governance/rules/ui/450-link-behavior.md` fails `src/gov/list.test.ts`, and Types reports `Skipped, no TypeScript changes` while Tests catches it.

The gap is narrowed to what the census names rather than closed, since a corpus the census has not named is unguarded until someone adds its prefix. It is a local gap alone, since `hasChanged` in `src/gate/sequencer.ts` returns true whenever scoping is off and `bun run check:ci` passes `--all`, so CI runs every stage on every change.

## Gotchas

### Run a single test file through `bun --bun vitest`

A single test file runs through `bun --bun vitest run <path>`, which is the form `package.json` spells in its `test` script, and never `bunx vitest run <path>`, `bun run vitest run <path>`, or bare `bun test`. Each wrong form fails with its own signature, and each reads like a regression rather than a bad invocation:

- Zero tests. Without `--bun`, vitest resolves under node, where a module reaching git through `$` from `bun` fails to import at collection time and the file reports zero tests rather than a failure. `Cannot find package 'bun' imported from src/git-ignore.ts` is one form of it.
- Failures a green tree does not have. A module calling `Bun.Glob`, `Bun.TOML`, or `Bun.YAML` without importing anything collects and runs under node, then throws `ReferenceError: Bun is not defined` at the call site, so the file reports ordinary failures pointing at a source line. `src/context/citations.ts` and `src/indexes/walk.ts` both show it under `bunx`.
- Every case failing identically. `src/commands/pr.test.ts` spawns `process.execPath`, which is node under `bunx`, so `src/cli.ts` never starts past its shebang, stdout comes back empty, and every case dies on `SyntaxError: Unexpected end of JSON input` at the test's own `JSON.parse` line.
- `TypeError: expect is not a function`. Bare `bun test` runs Bun's own test runner, and `it.concurrent(name, async ({ expect }) => ...)` reads its `expect` off a vitest-only context argument that runner never supplies.

Re-run the same file through `bun --bun` before opening the source, since the tests pass unchanged under the right form.

### A shell script's own test file does not gate the script

A shell script under `claude/skills/*/scripts/` gates only the Shell stage unless its corpus is in the census, even where a `src/*.test.ts` file covers it. A branch touching only such a script can report clean on `bun run check` and on `bash -n` alike while the test that covers its behavior never runs. Run the test file by hand for a corpus the census never named.

### A root-level test file needs its own vitest include entry

`vitest.config.ts`'s `test.include` reads `src/**/*.test.ts` alone, so a test file sitting beside a root config it exercises, such as `commitlint.config.test.ts` beside `commitlint.config.js`, never runs under `bun run test` or the Tests stage. Neither reports a failure, since vitest finds no matching file to run there, so the gap surfaces only as a suite that passed without asserting anything for the new file. A plan calling for that shape of test widens `include` with a bare `*.test.ts` entry alongside the existing one.

### No stage reports an unused import

`check:types` is `tsc --noEmit` and `tsconfig.json` sets `strict` without `noUnusedLocals` or `noUnusedParameters`, and no JavaScript or TypeScript linter runs anywhere in the sequence, since `check:format` is prettier, `check:shell` is shellcheck, and `check:spell` is cspell. A dead import therefore passes a green check and reaches history, caught only by reading the file. The same stage does catch a duplicate function implementation, as TS2393, so two helpers colliding on one name inside a large file fails the gate rather than shadowing at runtime.
