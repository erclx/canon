---
title: Development
description: The local dev loop, the run command table, how bun run check sequences and scopes its stages, the hooks, session scratch, record folders, and the evidence and hero folders
---

# Development

Checked against the [hooks reference](https://code.claude.com/docs/en/hooks) on 2026-10-18.

## Overview

Owns the local development loop, being the run commands, the gate behind `bun run check`, and the Claude Code and git hooks around it. CI runs the same stages through `bun run check:ci`, covered in `canon/context/development/ci.md`.

`CONTRIBUTING.md` states the contributor-facing subset, and what each script does is in the entry for its domain.

## Layout

### Scripts

The run commands, which stack references and `docs/target/projects.md` send a session to, so a command added elsewhere is invisible to them.

| Command                 | Purpose                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `bun run check`         | Verification scoped to changed files. Fails on format drift, regenerates indexes, asserts clean. |
| `bun run check:ci`      | Every stage via `--all`, the run CI does. Still regenerates.                                     |
| `bun run check:format`  | Read-only oxfmt, Prettier for `.astro`, and shfmt format check.                                  |
| `bun run check:shell`   | Read-only shellcheck against `scripts/`, `tooling/`, and `.claude/hooks/`.                       |
| `bun run check:lint`    | Read-only oxlint at its default rules, failing on any warning.                                   |
| `bun run check:types`   | Read-only `tsc --noEmit` against `src/`.                                                         |
| `bun run check:install` | Clones the repo to tmp and asserts `canon init` lands a fresh scaffold.                          |
| `bun run format`        | Auto-fix oxfmt, Prettier for `.astro`, and shfmt formatting.                                     |
| `bun run clean`         | Wipe `node_modules/`, clear bun cache, reinstall.                                                |
| `bun run update`        | Interactive `bun update` followed by verification.                                               |

### `src/gate/`

Owns the stage table in `stages.ts`, the scoping and run loop in `sequencer.ts`, and every threshold comparison in `measures.ts`.

- Stages run in table order and the first to find a fact halts the run. Unreferenced rules and Audit set report and never fail the push
- The changed set unions the diff against `origin/main`, the working tree, and untracked files. Fallbacks widen, and `--all` forces every stage. On `main` the local ref is HEAD, so the base is remote.
- Tests runs on `^src/` and any corpus in `TEST_CORPORA_PATTERNS`. A root-level test pair or a script under `claude/skills/*/scripts/` needs a `TESTS_SCOPE` pattern asserted in `stages.test.ts`
- Indexes and Consumed copies regenerate then assert, so the first run after an edit reports drift and `check:ci` writes the tree. Stage the rewrite and run again, since a rerun alone repeats the diff.
- A stage that cannot read its input is `unmeasured`, which warns locally and refuses under CI. Plugin manifests skips locally without the CLI and fails when `CI` is set

### `src/init/`

Installs each domain `canon init` runs, as the steps `runDomains` walks in `run.ts`.

- `runDomains` catches a failed domain and lets init report the ones that worked, so the `check:install` assert loop is the only guard against a silently truncated install
- Every domain init installs needs at least one asserted path in `scripts/core/install-check.sh`, and a conditional domain needs its condition met in the gate's `canon init --stack base` call
- `check:install` clones the last commit, so an uncommitted fix is invisible to it

### `src/process/`

Spawns `src/cli.ts` as a real process against a temporary directory, so a case asserts what an in-process call cannot, being whether a verb is registered, how it exits, and whether `--json` parses off stdout alone.

- No case drives `gate run`, since its last stage runs the suite that spawns the case. `checkout-mismatch.test.ts` is the one exception and kills the child once the warning reaches stderr.
- To add a case, write the fixture under a per-test `mkdtempSync`, then assert the file tree, exit code, and parsed record together. Take a count from the verb's catalog.
- `runCli` points `HOME` and the state folder under the case's `cwd` and throws `ContainmentViolation` when a spawn writes into the real `stateDir()`
- Run one test file as `bun --bun vitest run <path>`. Without `--bun` a module importing `bun` fails at collection, and bare `bun test` runs Bun's own runner, which lacks vitest's `expect` context.

The Tests stage holds a machine lock in `suite-lock.ts` so one box runs one suite, and `vitest.config.ts` caps `maxWorkers` at `'50%'` outside CI.

- A full suite run by hand queues on the same lock through `vitest.global-setup.ts`, and `src/gate/hand-suite.ts` decides from argv whether a run is full
- A run naming a path or a `-t` filter takes no lock, and neither does a watch session or a run under CI
- The gate spawns its own suite with `CANON_HELD_LOCK` naming the lock it holds, so that suite skips the lock rather than waiting on its parent forever
- The lock path resolves in the global setup, in the main process, since `vitest.setup.ts` points each worker's state folder at a temporary one

### `.claude/hooks/`

Holds this repository's Claude Code hooks, wired through `.claude/settings.json`. Each seeded hook has a twin in `tooling/claude/seeds/.claude/hooks/` maintained by hand with nothing comparing the trees, and eight of the ten shared names stay byte-identical.

- `standards-audit.sh` and `reply-links.sh` differ on purpose, since the seeded copy resolves an installed `canon` alone and this copy prefers the checkout's `src/cli.ts`
- Every hook reading a payload opens with `IFS= read -r -d '' -t 2 input`, never `cat`, as `src/hooks/guard.test.ts` holds. The bound is canon's own, and `scratch-guard.sh` fails open on it
- `memory-guard.sh` and `review-post-scan.sh` cut a `Bash` command with one `awk` pass that drops heredoc bodies, and an arithmetic or `let` shift is text rather than an opener
- `precompact-handoff.sh` blocks the first manual `/compact` once and instructs on `auto`, where a block reaches nobody. `silent-turn.sh` and `reply-links.sh` block once on `Stop`.
- Auto memory is off and `Agent` and `Task` are denied, as in the seed, though Workflow agents still run. Compaction, usage-limit, and inbound settings stay per-operator.

### `.husky/`

Holds the git hooks, which run as POSIX sh under `sh -e`, so each `grep` that may match nothing sits in an `if` or behind `||`.

- `pre-commit` runs `lint-staged`, `commit-msg` runs `commitlint`, and `pre-push` runs `bun run check`. `post-rewrite` delegates to `post-merge` on `rebase`.
- `post-merge` returns when `.canon/tasks` or `canon` is absent, then hands off to `canon hooks post-merge`, whose verb in `src/hooks/post-merge.ts` owns the five steps and their order
- The steps run as child verbs, being the task archive, `records push`, `worktrees reclaim`, `upgrade`, and `claude plugin-update`. A `CANON_SKIP_*` switch in the hook header turns one off.
- The reclaim child carries no `--root`, so `reclaimReport` reads `process.cwd()` and refuses the worktree the pull ran in. Every other step passes the main root.
- `tooling/base/configs/.husky/post-merge` is the target's copy without the source-CLI fallback, and `post-merge-hook.test.ts` runs its shared cases against both

### `.canon/`

Holds the gitignored record folders, where `canon/context/context-model.md` fixes the rule that every gitignored record lives here and nothing tracked does.

- A linked worktree resolves `plans/`, `review/`, and `tasks/` at the main root. `Edit` and `Write` refuse a main-root path, so write through the routes `session-worktree` states.
- `records-index.sh` regenerates the task board index, since the index walk skips gitignored folders. A shell write fires no `PostToolUse` hook, so `task-board` regenerates positionally.
- `board-validate.sh` runs `canon tasks validate` after an edit to `priority.md` and hands back its findings without blocking, so a hand edit is named in the turn that made it
- `canon tasks archive` moves a shipped task and its plan into `archive/` inside their own folders, and the `Pull request:` line is what lets a merge close the task
- `canon records push` backs every folder except `tmp`, `ordinal-locks`, and `.records.git` to a private remote, through a second git directory at `.canon/.records.git`

### `assets/evidence/`

Holds the dev regression baselines, one subfolder per area. Dev evidence is what a developer compares across a change, and prod evidence is a capture shown to a reader.

- The location tells the kind. Under `assets/evidence/` is dev, and any other tracked `evidence` folder is prod. `canon pr evidence` compares both.
- `assets/evidence/home/` is the site baseline, and `assets/evidence/canvas/<area>/` holds `arrange`, `inspector`, `layers`, and `shell`
- `examples/teach/evidence/` is prod with a `.stamp` per image from `canon capture`, and `web/public/evidence/` is prod and hand-placed
- `.canon/evidence/` and a groundwork track's `evidence/` are gitignored proof a record cites, and `canon migrate scratch-evidence` moves a cited folder out of `tmp/`
- Teach, slides, and design commit no dev baseline yet, and the marketing images in `assets/frames/` are neither kind

### `assets/captures/`

Holds the `*.html.tmpl` frame templates that `scripts/core/regen-hero.ts` fills and the Hero stage gates.

- The script fills the templates from committed catalogs and the design CSS, writes the `.html` beside each, and asserts no drift. It reads this folder flat, so a nested template is skipped silently.
- The assert covers the HTML and not the PNG, so `canon capture` writes a `.stamp` of markup and image digests that `captureStamps` compares
- Regenerate, capture, and stage all three files in one step, since the assert reads the index and repeats its message until they are staged
- A branch commits no frame of its own, and `.github/workflows/refresh-capture-frames.yml` refreshes them from `main`
- Run a verb reading data the branch authors through `bun src/cli.ts`, since the global binary is the last release, as with `canon capture --selector`

### Other folders

Smaller folders the loop touches.

- `scripts/` owns every shell script except the Claude Code hooks, grouped by domain
- `scripts/core/` owns the checks that stay scripts, such as the skill-path and seed-independence walks
- `src/hooks/` owns `canon hooks`, whose `post-merge` verb the `.husky/` hook hands off to, and the guard tests the shell hooks answer to

## Gotchas

- `check:lint` passes `--disable-nested-config` to skip the golden configs under `tooling/*/configs/`, and `check:types` needs `typescript` in `devDependencies`, not hoisted from an astro peer
- `canon gov regen` defaults `--root` to wherever the binary is installed, so from a worktree pass `--root <literal-path>`
- A prose edit can break a test no stage in the push runs, as with the markdown checkpoints, literals in `src/markdown/` that `structure.test.ts` asserts against themselves
- A file whose name ends in `index.md`, staged or untracked, trips the Indexes stage even under `auto: false`
- A line number cited into a file the entry does not own goes stale with nothing comparing it, so cite a named identifier
