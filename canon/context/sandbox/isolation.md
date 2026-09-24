---
title: Isolation
description: Where a sandbox tree lives and the guard on it, the per-run id, and what the write scope, escape watch, and dispatch bound each reach
---

# Isolation

## Decisions

### The sandbox path

The sandbox tree lives at `$XDG_STATE_HOME/canon/sandbox-<run-id>`, defaulting to `~/.local/state/canon/sandbox-<run-id>`, and `CANON_SANDBOX_DIR` overrides the whole path. Two definitions hold it, `resolve_sandbox_dir` in `scripts/lib/sandbox-path.sh` and `sandboxTree` in `src/commands/sandbox.ts`, and the exec boundary is why there are two rather than one.

The tree sits outside the repository because a tree inside the worktree puts the toolkit's own `CLAUDE.md` on the ancestor chain of the session `run.sh` spawns, beside the seeded copy the scenario installed. Both carry the rule sending shared session scratch to the main worktree root, with nothing to decide which root wins. With the toolkit off that chain, a skill writing shared session scratch lands inside the sandbox, where the arm's `write_scope` asserts over it.

`.gitignore` keeps a `.sandbox/` entry regardless. Nothing provisions there, so the entry costs a line and covers a stray tree from an older checkout or a hand-set override.

### The per-run id

`<run-id>` comes from `mint_sandbox_run_id` and `mintSandboxRunId`, one in each of the two definitions. Each mints a short random suffix the first time a process asks for the default and holds it in `CANON_SANDBOX_RUN_ID` for the rest of that process, so a child inheriting the environment resolves the same tree its parent did. Two sessions provisioning at once land on two trees and cannot provision over each other.

`run.sh` mints once, before it provisions, which is what lets its provisioning step and the `sandbox check` it runs afterward agree.

### The guard

`assert_sandbox_dir_safe` is the live guard. Provisioning runs `rm -rf` on the resolved path at three sites, so the guard tests an allowlist rather than a list of paths to refuse. The path normalizes first, collapsing repeated separators, folding `.` and `..` segments, and stripping trailing ones, then has to be a strict descendant of the home directory or the temp root.

A blocklist is right once and wrong as soon as a system directory goes unnamed. The allowlist admits the default and every reasonable override, and refuses `/`, `/usr`, `/etc`, `//`, `$HOME/../..`, and `$HOME` itself without naming any of them. The repository test is separate and runs both ways, since a path under the worktree restores the ancestor chain and a path above it is one `rm -rf` from deleting the repository.

The fold is lexical and follows no symlink. The guard runs before provisioning creates the tree, which rules out `cd` with `pwd -P` and every other resolution needing the path to exist, so a `..` below a symlink resolves against the link's own path rather than its target. A `..` climbing past the root clamps to `/`, which the allowlist refuses. Folding dot-dot is what the guard turns on: a string test against the path as written admits `$HOME/../../usr`, `$HOME/..`, `/tmp/../etc`, and a spelling resolving to the main worktree root.

### Headless permissions and the write scope

Headless runs pin `--model sonnet` for cost control and assert on structural properties rather than exact wording, since model output varies between runs. They run under `--permission-mode bypassPermissions`. `acceptEdits` denies writes under `.claude/`, and neither an `--allowedTools` glob nor a `permissions.allow` rule in `settings.json` lifts it, so an arm that writes planning docs cannot run under it at all.

The scoping a permission layer would supply comes from `write_scope`, asserted after the run rather than enforced during it. `write_scope` is a report, not a block: a skill that writes somewhere it should not still wrote there. The manifest diff covers creates, modifications, and deletions, which makes it comparable to the permission check rather than a subset of it. `canon/context/scripts/eval.md` holds the blind spot both harnesses share, a write outside the diffed tree.

A per-arm permission set is worth building for its own reasons, since every arm gets the widest permission any arm needs. It would not bound a nested dispatch, though, because the arm that exposed that failure runs its whole tested path through `Bash`, and a tool set narrow enough to stop the dispatch denies the one tool the arm needs.

### The escape watch and `escape_scope`

`run.sh` watches `.canon/plans/`, `.canon/review/`, `.canon/memory/`, and `.canon/tasks/` under the toolkit roots, and reports what changed there as `escapes` rather than folding them into the write scope, since a file the session put outside the tree is not in it to be asserted over. Without a declaration, an escape is an unattributed warning.

`escape_scope` in an arm's `expect.toml` turns that warning into a result, using the mechanism `write_scope` already models: globs matched against what `escape_roots` and `ESCAPE_SCRATCH_DIRS` found, checked by the harness that finds them. Declaring the key, even as `escape_scope = []`, makes a write matching a declared glob pass and everything else fail the arm. Accepting the exposure and stating it in prose was the alternative, and it lost because the accidental bound it leaned on had already weakened once, when a machine-level target registry appeared as a side effect of an unrelated test.

`claude:canon-rollout` is the one arm declaring it, at `escape_scope = []`, because its narration tells the run to dispatch no worker and a correct run touches none of the eight watched destinations. An arm that drives the dispatch widens the scope from what that run measures rather than from a guess at what a worker touches. `canon/context/sandbox/coverage/arms.md` states what a pass on that arm proves.

A scoped pass says nothing about a write past the watch's reach, being a home directory, a sibling worktree, or the machine-level target registry a live dispatch touches. It says nothing about whether a write it saw belongs to this run rather than a sibling's, since the harness cannot attribute one.

`snapshot_root` returns an empty manifest both when a watch ran clean and when none of the four directories existed under a root. `run.sh` therefore sets a flag whenever any root held one of them at snapshot time and passes it as `--escapes-watched`, and `checkEscapeScope` reports unmeasured rather than passing when no root did.

### A concurrent session is a witness, never a pass

`sessions_concurrent` names a session the client's registry carried on both sides of the run. It appears beside the escape in `run.sh`'s stderr warning and inside the `unbounded escape:` message an `escape_scope` declaration produces, so the operator's own launching session shows up attached to the finding.

`checkEscapeScope`'s pass, fail, and skip outcomes take no branch on it, so `escape_scope = []` keeps failing on any unbounded write whether or not a witness sits beside it. A witness-based skip was the alternative, and it lost because it reopens a declaration that reads as covered while the run underneath can no longer fail. A witness proves someone else was busy, never that a given file is theirs. The registry has no contract either, so a session that writes no record, or a write from something other than a live `claude` process, still leaves the escape to read by hand.

### A nested background dispatch is bounded rather than watched

An arm invoked without the narration its fixture states can dispatch a real `claude --bg` session against the machine's process table. Every watch reports clean and is right to, since a dispatched session writes into neither the tree `snapshot_tree` reads nor the four directories `snapshot_root` reads. An unbound dispatch keeps spending until a person finds and kills it, and `SIGTERM` alone does not end it. Three mechanisms bound it, and all sit in `scripts/lib/sandbox-dispatch.sh` rather than in `run.sh`, their only caller, so `src/sandbox-dispatch.test.ts` reaches each without launching a session.

#### The shim

A `claude` shim sits first on the PATH of the session `run.sh` spawns. It refuses `--bg` and `--background` by name and delegates everything else. The harness calls the real binary by resolved path, since the arm's prompt is an argument to that call and a prompt naming the flag would otherwise refuse the run. That path is written into the shim rather than passed through the environment, because a variable carrying it sits in the spawned session's environment and hands any arm the string that walks around the bound.

#### The session recording

`run.sh` snapshots `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/sessions` either side of the run, comparing record names rather than content, since a live session rewrites its own record on every status change. The result reports on `sessions` in the merged JSON rather than through `escape_scope`, because folding a process fact into a key defined against a file-write watch would make the key mean two things and silently widen `claude:canon-rollout`'s empty declaration.

A new record reads as a dispatch because the harness's own session leaves none. A headless `claude -p` writes no registry entry, so a sandbox path appearing there names either a scenario staging one by hand, such as `git-worktree`, or a nested dispatch. A client that started registering print-mode runs would have every sandbox run report itself.

#### The reap

`run.sh` starts its session under `set -m`, so the session leads a process group of its own, and signals that group after the verdict is taken, escalating to `SIGKILL`. The group has to be one the run created, since signalling the inherited group would reap the operator's terminal, so the run compares the session's group against its own and `reap_process_group` refuses a group matching the calling shell.

The reap goes out through the `EXIT` trap as well as the ordinary path. A session that dispatches a child and exits non-zero leaves the run with no verdict to take, which is the failure the backstop exists for. The ordinary path reaps first, because the outcome has to reach the merged record, and the trap then skips a second signal.

#### What the bound misses

- A dispatch calling the binary by an absolute path never resolves through PATH, which is the half the reap covers.
- A dispatch calling `setsid` leaves the group before the reap reads it, which is the half the shim covers.
- The registry is a client-owned surface carrying no contract, so a client that stops writing a record per session breaks the detection with nothing reporting the break.

Those three are why the recording reports and never fails a run.

## Gotchas

- Never point `CANON_SANDBOX_DIR` under `~/.claude/`, such as a background job's own scratch folder. Provisioning succeeds there, and the driven session then has every `Write` refused as a sensitive path, so it plans its files in the reply and writes none. The guard does not refuse the path.
- A caller resolving the tree apart from the provisioning that populated it misses it. `canon sandbox check <target>` run after a separate `canon sandbox <target>`, and `canon sandbox reset` or `canon sandbox clean` run alone, each mint a fresh id. Pin one with `CANON_SANDBOX_DIR` across the whole sequence to iterate against a single tree.
- An escape list covering the whole tree, or a failure count far past what the arm declares, reads as a tree collision before a finding: a stale `canon` still sharing one default tree, or two commands pinned to the same hand-set `CANON_SANDBOX_DIR`.
- Escape detection assumes the toolkit's shared scratch is quiet while a run is in flight. The watch attributes any change in the four directories to the spawned session, so a launching session that edits them mid-run draws an escape naming its own file. Run the harness from a session that leaves them alone, or read a reported escape against what else was happening.

### A scenario faking a live session writes to the real registry

A scenario needing a live session record for a roster read, such as testing occupancy against `canon sessions list`, has no sandbox-local registry to point at. Provisioning and the spawned `claude -p` run are separate script invocations with no shared environment, so a variable set during provisioning cannot repoint `CLAUDE_CONFIG_DIR` for the spawned session, and the scenario writes to the host's real `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/sessions/`.

Bound the staged process well under a day, so the record drops out of the live roster on its own rather than sitting there for every consumer. Key the record's filename on the process's pid, so a second drive gets its own record instead of orphaning the first run's process.

Such a record does not read as a nested dispatch, because `run.sh` snapshots the registry after provisioning and the staged record is already on the before side. Stage it in the scenario script rather than from inside the driven session, where it would be reported.
