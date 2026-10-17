---
title: Verification
description: How bun run check scopes stages to the changed-file set, why the baseline is the remote ref, the process tier, the install gate, and the index gotchas
---

# Verification

## Decisions

### Scoped verification

`bun run check` gates three stages on the changed-file set. Shell runs on any `.sh` change, types on any `src/` change, and tests on `src/` or any corpus a `src/` test asserts over, which `canon/context/development/tests.md` censuses. Format and the regeneration stages always run, because their inputs are diffuse.

Skipping tests, types, and shell on a markdown-only edit drops roughly 16 of the 31 CPU-seconds measured across the gate, most of it the test suite.

- The changed set unions the branch diff against the merge base with `origin/main`, the working tree, and untracked files, which matches what a pull request will contain
- Every fallback widens rather than narrows, and a missing merge base runs every stage
- Pass `--all` to force the full suite and `--help` for the argument list
- `bun run check:ci` passes `--all`, so CI stays the backstop for a wrong local scoping decision

### The baseline is the remote ref

The baseline is `origin/main` rather than local `main`. On `main` itself the local ref is HEAD, so the merge base resolves to HEAD and every unpushed commit drops out of the changed set, and `pre-push` would skip the scoped stages on a direct push to `main`.

`.github/workflows/verify.yml` triggers on pushes to `main` too, but catches that case after the push rather than before. When `origin/main` does not resolve, which happens transiently during a concurrent `fetch --prune`, the fallback to local `main` treats a merge base equal to HEAD as a signal to run every stage.

### The process tier

`src/process/harness.ts` spawns `src/cli.ts` as a real process against a temporary directory rather than calling an action in-process. A case can then assert what an in-process call cannot, being whether a verb is registered, whether it exits as its contract states, and whether a `--json` record parses off stdout alone.

`src/process/harness.test.ts` covers the harness and `src/process/verbs.test.ts` the verbs. `gate run` is the one verb whose stages a case does not drive.

- The last stage runs `bun run test`, so a case spawning the gate spawns the suite that spawns the case, with no floor
- Every stage reads this checkout by design, so a per-case temporary directory measures the wrong tree
- The regenerating stages write to whatever they read, so a case running the gate would rewrite generated files under the suite
- The cases assert only that the verb the package scripts name is registered, while `src/gate/sequencer.test.ts` covers the sequencing with an injected runner

### The one spawning case

`src/commands/checkout-mismatch.test.ts` spawns `canon gate run` anyway, asserting the wrong-checkout warning, and survives the recursion by never waiting on the child. `runGate` logs the warning ahead of `runStages` in both forms, so the case kills the child when that line reaches stderr, before the first stage starts.

The ordering is load-bearing. Deferring the warning until every stage had run left a killed child's subprocess tree still spawning, orphaning `cli.ts gate run --json` processes that never exited.

### Adding a process case

Write a fixture under a per-test `mkdtempSync` directory, being a golden config, a rule stack, or a task board, whatever the verb reads. Assert the resulting file tree, the exit code, and the parsed record together rather than any one alone.

- An exit code alone can misreport, since a shell profile may wrap the binary, which is why every task verb tells a caller to branch on the record's `reason`
- A written file alone says nothing about whether the process reported the write correctly
- Assert a written tree with named paths plus a count derived from the verb's catalog, such as `gov list --json --stacks`, since a hardcoded figure fails on every unrelated addition

### Containment

`runCli` asserts its own containment on every call. `gov install` and `gov sync` record their target into `stateDir()/targets.json` through `src/targets/registry.ts`, and `canon sandbox` resolves its tree under the same parent, so a case inheriting the real `HOME` writes into the machine running the suite.

- `runCli` points both overrides at folders under the case's own `cwd`
- It snapshots the whole `stateDir()` tree before and after every spawn and throws `ContainmentViolation` when the two disagree
- `snapshotStateDir` walks recursively, so a write nested in an existing folder shows up like a new top-level entry
- The comparison is a pure function, `detectStateLeak`, so `harness.test.ts` covers the detection without touching the filesystem
- `spawnSync` carries a 10-second timeout, since a synchronous spawn cannot be interrupted by a framework timeout and a blocked verb would hang the run

The tier folds into `bun --bun vitest run`, so `bun run check` and CI both run it. Nineteen cases across six verbs cost 1.6 wall seconds and 4.5 CPU seconds, measured 2026-08-31, the number to recheck once the case count reaches fifty.

## Gotchas

### The install gate

`bun run check:install` runs `git clone` on the project root, so it verifies the last commit and never the working tree. An uncommitted fix or regression is invisible to it, so commit first or the result describes code you are not shipping.

- Its assert loop is the only thing between a silently truncated install and a green run, because `runDomains` in `src/init/run.ts` catches a failed domain and lets init report the ones that worked
- Every domain init installs needs at least one asserted path, or it can install nothing while the gate stays green
- The gate runs `canon init --stack base` rather than a bare `init`, though `base` is the default, to pin what the assertions cover
- A domain that installs conditionally needs its condition met in the gate invocation

### Failure strings in a passing check

A passing `bun run check` prints three `Failed, run manually` lines. Vitest passes a test's stderr through, and `src/init/run.test.ts` exercises that failing-domain branch deliberately, so grepping the output for failure strings reports a regression that does not exist. Read the closing `✓ Verification passed` line and the vitest summary.

### Rank a stage by processor seconds

Rank verification stages by CPU seconds rather than elapsed time, because a stage fanning across cores finishes fast and costs the most. By wall clock the tests look cheapest, around 931ms.

`/usr/bin/time -f 'user %U sys %S wall %e cpu %P'` shows them the most expensive stage at 11.76 CPU seconds and 1169 percent peak CPU, 38 percent of a roughly 31 CPU second total, delivered in one wall second. Test-count growth is invisible in wall time and linear in CPU, so state which measure a cost claim rests on.

### The Indexes stage reports its own regeneration

The Indexes stage asserts drift against the working tree, so the first `bun run check` after a frontmatter edit reports its own regeneration as drift and exits red. Stage or commit the rewritten `index.md` and run again. `canon/context/development/regeneration.md` covers the shape, except that this walk writes files the session never opened.

- The pathspec matches by name, so an unstaged hand edit to any `*index.md`-matching file trips the failure, `auto: false` or not
- A file under `auto: false` that `canon indexes regen` correctly skips still reports as drifted until staged
- A new untracked file such as a fixture page called `element-index.md` fails the stage with "Indexes drifted", so name such a file so it does not end in `index.md`

### Other stage gotchas

Re-read every citation into a file after moving anything above the line it names, since no stage compares a cited line number against what sits there. The gate's stages carry named identifiers in `src/gate/` to cite instead, but any entry citing a line number into a file it does not own carries the same exposure.

`check:types` needs `typescript` declared in `devDependencies` rather than hoisting from an astro peer, or the gate resolves by accident.

### A fixed port in the static test

`src/serve/static.test.ts`'s "should walk past a port already in use" test binds `DEFAULT_PORT` (8787) directly, so any unrelated listener holding that port fails the test with `bind-failed` on the first `start()` call, whatever diff is under review. A leaked `canon serve` on a nearby port is a misleading lead.

Confirm which process holds `DEFAULT_PORT` with `ss` or `lsof` before naming a cause. Killing it clears one instance without closing the defect, which is the test binding a fixed port on a shared machine.
