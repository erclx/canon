---
title: lib
description: The four shared bash libraries, the functions each exports, and where the TypeScript equivalents sit
---

# lib

`scripts/lib/` holds the functions domain scripts source and never execute. Each file owns one concern, and the surfaces below are what a session reads before adding a helper that already exists. `worktree.sh` is documented with the verification stage that calls it, in `.claude/context/scripts/core.md`.

## `ui.sh`

Source this in any script that needs terminal output. When `CANON_NON_INTERACTIVE=1` is set, `select_option` auto-selects the first option and `ask` returns the default without blocking. `select_or_route_scenario` reads `SANDBOX_SCENARIO` and skips the picker when set, letting agents target a specific scenario via `canon sandbox <cat>:<cmd> <scenario>`. It also provides the color palette.

- `open_timeline` and `close_timeline`: open `┌` with an optional banner and close `└` on stderr. Pair with `trap … EXIT`
- `log_info`, `log_warn`, `log_error`, `log_step`, `log_add`, and `log_rem`: framed log lines on stderr. `log_error` exits 1
- `select_option`: interactive picker. Sets `SELECTED_OPTION` and errors with a framed message on non-TTY stdin
- `ask`: prompt for a value with a default. Exports the result to a named variable
- `select_or_route_scenario`: sandbox-aware picker. Skips when `SANDBOX_SCENARIO` is set
- `guard_root`: rejects the toolkit root as a target
- `require_project_root`: errors when run outside the repo or inside a sandbox

## `gov.sh`

Narrowed to one function. The payload builder that used to live here is `src/gov/payload.ts`, and `strip_frontmatter` is `src/frontmatter.ts`.

- `rule_subdir`: emit a source rule's subdirectory relative to the rules root, or empty when the rule sits at the root. Stays bash permanently

`rule_subdir` has three remaining call sites across two sandbox scenarios, which stay bash by decision. `manage-sandbox.sh` dropped its own caller when gov injection moved to the real installer, so the dispatcher no longer sources `gov.sh` at all. `ruleSubdir` in `src/gov/install.ts` is the TypeScript copy the migrated installer uses. The two must agree, since a rule installed to the wrong subdirectory is one the sandbox scenarios then fail to find.

The bash `strip_frontmatter` treated the first `---` on any line as the start of a frontmatter block, so a document whose body carried two horizontal rules lost everything between them. `stripFrontmatter` in `src/frontmatter.ts` anchors to the first line instead and leaves such a body intact. The docs migration took the TypeScript reading, which means `canon docs <topic>` now emits sections the bash silently swallowed.

The divergence is latent on the current corpus. All 22 documents under `docs/` and `.claude/context/` strip byte-identically under both, so the fix guards documents not yet written rather than repairing today's output. Three other inputs diverge and each favors the TypeScript: a file with no trailing newline, a block opening on line 2, and an unterminated block. The last two are the ones worth knowing, since the bash emitted nothing at all for an unterminated block and swallowed a mid-document block that was never frontmatter.

## `tooling.sh`

Consumed by `scripts/tooling/{ref,verify,create}.sh` for discovery and name validation, and by `scripts/core/check-seed-independence.sh` and `scripts/core/list-seed-roots.sh` for seed discovery. The second exists so the seed-standards stage in `src/gate/measures.ts` reaches this definition rather than carrying a second copy of the walk in TypeScript, which is what would let the two stages measuring seed content disagree about which roots exist. `listStacks` in `src/tooling/manifest.ts` is the TypeScript equivalent, and it discovers by `manifest.toml` rather than by directory.

- `list_tooling_stacks`: emit names of every directory under `tooling/`, minus excluded
- `is_tooling_stack_excluded`: return 0 if the name is in `TOOLING_STACK_EXCLUDE`, 1 otherwise
- `collect_seed_roots`: emit every `tooling/*/seeds` directory holding a `.claude/`, relative to `PROJECT_ROOT`

`collect_seed_roots` serves the two stages that measure seed content, Seed standards and Seed independence. Both discover through it rather than naming a stack, so one glob decides what a seed stage covers and a stack seeding `.claude/` later arrives covered with no edit to either caller.

## `frontmatter.sh`

Sourced by `scripts/docs/list.sh` and `scripts/standards/list.sh`. The index engine that used to sit alongside this function is TypeScript now, in `src/indexes/`.

- `read_frontmatter_field`: read a YAML field from a markdown file's frontmatter. Strips wrapping quotes

## Gotchas

### Sweep callers by path, not by function name

Before deleting a bash script or lib, grep for the file path in `source`, `exec`, and `bash <path>` form rather than for the names of the functions it defines. Deleting `lib/inject.sh` and `tooling/sync.sh` in migration step 2, a function-name audit found 2 callers where 17 existed: twelve sandbox scripts carried a dead `source` line and five call sites shelled the script, including `manage-init.sh`, which silently stopped installing base tooling. `bun run check:install` still passed, because `run_domain` swallows a failed domain and the gate asserts only on files the tooling stack does not provide. Step 3 repeated it, finding five callers of `manage-gov.sh` where the plan named two. Confirm the gate you cite actually asserts on the deleted code's output rather than trusting its exit code.

### A guard inside a substitution cannot stop the run

A fatal precondition placed inside a helper that callers invoke as `$(helper)` cannot stop the run, because `exit 1` there kills the subshell and leaves the caller holding an empty string. Centralizing eleven hardcoded URLs behind `sandbox_anchor_url` put its `GITHUB_ORG` check inside the substitution, and a probe with the variable empty printed the error, ran `git remote add origin ""`, which succeeds, continued past the failure, and exited 0. Split validation into a `require_*` function invoked from the main shell before the first call, and prove it end to end, since `set -e` does not fire on a substitution whose empty output the next command accepts.

### A library must not declare a hook the dispatcher probes for

When a dispatcher branches on whether a hook is defined, export a named helper for the hook to call rather than declaring the hook in shared code. `manage-sandbox.sh` chooses between cloning an anchor and starting empty on `type -t use_anchor`, and nine scenarios collapsed their identical `use_anchor` stubs into `lib/sandbox-git.sh`. Declaring the hook there would have handed an anchor to `git/commit.sh`, `git/stage.sh`, and `infra/indexes.sh`, which source the file only for the identity helpers. Grep for the dispatcher's presence test and list every file that sources the library before moving a hook body.

### Exercise a `gh` failure path without reaching the branch that creates

A lib function whose refusal path shells out to `gh` is testable without provisioning anything. `ensure_sandbox_anchor_repo` separates an absent repository from an unreachable host on the 404 alone, so pointing `GH_HOST` at an invalid host forces the unreachable branch and proves it refuses rather than creates. A repository that already exists exercises the success path read-only. Putting the provisioning branch behind an opt-in is what makes the absent-repository branch testable too, since the default path can then run against a name that is genuinely missing without claiming it.

### Read a helper's body before porting its call

Porting a call to a bash helper means reading the helper's body rather than what its name advertises, because shell idioms validate as a side effect of resolving. `wiki init` called `guard_root "$target"`, which reads as a toolkit-root check while its body is `cd "$target" && pwd`, so it also rejected a target that did not exist. The port kept only the root comparison, and `mkdir -p` downstream then scaffolded a typo'd path into a whole new tree, or exited on an unhandled `ENOTDIR` when the target was a file. `cd`, `realpath`, and `readlink -f` all fail on a missing path and are the usual carriers.

### Test a binary-resolving entry point through a full fixture root

A `scripts/` entry point that shells to an external binary is testable through a full fixture `PROJECT_ROOT` rather than by sourcing its functions directly. Copy `scripts/lib/` into a `mkdtempSync` fixture, add a stub manifest and binaries under a fixture `bin/`, then drive the real script with `spawnSync('bash', [scriptPath, ...args])` under `PROJECT_ROOT=<fixture>` and that `bin/` prepended to `PATH`. This isolates the manifest and the scaffold while still exercising the real sourcing chain.

A scaffold producing an empty directory breaks this under `set -e`, since git does not track an empty directory and the following `git add . && git commit` reports nothing to commit and aborts the script before the phase under test runs. Give a stub scaffold at least one file to commit.

### Guard every command inside an `EXIT` trap, not one of them alone

A command inside a bash `EXIT` trap that can fail needs its own `|| true` guard even when a sibling command in the same trap already carries one. `set -e` applies inside the trap body, so an unguarded command failing partway through it overrides whatever exit status the script already held, including a successful `0`, and the trap's remaining commands never run. `tooling/web/configs/scripts/screenshot.sh` trapped `kill "$PREVIEW_PID" 2>/dev/null; wait "$PREVIEW_PID" 2>/dev/null || true`, guarding only the `wait`. `astro preview` forks a detached grandchild and exits its own backgrounded process immediately, so the `kill` fired on an already-gone pid, failed, and reported a successful capture as exit 1 until both commands carried the guard.
