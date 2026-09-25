---
title: Verification
description: How bun run check scopes stages to the changed-file set, why the baseline is the remote ref, the process tier, the install gate, ranking a stage by processor seconds, and the index and spelling gotchas
---

# Verification

## Scoped verification

`bun run check` gates three stages on the changed-file set. Shell runs on any `.sh` change, types on any `src/` change, and tests on `src/` or on any corpus a `src/` test asserts over, which `canon/context/development/tests.md` censuses. Format, spelling, and the regeneration stages always run, because their inputs are diffuse. Skipping tests, types, and shell on a markdown-only edit drops roughly 16 of the 31 CPU-seconds measured across the gate, and the test suite alone accounts for most of that.

The changed set unions the branch diff against the merge base with `origin/main`, the working tree, and untracked files, which matches what a pull request will contain. Every fallback widens rather than narrows. A missing merge base runs every stage.

The baseline is `origin/main` rather than local `main`. On `main` itself the local ref is HEAD, so the merge base resolves to HEAD and every commit not yet pushed drops out of the changed set, and `pre-push` would skip the scoped stages on a direct push to `main`. `.github/workflows/verify.yml` triggers on pushes to `main` as well as on pull requests, but it catches that case after the push rather than before, so comparing against the remote ref is what keeps committed work visible.

When `origin/main` does not resolve, which happens transiently during a concurrent `fetch --prune`, the fallback to local `main` treats a merge base equal to HEAD as a signal to run every stage.

Pass `--all` to force the full suite, and `--help` to print the argument list. `bun run check:ci` passes `--all`, so CI stays the backstop for a wrong local scoping decision on the pull request path.

## The process tier

`src/process/harness.ts` spawns `src/cli.ts` as a real process against a temporary directory rather than calling a command's action function in-process. A case can then assert what an in-process call cannot: whether a verb is registered at all, whether the process exits the way its own contract states, and whether a `--json` record parses off stdout alone once stderr framing is set aside. `src/process/harness.test.ts` covers the harness itself, and `src/process/verbs.test.ts` covers the verbs.

`gate run` is the one verb there whose stages a case does not drive. The last stage runs `bun run test`, so a case spawning the gate spawns the suite that spawns the case, and the recursion has no floor. Every stage also reads this checkout by design, so a per-case temporary directory measures the wrong tree, and the first stage writes to whatever it read, so a case running the write side would reformat the repository under the suite.

The cases assert only that the verb the two package scripts name is registered. The stages themselves run end to end on every branch, by `pre-push` and by `bun run check:ci`, and the sequencing around them is covered in `src/gate/sequencer.test.ts` with an injected runner.

`src/commands/checkout-mismatch.test.ts` carries the one case that spawns `canon gate run` anyway, asserting the wrong-checkout warning reaches the verb, and it survives the recursion by never waiting on the child. `runGate` logs the warning ahead of `runStages` on both the bare and the `--json` form, so the case kills the child the instant that line reaches stderr, before the first stage starts. Logging the warning ahead of the stages is load-bearing: deferring it until every stage had run left a killed child's subprocess tree still spawning, orphaning `cli.ts gate run --json` processes that never exited.

### Adding a case

Write a fixture under a per-test `mkdtempSync` directory, being a golden config, a rule stack, or a task board, whatever the verb reads, and assert the resulting file tree, the exit code, and the parsed record together rather than any one alone. An exit code alone can misreport a wrapped shell function per `canon/ARCHITECTURE.md`, and a written file alone says nothing about whether the process reported the write correctly. Assert a written tree with named paths plus a count derived from the catalog the verb reads, such as the stack's own rule list off `gov list --json --stacks`, rather than a hardcoded figure, which fails on every unrelated addition.

### Containment

`runCli` asserts its own containment on every call rather than trusting a case to. `gov install` and `gov sync` both record their target into `stateDir()/targets.json` through `src/targets/registry.ts`, and `canon sandbox` resolves its tree through `sandboxTree()` under the same `stateDir()` parent, so a case inheriting the real `HOME` writes into the machine that ran the suite. `runCli` points both overrides at folders under the case's own `cwd`, and snapshots the whole `stateDir()` tree before and after every spawn regardless, throwing `ContainmentViolation` the moment the two disagree.

`snapshotStateDir` walks the tree recursively rather than reading the registry file alone, so a write nested inside an existing folder shows up the same as a new top-level entry. The comparison is a pure function, `detectStateLeak`, so `harness.test.ts` covers the detection logic without touching the filesystem. `spawnSync` carries a 10-second timeout, since a synchronous spawn cannot be interrupted by a framework timeout and a blocked verb would otherwise hang the whole run rather than failing one case.

The tier folds into `bun --bun vitest run` rather than a step of its own, so `bun run check` and CI both run it. Nineteen cases across six verbs cost 1.6 wall seconds and 4.5 CPU seconds, measured 2026-08-31, which is the number to recheck once the case count reaches fifty.

## Gotchas

### The install gate

`bun run check:install` runs `git clone` on the project root, so it verifies the last commit and never the working tree. An uncommitted fix, or an uncommitted regression, is invisible to it. Commit first or the result describes code you are not shipping.

Its assert loop is the only thing between a silently truncated install and a green run, because `runDomains` in `src/init/run.ts` catches a failed domain and lets init report the ones that worked. Every domain init installs needs at least one asserted path, or that domain can install nothing while the gate stays green.

A passing `bun run check` prints three `Failed, run manually` lines. Vitest passes a test's stderr through, and `src/init/run.test.ts` exercises that failing-domain branch deliberately, so grepping the check output for failure strings reports a regression that does not exist. Read the closing `✓ Verification passed` line and the vitest summary instead.

The gate runs `canon init --stack base` rather than a bare `init`, though `base` is the default. The explicit flag pins what the assertions cover rather than inheriting whatever the default becomes. A domain that installs conditionally needs its condition met in the gate invocation, beyond having a path in the loop.

### Rank a stage by processor seconds

Rank verification stages by CPU seconds rather than by elapsed time, because a stage that fans across cores finishes fast and costs the most. Timing `bun run check` by wall clock makes the tests look like the cheapest stage, landing around 931ms. Timing with `/usr/bin/time -f 'user %U sys %S wall %e cpu %P'` instead shows the tests are the most expensive stage at 11.76 CPU seconds and 1169 percent peak CPU, 38 percent of a roughly 31 CPU second total, delivered in one wall second.

Test-count growth is invisible in wall time and linear in CPU. State which measure a cost claim rests on, since wall clock still answers how long a human waits.

### The Indexes stage reports its own regeneration

The Indexes stage asserts drift against the working tree, so the first `bun run check` after a frontmatter edit reports its own regeneration as drift and exits red. Stage or commit the rewritten `index.md` and run again. This is the regenerate-then-assert shape `canon/context/development/regeneration.md` covers, except that the walk writes files the session never opened, so the failure names work nobody did by hand.

The pathspec matches by name rather than by how a file changed, so an unstaged hand edit to any `*index.md`-matching file trips the same failure, `auto: false` or not. A file under `auto: false` frontmatter that `canon indexes regen` correctly skips still reports as drifted until it is staged. The same name match reaches a file that is no index at all: a new untracked file such as a fixture page called `element-index.md` fails the stage with "Indexes drifted", so name such a file so it does not end in `index.md`.

### Spelling exemptions

`.cspell/banned-spellings.txt` is a third dictionary holding the British spellings `canon markdown audit` reports, and an `overrides` entry in `cspell.json` scopes it to the files that carry, assert, or explain the set rather than loading it repo-wide. Both gate a push, the spell check over the whole tree and the audit over its ban half, so a repo-wide load would spell-approve everywhere the words the ban gate still fails on. A file that needs one of them is added to the override list, never to `project-terms.txt`, which reads as vocabulary this repository writes.

Its membership is the shipped `SPELLINGS` plus `analyse`, a word no set carries and a comment in `src/markdown/bans.ts` explains the absence of. The two are therefore not the same list and neither derives from the other, which is what `bans.test.ts` asserts.

cspell has no way to recognize a base64 payload as non-prose, so a generated TypeScript module holding one as a string literal, such as `src/design/fonts.ts` embedding WOFF2 font data, floods `check:spell` with an unknown-word finding for nearly every substring. Add the file's path to `cspell.json`'s `ignorePaths` rather than growing `project-terms.txt` with meaningless fragments, the way `tooling/**` is exempted wholesale.

A path-level entry exempts a whole file, which is too wide for a percent-encoded data URI sitting in one line of ordinary prose, such as an inline SVG favicon in a shipped skill body. Each percent-encoded angle bracket glued to the tag name after it reads as one unknown word. `cspell.json`'s `ignoreRegExpList` closes this at the substring instead: a pattern matching from `data:image/svg+xml,` to the next `"` skips the encoded segment without exempting the prose around it.

### Other stage gotchas

Re-read every citation into a file after moving anything above the line it names, since no stage compares a cited line number against what sits there. The gate's stages carry named identifiers in `src/gate/` to cite instead, but any entry citing a line number into a file it does not own carries the same exposure, and nothing sweeps for it.

`check:types` needs `typescript` declared in `devDependencies` rather than relying on it hoisting from an astro peer, or the gate resolves by accident.

`src/serve/static.test.ts`'s "should walk past a port already in use" test binds `DEFAULT_PORT` (8787) directly, so any unrelated listener already holding that port fails the test with `bind-failed` on the first `start()` call, whatever diff is under review. A leaked `canon serve` on a nearby port is a misleading lead. Read what the failure reports, `bind-failed` on the first bind rather than an off-by-one on the walk, and confirm which process holds `DEFAULT_PORT` with `ss` or `lsof` before naming a cause. Killing that process clears one instance without closing the defect, which is the test binding a fixed port on a shared machine.
