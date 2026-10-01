---
title: Husky hooks
description: What each git hook runs, the five post-merge steps and their order, the POSIX sh errexit constraint, the second shellcheck run, and stripping inherited git variables
---

# Husky hooks

## The hooks

- `pre-commit` runs `lint-staged` (prettier, cspell, shfmt, shellcheck on staged files)
- `commit-msg` runs `commitlint` against the conventional commit format
- `pre-push` runs `bun run check`. After pushing, run `git status`. If files changed, commit the diff as `style(<scope>):` and push again.
- `post-merge` runs five steps in order through `canon hooks post-merge`, covered below
- `post-rewrite` delegates to `post-merge` on the `rebase` argument, so a `pull.rebase=true` machine gets the same steps. It exits on `amend`, which rewrites nothing on the board.

## The post-merge steps

`.husky/post-merge` resolves the main root, returns on a checkout with no board at `.canon/tasks`, returns when `canon` is not on PATH, and hands the rest to `canon hooks post-merge --root "$root"`. The verb in `src/hooks/post-merge.ts` owns the order and every line it prints, so the hook carries no step logic. The board guard stops all five steps rather than the archive alone, which keeps the behavior the shell hook had.

Each step runs as a child `canon <verb> --json` rather than in-process. That keeps each verb's own gates, keeps the reclaim's working-directory rule, and lets the plugin update run the binary the upgrade just installed. The verb reads each record with `JSON.parse` and decides its line from the fields, so a `message` carrying an escaped quote prints in full, which the `sed` reader this replaced truncated. A child producing no parseable record is an older global binary carrying no such subcommand, and that step stays quiet. Every child gets `gitEnv()` with `extendEnv: false`, and so does the `ORIG_HEAD..HEAD` read. Lines go to stderr, and the verb exits 0 on every path.

The hook carries one bootstrap. A global binary older than the verb fails a probe that greps `canon hooks post-merge --help` for the verb's own `Usage:` line. The exit cannot answer it, since an older binary answers an unknown command's `--help` with its root help and exits zero, which 5.8.0 does. Since the verb holds the only step that would update it, the hook runs `canon upgrade` itself when that probe fails, unless `CANON_SKIP_UPGRADE` is set, then probes again and runs the verb in the same hook when the reinstalled binary carries it. The next merge's `ORIG_HEAD..HEAD` range never covers this one, so waiting a merge would drop this merge's archive and records push. A registry still serving a binary without the verb leaves that one merge unprocessed. The fallback stays permanently, since any machine whose binary predates the verb meets the same gap.

Ordering is the one coupling between the steps, and the call order in `runPostMerge` is what holds it. Each step that can be switched off names its `CANON_SKIP_` variable in the hook's own header, since the header is what a person reads looking for the switch, and the verb's help lists them too.

### Archiving the merged task

The first step archives the task each merged pull request closed and stays silent otherwise, printing its one line when the task still waits on a pending branch. It is the only trigger that fires after a merge, covered in `canon/context/claude-plugin/skill-archiving.md`. It reads `ORIG_HEAD..HEAD` rather than the tip, since one pull routinely fast-forwards over several merges and reading `git log -1` would strand every task but the last.

### Pushing the records

The second step runs `canon records push`, which backs the gitignored record folders to a private remote. The call sits after the archive so an unreachable remote delays no archiving, and it fires on every merge rather than on one that closed a task, since a review report and a memory entry both land on runs that close nothing.

A refusal prints its reason with a retry hint, except `unsafe-payload`, which points at running the push by hand to see the blocked paths, since waiting on the remote fixes nothing there. A checkout that never ran the one-time setup answers `no-repository` and reports nothing.

### Reclaiming merged worktrees

The third step runs `canon worktrees reclaim --json`, which removes the worktree and the branch behind a merged pull request so a shipped directory goes without a person remembering. The verb clears only what passes all three of its conditions, being a merged pull request, a clean working tree, and no live session on the directory, so an idle worker keeps its own worktree until someone retires the session. `CANON_SKIP_RECLAIM=1` turns the step off.

The reclaim child carries no `--root` and runs from the verb's own working directory, unlike the two steps above it, and that is load-bearing rather than an oversight. Git runs a hook from the top level of the worktree the pull happened in, and `reclaimReport` reads `process.cwd()` so `verdict` refuses that directory as `current-worktree`. A root argument would turn the running worktree into an ordinary candidate and let a pull inside a linked worktree delete the ground under itself. The two steps above pass `--root` for the opposite reason, because the board and the records live at the main root.

The step reads all three fields before reporting any of them, and the exit decides nothing. A run that removes one worktree and fails on another exits 1 with a directory already deleted, so a report keyed on the exit names the failure and never the removal, which is the one act in this file nothing undoes. A record arriving with `"reason":null` reads as no refusal, since the verb takes `reason` only as a non-empty string, which is what lets one step separate a refusal from a removal that failed without reading the exit.

An unreadable reading refuses every verdict rather than some of them, so the step reports the reason. `gh-missing` is the one that stays quiet with it, since a machine without `gh` answers that on every merge forever, which is the shape the records push treats `no-repository` as. The hook header carries that gap instead.

`src/hooks/post-merge.test.ts` drives every step against an injected runner, covering the order, the cwd and root each child gets, the skip switches, and each record shape's line. The sandbox fires no husky hook, so the hook's own few lines are covered only by the `check:shell` pass and a real pull.

### Reinstalling the binary

The fourth step runs `canon upgrade --json` under `CANON_NON_INTERACTIVE=1`, since the hook has no TTY, so a global binary behind what is published reinstalls on the next merge instead of staying stale until someone runs `canon sync --check` by hand. The reclaim sits before it, since the upgrade reinstalls the binary the hook is running under and every step after it runs against a package that moved. `CANON_SKIP_UPGRADE=1` turns the step off.

The printed line comes from the JSON record's `message` field, which `src/commands/upgrade.ts` renders once per outcome rather than the hook reconstructing one from raw fields. The `current` state reuses `describeSkew` verbatim, matching the wording `canon sync --check` and `canon claude skills drift` use. `emit` runs `message` through `singleLine` first, collapsing it to one line and swapping any double quote for an apostrophe, since a registry error can carry either and the base stack's hook, like any hook installed before the verb, reads the field with a pattern rather than a parser.

`pending` prints like any other non-`current` state, as `CLI stays at ...`, so the hook needs no branch for it. `current` stays quiet, matching the archive block's silence on `no-match` and `no-board` and the records push printing only when something changed. A line on every merge that says nothing moved is the shape both siblings avoid. A reinstall that fails partway names both versions it was moving between, in that same `message` field, which is the one route back to a broken global binary the next session meets.

### Updating the plugin cache

The fifth step runs `canon claude plugin-update --json`, mirroring the binary reinstall for the marketplace plugin cache, which the binary reinstall never touches. The plugin follows the marketplace head rather than the binary, so it can lead the binary by a whole publish: a pull lands the release commit before the publish job finishes, the plugin moves, and `canon upgrade` reads `current` against an npm that does not serve the release yet. That is why each line names its subject (`CLI ...`, `Plugin ...`) and why the upgrade verb reports `pending`. Without it a dispatched session keeps resolving a retired skill body until an operator runs `claude plugin update` by hand. It sits last for the reason the reinstall sits after the records push: a slow or unreachable marketplace delays nothing else in the file. `CANON_SKIP_PLUGIN_UPDATE=1` turns the step off.

The verb resolves the plugin's own id by reading `claude/.claude-plugin/plugin.json`'s `name` field and matching it against a `claude plugin list --json` row by `<name>@` prefix, refusing rather than picking one when more than one installed row shares the name. `claude plugin update` carries no `--json` of its own, so the verb reads the version back off `claude plugin list --json` after the update runs, the same trust-the-disk move `canon upgrade` makes.

`current` stays quiet, and so do the refusal reasons `no-claude` and `no-plugin`, matching `gh-missing` and `no-repository` above them. Both name a permanent condition on a machine or project that will never carry the marketplace plugin, and a line nobody can act on teaches a reader to skip the block. Every other refusal, and an update that changed the version, prints once off the record's `message` field, run through `singleLine` first.

An older global binary carrying no `upgrade` or `plugin-update` subcommand produces no parseable record, and the verb stays quiet on that the way every such gap here does until a release lands.

## Gotchas

### Every hook runs as POSIX sh under errexit

Husky runs every hook as `sh -e "$hook"`, so the shebang is advisory and the file is POSIX sh under errexit whatever it declares. A bare `grep` that matches nothing aborts the hook and prints a husky failure on a clean pull, which is why each test sits inside an `if` condition or behind `||` rather than standing alone. `post-rewrite` sources `post-merge` with `.` on a rebase, so the post-merge hook never reads `$1` and never exits non-zero. Errexit exempts a condition and nothing else.

### A second shellcheck run reaches the hooks

`check:shell` runs twice, and the second run is what reaches these files. The first globs `*.sh` under `scripts`, `tooling`, `claude`, and `.claude/hooks`, and no husky hook carries an extension, so adding `.husky` to that path list would change nothing on its own. The name filter is the half that skips them. The second run takes `find .husky -maxdepth 1 -type f` with `--shell=sh`, which reaches every hook and skips the `_` directory husky owns, so a hook added later is covered the day it lands rather than when someone remembers to name it.

`canon pr key-changes` still reports a path with no extension as unnamed even where a bullet names it in a code span, which is why `.husky/post-merge` reads as uncovered on a pull request whose first bullet is about it.

### Git hook variables beat `-C`

Git hooks export `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, and `GIT_PREFIX`, and those beat `-C` on any shelled git call, so they have to be stripped. Under the pre-push hook an inherited `GIT_DIR` made `git -C src ls-tree` resolve against the whole repository, so `canon comments scan src` returned repo-wide figures for a subtree, output ordinary enough to be worse than an error. In a test fixture the same inheritance let `git config user.email` overwrite the real repository's committer identity and staged every tracked file as deleted.

Route every shelled git call through `gitEnv()`, fixtures included, and prove the guard by exporting `GIT_DIR` and running the suite, since the standalone run passes either way.
