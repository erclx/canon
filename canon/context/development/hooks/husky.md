---
title: Husky hooks
description: What each git hook runs, the five post-merge steps and their order, the POSIX sh errexit constraint, the second shellcheck run, and stripping inherited git variables
---

# Husky hooks

## Layout

### The hooks

Five git hooks live in `.husky/`, and `post-merge` carries most of the logic.

- `pre-commit` runs `lint-staged`, being oxfmt on staged `.json` and `.md` files and shfmt and shellcheck on staged `.sh` files
- `commit-msg` runs `commitlint` against the conventional commit format
- `pre-push` runs `bun run check`, so a push fails on format drift until `bun run format` runs and the result is committed
- `post-merge` runs five steps in order through `canon hooks post-merge`, covered below
- `post-rewrite` delegates to `post-merge` on `rebase`, so a `pull.rebase=true` machine gets the same steps, and exits on `amend`, which rewrites nothing on the board

## Decisions

### The post-merge steps

`.husky/post-merge` resolves the main root, returns on a checkout with no board at `.canon/tasks`, returns when `canon` is not on PATH, and hands the rest to `canon hooks post-merge --root "$root"`. The verb in `src/hooks/post-merge.ts` owns the order and every line it prints, so the hook carries no step logic.

- The board guard stops all five steps rather than the archive alone, keeping the behavior the shell hook had
- Each step runs as a child `canon <verb> --json` rather than in-process, keeping each verb's gates and the reclaim's working-directory rule, and letting the plugin update run the new binary
- The verb reads each record with `JSON.parse`, so a `message` carrying an escaped quote prints in full, which the `sed` reader it replaced truncated
- A child producing no parseable record is an older global binary carrying no such subcommand, and that step stays quiet
- Every child gets `gitEnv()` with `extendEnv: false`, and so does the `ORIG_HEAD..HEAD` read. Lines go to stderr and the verb exits 0 on every path.

Ordering is the one coupling between the steps, and the call order in `runPostMerge` holds it. Each step that can be switched off names its `CANON_SKIP_` variable in the hook's header, where a person looks for the switch, and the verb's help lists them too.

### The hook bootstrap

A global binary older than the verb fails a probe that greps `canon hooks post-merge --help` for the verb's own `Usage:` line. The exit cannot answer it, since an older binary answers an unknown command's `--help` with its root help and exits zero, which 5.8.0 does.

The verb holds the only step that would update the binary, so the hook runs `canon upgrade` itself when the probe fails, unless `CANON_SKIP_UPGRADE` is set.

- It probes again and runs the verb in the same hook when the new binary carries it, since the next merge's `ORIG_HEAD..HEAD` never covers this one and waiting would drop its archive and records push
- A registry still serving a binary without the verb falls through to `bun "$root/src/cli.ts" hooks post-merge`, gated by the same probe, since a worktree pull can leave the main checkout without it
- Only when neither answers does the merge go unprocessed, quietly
- Each child step still runs the global binary on PATH, which carries every step verb already
- The fallback stays permanently, since any machine whose binary predates the verb meets the same gap

### Archiving the merged task

The first step archives the task each merged pull request closed and stays silent otherwise, printing one line when the task still waits on a pending branch. It is the only trigger that fires after a merge.

It reads `ORIG_HEAD..HEAD` rather than the tip, since one pull routinely fast-forwards over several merges and `git log -1` would strand every task but the last.

### Pushing the records

The second step runs `canon records push`, which backs the gitignored record folders to a private remote. It sits after the archive so an unreachable remote delays no archiving, and it fires on every merge rather than one that closed a task, since a review report lands on runs that close nothing.

A refusal prints its reason with a retry hint. `unsafe-payload` instead points at running the push by hand to see the blocked paths, since waiting on the remote fixes nothing there. A checkout that never ran the one-time setup answers `no-repository` and reports nothing.

### Reclaiming merged worktrees

The third step runs `canon worktrees reclaim --json`, which removes the worktree and branch behind a merged pull request so a shipped directory goes without a person remembering. `CANON_SKIP_RECLAIM=1` turns it off.

The verb clears only what passes all three conditions, being a merged pull request, a clean working tree, and no live session on the directory, so an idle worker keeps its worktree until someone retires the session.

### The reclaim working directory

The reclaim child carries no `--root` and runs from the verb's own working directory, which is load-bearing. Git runs a hook from the top level of the worktree the pull happened in, and `reclaimReport` reads `process.cwd()` so `verdict` refuses that directory as `current-worktree`.

A root argument would turn the running worktree into an ordinary candidate and let a pull inside a linked worktree delete the ground under itself. The two steps above pass `--root` for the opposite reason, because the board and the records live at the main root.

### Reading the reclaim record

The step reads all three fields before reporting any of them, and the exit decides nothing. A run that removes one worktree and fails on another exits 1 with a directory already deleted, so a report keyed on the exit names the failure and never the removal, the one act here nothing undoes.

- A record with `"reason":null` reads as no refusal, since the verb takes `reason` only as a non-empty string, which separates a refusal from a failed removal without the exit
- An unreadable reading refuses every verdict rather than some, so the step reports the reason
- `gh-missing` stays quiet with it, since a machine without `gh` answers that on every merge forever, the shape the records push treats `no-repository` as, and the hook header carries that gap instead

`src/hooks/post-merge.test.ts` drives every step against an injected runner, covering the order, each child's cwd and root, the skip switches, and each record shape's line. `src/hooks/post-merge-hook.test.ts` runs the hook under `sh -e` against stub `canon` and `bun` binaries, covering which gets the verb and the quiet skip when neither carries it.

### Reinstalling the binary

The fourth step runs `canon upgrade --json` under `CANON_NON_INTERACTIVE=1`, since the hook has no TTY, so a global binary behind what is published reinstalls on the next merge instead of staying stale until someone runs `canon sync --check`. `CANON_SKIP_UPGRADE=1` turns it off.

It sits after the reclaim, since the upgrade reinstalls the binary the hook is running under and every later step runs against a package that moved.

### The upgrade line

The printed line comes from the JSON record's `message` field, which `src/commands/upgrade.ts` renders once per outcome. The `current` state reuses `describeSkew` verbatim, matching `canon sync --check` and `canon claude skills drift`.

- `emit` runs `message` through `singleLine`, collapsing it to one line and swapping a double quote for an apostrophe, since a registry error can carry either and older hooks read it with a pattern
- `pending` prints like any non-`current` state, as `CLI stays at ...`, so the hook needs no branch for it
- `current` stays quiet, as the archive does on `no-match` and `no-board` and the records push when nothing changed, since a line on every merge saying nothing moved is the shape both avoid
- A reinstall that fails partway names both versions in the same field, the one route back to a broken global binary

### Updating the plugin cache

The fifth step runs `canon claude plugin-update --json`, mirroring the binary reinstall for the marketplace plugin cache, which the reinstall never touches. `CANON_SKIP_PLUGIN_UPDATE=1` turns it off. Without it a dispatched session keeps resolving a retired skill body until an operator runs `claude plugin update`.

- The plugin follows the marketplace head rather than the binary, so it can lead the binary by a whole publish
- A pull lands the release commit before the publish finishes, so `canon upgrade` reads `current` against an npm not yet serving it, hence the `CLI ...` and `Plugin ...` prefixes and `pending`
- It sits last so a slow or unreachable marketplace delays nothing else

### The plugin update verb

The verb resolves the plugin's own id from the `name` field of `claude/.claude-plugin/plugin.json`, matching a `claude plugin list --json` row by `<name>@` prefix and refusing rather than picking when more than one installed row shares the name.

`claude plugin update` carries no `--json`, so the verb reads the version back off `claude plugin list --json` after the update, the trust-the-disk move `canon upgrade` makes.

- `current` stays quiet, and so do the refusals `no-claude` and `no-plugin`, since both name a permanent condition and a line nobody can act on teaches a reader to skip the block
- Every other refusal, and an update that changed the version, prints once off the record's `message`, run through `singleLine`
- An older binary carrying no `upgrade` or `plugin-update` subcommand produces no parseable record, and the verb stays quiet until a release lands

### The base stack's copy

`tooling/base/configs/.husky/post-merge` carries the same guard, bootstrap, and verb call, and differs in two ways.

- It has no source-CLI fallback, since a target holds no toolkit `src/cli.ts`, so a target on a binary the registry has not caught up with runs nothing until a release publishes the verb
- A target's binary may predate the verb longer than ours, since the hook ships on sync and the binary on publish, which the `canon upgrade` probe covers unless `CANON_SKIP_UPGRADE` is set

A target's hook archives rather than announces. The board is gitignored, so a shell-side archive leaves no diff to review, which made an announce-only hook the earlier choice. `tasks archive` bounds the archive by a merged pull request number and a closed task, so the verb stands in for that person-in-the-loop check.

A target runs five steps, three acting on the machine, so the `CANON_SKIP_*` switches sit in the hook's header. Output goes to the verb's stderr. `src/hooks/post-merge-hook.test.ts` runs its shared cases against both copies and keeps the source-fallback cases on this repository's.

## Gotchas

### Every hook runs as POSIX sh under errexit

Husky runs every hook as `sh -e "$hook"`, so the shebang is advisory and the file is POSIX sh under errexit. A bare `grep` that matches nothing aborts the hook and prints a husky failure on a clean pull, so each test sits inside an `if` condition or behind `||`.

`post-rewrite` sources `post-merge` with `.` on a rebase, so the post-merge hook never reads `$1` and never exits non-zero. Errexit exempts a condition and nothing else.

### A second shellcheck run reaches the hooks

`check:shell` runs twice, and the second run reaches these files. The first globs `*.sh` under `scripts`, `tooling`, `claude`, and `.claude/hooks`, and no husky hook carries an extension, so adding `.husky` to that list would change nothing.

- The second run takes `find .husky -maxdepth 1 -type f` with `--shell=sh`, which reaches every hook and skips husky's `_` directory, so a hook added later is covered the day it lands
- `canon pr key-changes` still reports an extensionless path as unnamed even where a bullet names it in a code span, so `.husky/post-merge` reads as uncovered on a pull request about it

### Git hook variables beat `-C`

Git hooks export `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, and `GIT_PREFIX`, which beat `-C` on any shelled git call, so they have to be stripped.

- Under the pre-push hook an inherited `GIT_DIR` made `git -C src ls-tree` resolve against the whole repository, so `canon comments scan src` returned repo-wide figures, worse than an error
- In a test fixture the same inheritance let `git config user.email` overwrite the real repository's committer identity and staged every tracked file as deleted
- Route every shelled git call through `gitEnv()`, fixtures included, and prove the guard by exporting `GIT_DIR` and running the suite, since the standalone run passes either way
