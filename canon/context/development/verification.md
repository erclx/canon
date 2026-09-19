---
title: Verification
description: How bun run check scopes stages to the changed-file set, why the baseline is the remote ref, and the gotchas of running the suite
---

# Verification

## Scoped verification

`bun run check` gates three stages on the changed-file set. Shell runs on any `.sh` change, types on any `src/` change, and tests on `src/` or on any corpus a `src/` test asserts over, per the decision under the second gotcha below. Format, spelling, and the four regeneration stages always run, because their inputs are diffuse. Skipping tests, types, and shell on a markdown-only edit drops roughly 16 of the 31 CPU-seconds measured across the gate, and the test suite alone accounts for most of that.

The changed set unions the branch diff against the merge base with `origin/main`, the working tree, and untracked files, which matches what a pull request will contain. Every fallback widens rather than narrows. A missing merge base runs every stage.

The baseline is `origin/main` and not local `main` for a reason. On `main` itself the local ref is HEAD, so the merge base resolves to HEAD and every commit not yet pushed drops out of the changed set. `pre-push` would then skip the scoped stages on a direct push to `main`.

`.github/workflows/verify.yml` now catches that case, since it triggers on pushes to `main` as well as on pull requests, but it catches it after the push rather than before. Comparing against the remote ref keeps committed work visible.

When `origin/main` does not resolve, which happens transiently during a concurrent `fetch --prune`, the fallback to local `main` treats a merge base equal to HEAD as a signal to run every stage.

Pass `--all` to force the full suite, and `--help` to print the argument list. `bun run check:ci` passes `--all`, so CI stays the backstop for a wrong local scoping decision on the pull request path.

Measure CPU seconds and not wall clock when judging a stage's cost. The suite fans 415 tests across every core, so it is the most expensive stage and among the fastest, and ranking by wall time hides it. Test-count growth is invisible in wall time and linear in CPU.

## The process tier

`src/process/harness.ts` spawns `src/cli.ts` as a real process against a temporary directory rather than calling a command's action function in-process, so a case can assert what an in-process call cannot: whether a verb is registered at all, whether the process exits the way its own contract states, and whether a `--json` record parses off stdout alone once stderr framing is set aside. `src/process/harness.test.ts` covers the harness itself, proving a registered verb passes and a subcommand nothing registers fails. `src/process/verbs.test.ts` covers `gov install`, `gov sync`, `tooling sync`, `tasks archive`, one `list --json` verb, and `gate run`.

`gate run` is the one entry there whose stages a case does not drive, and the reason is not cost. The last stage runs `bun run test`, so a case spawning the gate spawns the suite that spawns the case, and the recursion has no floor. Two more reasons sit behind that one: every stage reads this checkout by design, so pointing the run at a per-case temporary directory measures the wrong tree, and the first stage writes to whatever it read, so a case running the write side would reformat the repository under the suite. What the cases answer instead is whether the verb the two package scripts now name is registered in the binary at all, which is the defect class the tier exists for and the one an in-process call cannot see. The stages themselves are driven end to end twice on every branch, by `pre-push` and by `bun run check:ci` on the pull request, and the sequencing around them is covered in `src/gate/sequencer.test.ts` with an injected runner.

`src/commands/checkout-mismatch.test.ts` carries the one case that spawns `canon gate run` anyway, asserting the wrong-checkout warning reaches the verb, and it survives the recursion trap by never waiting on the child. `runGate` spawns every stage against `PROJECT_ROOT` rather than the caller's `cwd`, and its warning logs ahead of `runStages` on both the bare and the `--json` form, so the case kills the child the instant that line reaches stderr, well before the first stage starts. Logging the warning ahead of the stages is load bearing: deferring it until every stage had run left a killed child's subprocess tree still spawning, orphaning `cli.ts gate run --json` processes that never exited.

Add a case by writing a fixture under a per-test `mkdtempSync` directory, being a golden config, a rule stack, or a task board, whatever the verb reads, and assert the resulting file tree, the exit code, and the parsed record together rather than any one alone. An exit code alone can misreport a wrapped shell function per `canon/ARCHITECTURE.md`, and a written file alone says nothing about whether the process reported the write correctly. Assert a written tree with named paths plus a count derived from the catalog the verb reads, such as the stack's own rule list off `gov list --json --stacks`, rather than a hardcoded figure. A whole-tree snapshot, or a count frozen at what one pass measured, fails on every unrelated addition, which is the shape `.claude/rules/canon/core/010-testing.md` already forbids.

`runCli` asserts its own containment on every call rather than trusting a case to. `gov install` and `gov sync` both record the target they ran against into `stateDir()/targets.json` at `src/targets/registry.ts`, and a case inheriting the real `HOME` unmodified writes a row for a directory `afterEach` is about to delete, leaving a dead entry on the machine that ran the suite. `canon sandbox` shares the same exposure through `sandboxTree()` in `src/commands/sandbox.ts`, which resolves `CANON_SANDBOX_DIR` then `XDG_STATE_HOME` the same three ways and lands under the same `stateDir()` parent. `runCli` points both overrides at folders under the case's own `cwd`, which `stateDir()` and `sandboxTree()` each read first, and snapshots the whole `stateDir()` tree before and after every spawn regardless, throwing `ContainmentViolation` the moment the two disagree. `snapshotStateDir` walks the tree recursively rather than reading the registry file alone, so a write nested inside an existing folder, such as the sandbox tree, shows up the same as a new top-level entry, and a corpus `stateDir()` grows a third member into needs no new case to stay covered. The comparison itself is a pure function, `detectStateLeak`, so `harness.test.ts` covers the detection logic without touching the filesystem, and a `describe('containment')` case asserts the real state directory survives a `gov install` plus `gov sync` run unchanged. `spawnSync` also carries a 10-second timeout, since a synchronous spawn cannot be interrupted by a framework timeout and a blocked verb would otherwise hang the whole run rather than failing one case.

The tier folds into `bun --bun vitest run` rather than a step of its own, so `bun run check` and CI both already run it. Nineteen cases across six verbs plus the harness's own containment coverage cost 1.6 wall seconds and 4.5 CPU seconds, measured 2026-08-31, which is the number to recheck once the case count reaches fifty before assuming the tier stays cheap.

## Gotchas

### A shell script's own test file does not gate the script

Types and tests run on any `src/` change alone, so a shell script under `claude/skills/*/scripts/` gates only the Shell stage even where a `src/*.test.ts` file covers it. `claude/skills/role-orchestrator/scripts/poll.sh` and `src/orchestrate-poll.test.ts` are one such pair. A branch touching only the script can report clean on `bun run check` and on `bash -n` alike while the classifier crashes on a carried line. Tests admits the census in the decision below, which reaches that pair, so run the specific test file by hand only for a corpus the census never named, through `bun --bun vitest run <path>` rather than bare `bun test`, which the `## The other stages` section rules out for every file in this repository.

### A `src/` test does not gate the corpus it asserts over

The direction above is half of one gap and this is the other half. The Types and Tests stages are the last two entries in `STAGES` in `src/gate/stages.ts`, and both are guarded on `^src/` plus a config file or two, so a branch editing a corpus outside `src/` runs neither stage even where a `src/` test asserts over that corpus. Tests closes that half in the decision below and Types does not.

Types alone still shows the gap: dropping `'**/*.astro'` from the `paths:` list in `governance/rules/ui/450-link-behavior.md` fails `src/gov/list.test.ts`, and Types skips with `Skipped, no TypeScript changes` on that tree since its scope covers `src/` alone, even though Tests now runs and catches it through the census below.

**The count**

Twelve files bound the exposure, across eleven corpora, since `claude/skills/*/SKILL.md` carries two of them. The count reads every file under `src/**/*.test.ts` that resolves a path outside `src/` against the repository root and asserts over what it finds there, and it excludes a test reading a fixture as data. That exclusion is what puts `src/comments/trend.test.ts` outside the set, since it replays fixed git revisions and skips itself when they are unreachable, and `src/commands/exit-code.test.ts`, which copies `src/` and `tsconfig.json` into a temp root and names two paths the guards already admit. `src/gh-invocations.test.ts` and `src/ui.test.ts` resolve the repository root and then walk `src/` alone, so neither reaches a corpus outside the scope either.

A temp root is not the repository root, which is the clause that decides three more. `src/commands/records-migrate.test.ts`, `src/commands/tooling-sync.test.ts`, and `src/records/backup.test.ts` each resolve against an `mkdtempSync` directory, so a sweep reaches all three before it reaches the reason they fall outside. Reading for the resolution form alone returns 19 candidates rather than twelve.

A file reaches the root two ways and a sweep reading for one of them undercounts. Eleven of the twelve name a root constant, being `PROJECT_ROOT`, `import.meta.dirname`, or `process.cwd()`, and `src/markdown/bans.test.ts` names none: it passes `.cspell/banned-spellings.txt` to `Bun.file` as a bare relative path that resolves against the runner's working directory. Grep for the implicit form as well as the explicit one, or the count comes back at eleven and reads as complete.

Run the file beside its corpus before trusting a green gate that never touched `src/`:

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

The two directions split the twelve five and seven. Five assert over a `.sh` file, so a branch touching one runs the Shell stage, which runs shellcheck and the color-source walk and never the test that covers the behavior. The other seven assert over markdown, a plain text list, or a corpus's shape, where no stage fires at all. `src/gov/adapter.test.ts` is the one asserting an absence, that `governance/rules/project/` ships empty because the subfolder is reserved for a target, so adding a rule there is what trips it rather than editing one.

**The decision**

Tests admits the census and nothing wider. `TEST_CORPORA_PATTERNS` in `src/gate/stages.ts` holds ten patterns over the eleven corpora and the Tests stage reads the joined result beside `^src/`, so a branch editing one of them now runs the suite that covers it. Types was left alone: every one of the twelve is a test asserting over a corpus, and a typecheck over unchanged TypeScript reports what it reported last run.

The ten and the eleven differ at both ends rather than by an omission. `^claude/skills/` covers both tests on the skill-body row and the `poll.sh` row, `^governance/rules/` covers the frontmatter-glob row and the category-folder row, and the one hooks row expands into two patterns because its test reaches the seed copy as well. Four patterns are directory prefixes because their tests walk the tree whole, and two of those reach a rule or a skill a branch adds rather than edits.

Widening to every change was the alternative and it charges twice as much for the same exposure. Over a sample of 60 commits reaching `origin/main`, read identically with merges and without, 42 already ran Tests under the guard as it stood, 22 touch a census corpus, and 9 of those 22 ran no Tests stage at all. Widening newly charges the other 18, so the census reaches the whole measured gap at half the added load.

What decides whether a commit already ran is the guard rather than the source tree. `^src/` on its own returns 19 over that window, and the guard admits `package.json`, `tsconfig.json`, and `vitest.config.ts` beside it, so a release commit touching one of those paid the suite already. Recording the scoping as final was the third option and it spends an eleven-file census on nothing, and the Shell stage's own scope is the precedent for keying a stage on a pattern outside the source tree at all.

The array in `src/gate/stages.ts` and the list above are two copies of one set with nothing comparing them. A corpus joining the census joins `TEST_CORPORA_PATTERNS` in the same change, and the direction that fails silently is the guard going stale while this entry reads current, so this entry is the carrier for that duty. A test asserting the regex against this prose would be a third copy, which a corpus this static does not earn.

The gap is narrowed to what the census names rather than closed: a twelfth corpus is unguarded exactly as the eleven were until someone adds its prefix. What this changes is the local gate alone, since `hasChanged` in `src/gate/sequencer.ts` returns true whenever scoping is off and `bun run check:ci` passes `--all`, so CI runs every stage on every change regardless. The red pipeline was never what the gap cost.

Re-read every citation into a file after moving anything above the line it names, since no stage compares a cited number against what sits there. The line citations this entry once carried into `src/gate/stages.ts` are gone rather than repaired, since the move to `src/gate/` gave every stage a named identifier to cite instead, which closes this shape for the gate. Any other entry citing a line number into a file it does not own carries the same exposure, and nothing sweeps for it.

### The install gate

`bun run check:install` runs `git clone` on the project root, so it verifies the last commit and never the working tree. An uncommitted fix, or an uncommitted regression, is invisible to it. Commit first or the result describes code you are not shipping.

Its assert loop is the only thing between a silently truncated install and a green run, because `runDomains` in `src/init/run.ts` catches a failed domain and lets init report the ones that worked. Every domain init installs needs at least one asserted path, or that domain can install nothing while the gate stays green.

A passing `bun run check` prints three `Failed, run manually` lines. Vitest passes a test's stderr through, and `src/init/run.test.ts` exercises that same failing-domain branch deliberately, so grepping the check output for failure strings reports a regression that does not exist. Read the closing `✓ Verification passed` line and the vitest summary instead.

The gate runs `canon init --stack base` rather than a bare `init`, which now resolves to the same install since `base` is the default. The explicit flag stays because it pins what the assertions cover rather than inheriting whatever the default becomes. A domain that installs conditionally needs its condition met in the gate invocation, beyond having a path in the loop.

### Rank a stage by processor seconds

Rank verification stages by CPU seconds rather than by elapsed time, because a stage that fans across cores finishes fast and costs the most. Timing `bun run check` by wall clock makes the 415 tests look like the cheapest stage, landing around 931ms. Timing with `/usr/bin/time -f 'user %U sys %S wall %e cpu %P'` instead shows the tests are the most expensive stage at 11.76 CPU seconds and 1169 percent peak CPU, 38 percent of a roughly 31 CPU second total, delivered in one wall second. State which measure a cost claim rests on. Wall clock still answers how long a human waits, which is a separate question.

### The other stages

A single test file runs through `bun --bun vitest run <path>` and never `bunx vitest run <path>` or `bun run vitest run <path>`, which is the form `package.json` already spells in its `test` script. Without `--bun`, vitest resolves under node, where a module reaching git through `$` from `bun` fails to import at collection time and the file reports zero tests rather than a failure. Every module that shells out does so through that import, so the wrong form reads as a clean run over exactly the code whose behavior lives outside the process.

The other reading is worse, because the wrong form can report failures a green tree does not have. Scoping to `src/context/` through `bunx` can report failures while `bun run check` is green on the same tree, since `src/context/citations.ts` and `src/indexes/walk.ts` both import Bun globals and most of that suite trips on them under node. A collection failure naming a package the project depends on, such as `Cannot find package 'bun' imported from src/git-ignore.ts`, is one signature.

It is not the only one, and the other reaches past collection. A module calling `Bun.Glob`, `Bun.TOML`, or `Bun.YAML` without importing anything collects and runs under node, then throws `ReferenceError: Bun is not defined` at the call site, so the file reports ordinary test failures pointing at a source line rather than at the runtime. That reads exactly like a regression, which is what makes it worth checking first: re-run the same file through `bun --bun` before opening the source, since the tests pass unchanged under the right form.

A third signature reaches a test that spawns the CLI rather than importing it. `src/commands/pr.test.ts` spawns `process.execPath`, which is node under `bunx`, so `src/cli.ts` never starts past its `#!/usr/bin/env bun` shebang, stdout comes back empty, and every case in the file dies on `SyntaxError: Unexpected end of JSON input` where it parses the record. The whole file fails at once and the error names the test's own `JSON.parse` line rather than anything in `src/`, so the shape to read it by is uniformity: a spawning suite failing every case identically against a tree `bun run check` calls green is the invocation rather than the code.

A third form fails a different way: bare `bun test` runs the suite under Bun's own test runner rather than under vitest at all, which `package.json`'s `test` script never does. `it.concurrent(name, async ({ expect }) => ...)` reads its `expect` off a vitest-only test-context argument bare `bun test` never supplies, so every such test throws `TypeError: expect is not a function` at the assertion line instead of failing to collect, reading as a broken suite rather than a broken invocation.

`check:types` needs `typescript` declared in `devDependencies` rather than relying on it hoisting from an astro peer, or the gate resolves by accident.

The Indexes stage asserts drift against the working tree, so the first `bun run check` after a frontmatter edit reports its own regeneration as drift and exits red. Stage or commit the rewritten `index.md` and run again. This is the same regenerate-then-assert shape as the two stages in `canon/context/development/regeneration.md`, with the difference that the walk writes files the session never opened, so the failure names work nobody did by hand.

The pathspec matches by name rather than by how a file changed, so an unstaged hand edit to any `*index.md`-matching file trips the same failure, `auto: false` or not, since the check never asks whether the walk touched it. A file under `auto: false` frontmatter that `canon indexes regen` correctly skips still reports as drifted by `bun run check` until it is staged.

`.cspell/banned-spellings.txt` is a third dictionary holding the British spellings `canon markdown audit` reports, and an `overrides` entry in `cspell.json` scopes it to the files that carry, assert, or explain the set rather than loading it repo-wide. Both gate a push now, the spell check over the whole tree and the audit over its ban half, so a repo-wide load would spell-approve everywhere the words the ban gate still fails on and leave the two stages disagreeing about one word. A file that needs one of them is added to the override list, never to `project-terms.txt`, which reads as vocabulary this repository writes.

Its membership is the shipped `SPELLINGS` plus `analyse`, a word no set carries and a comment in `src/markdown/bans.ts` explains the absence of. The two are therefore not the same list and neither derives from the other, which is what `bans.test.ts` asserts.

The list is stated as a property rather than a count, since a count of the files carrying a banned spelling goes stale against the same corpus the audit measures, and nothing compares such a count to the array beside it.

### A generated base64 module needs its own cspell exemption

cspell has no way to recognize a base64 payload as non-prose, so a generated TypeScript module holding one as a string literal, such as `src/design/fonts.ts` embedding WOFF2 font data subset to Latin and basic punctuation, floods `check:spell` with an unknown-word finding for nearly every substring inside it. Add the file's path to `cspell.json`'s `ignorePaths` rather than growing `project-terms.txt` with meaningless fragments, the same way `tooling/**` is already exempted wholesale for content the dictionary was never meant to grade.

### A percent-encoded data URI inside prose needs an inline exemption, not a path one

A path-level `ignorePaths` entry only exempts a whole file, which is too wide for a percent-encoded data URI sitting in one line of otherwise ordinary markdown prose, such as an inline SVG favicon literal in a shipped skill body. Each percent-encoded angle bracket glued to the tag name after it reads as one unknown word to cspell. `cspell.json`'s `ignoreRegExpList` closes this at the substring instead: a pattern matching from `data:image/svg+xml,` to the next `"` skips the encoded segment without exempting the prose around it.

### A root-level test file needs its own vitest include entry

`vitest.config.ts`'s `test.include` reads `src/**/*.test.ts` alone, so a test file sitting beside a root config it exercises, such as `commitlint.config.test.ts` beside `commitlint.config.js`, never runs under `bun run test` or the Tests stage inside `bun run check`. Neither reports a failure, since vitest finds no matching file to run there, so the gap surfaces only as a suite that passed without ever asserting anything for the new file. A plan calling for that shape of test needs `include` widened with a bare `*.test.ts` entry alongside the existing one.

### No stage reports an unused import

`check:types` is `tsc --noEmit` and `tsconfig.json` sets `strict` without `noUnusedLocals` or `noUnusedParameters`, and no JavaScript or TypeScript linter runs anywhere in the sequence, since `check:format` is prettier, `check:shell` is shellcheck, and `check:spell` is cspell. A dead import therefore passes a green check and reaches history, caught only by reading the file rather than by any stage. The same stage does catch a duplicate function implementation, as TS2393, so two report helpers colliding on one name inside a large file fails the gate rather than shadowing at runtime.

### A fixed `DEFAULT_PORT` fails on whatever unrelated listener holds it

`src/serve/static.test.ts`'s "should walk past a port already in use" test binds `DEFAULT_PORT` (8787) directly, so any unrelated listener already holding that exact port fails the test with `bind-failed` on the first `start()` call, whatever diff is under review. A leaked `canon serve` process sitting on a nearby port is a misleading lead, since the process nearest to hand is not necessarily the one holding `DEFAULT_PORT` itself. Read what the failure actually reports, `bind-failed` on the first bind rather than an off-by-one on the walk, and confirm which process holds `DEFAULT_PORT` with `ss` or `lsof` over listening sockets before naming a cause. The durable defect is the test binding a fixed port on a shared machine rather than isolating one, which is what lets any unrelated listener fail an unrelated diff. Killing whatever process holds the port clears one instance without closing that.
