---
title: lib
description: The shared bash frame library, the functions it exports, and the gotchas bash scripts carry
---

# lib

`scripts/lib/` holds the functions domain scripts source and never execute. It holds `ui.sh` alone, so read it before adding a helper that already exists.

## Layout

### `ui.sh`

Source this in any script that needs terminal output. It provides the framed log lines and the color palette, and holds no picker or prompt, which live in `src/cli/ui.ts`.

- `open_timeline` and `close_timeline`: open `┌` with an optional banner and close `└` on stderr. Pair with `trap … EXIT`
- `log_info`, `log_warn`, `log_error`, `log_step`, `log_add`, and `log_rem`: framed log lines on stderr. `log_error` exits 1
- `pipe_output`: indents borrowed output inside the frame

## Gotchas

### Sweep callers by path, not by function name

Grep for the file path in `source`, `exec`, and `bash <path>` form before deleting a bash script or lib, since a function-name audit undercounts real callers.

- Deleting `lib/inject.sh` and `tooling/sync.sh`, a function-name audit found 2 callers where 17 existed: twelve sandbox scripts with a dead `source` line and five call sites shelling the script
- One site was `manage-init.sh`, which stopped installing base tooling while `bun run check:install` still passed, because `run_domain` swallows a failed domain
- Confirm the gate you cite asserts on the deleted code's output, since it checked only files the tooling stack does not provide

### A guard inside a substitution cannot stop the run

A fatal precondition inside a helper called as `$(helper)` cannot stop the run, because `exit 1` kills the subshell and leaves the caller holding an empty string.

- A `GITHUB_ORG` check inside `sandbox_anchor_url` printed its error, then the caller ran `git remote add origin ""`, which succeeds, and the script exited 0
- Split validation into a `require_*` function invoked from the main shell before the first call
- Prove it end to end, since `set -e` does not fire on a substitution whose empty output the next command accepts

### Read a helper's body before porting its call

Read the helper's body rather than what its name advertises, because shell idioms validate as a side effect of resolving. `cd`, `realpath`, and `readlink -f` all fail on a missing path and are the usual carriers.

`wiki init` called `guard_root "$target"`, which reads as a toolkit-root check while its body is `cd "$target" && pwd`, so it also rejected a nonexistent target. The port kept only the root comparison. `mkdir -p` then scaffolded a typo'd path into a whole new tree, or exited on an unhandled `ENOTDIR` when the target was a file.

### Test a binary-resolving entry point through a full fixture root

A `scripts/` entry point that shells to an external binary is testable through a full fixture `PROJECT_ROOT`, which isolates the manifest and the scaffold while still exercising the real sourcing chain.

- Copy `scripts/lib/` into a `mkdtempSync` fixture and add a stub manifest and binaries under a fixture `bin/`
- Drive the real script with `spawnSync('bash', [scriptPath, ...args])` under `PROJECT_ROOT=<fixture>` and that `bin/` prepended to `PATH`
- Give a stub scaffold at least one file, since git does not track an empty directory and the following `git add . && git commit` aborts the script under `set -e` before the phase under test runs

### Guard every command inside an `EXIT` trap

A command inside a bash `EXIT` trap that can fail needs its own `|| true` guard even when a sibling already carries one. `set -e` applies inside the trap body, so an unguarded failure overrides the exit status the script held, including `0`, and the remaining trap commands never run.

A trap of `kill "$PREVIEW_PID" 2>/dev/null; wait "$PREVIEW_PID" 2>/dev/null || true` guards only the `wait`. A preview server that forks a detached grandchild leaves the `kill` firing on a gone pid, which reports a successful run as exit 1. `tooling/web/configs/scripts/screenshot.sh` guards both.
