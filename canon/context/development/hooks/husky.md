---
title: Husky hooks
description: What each git hook runs, the five post-merge steps and their order, the POSIX sh errexit constraint, the second shellcheck run, and stripping inherited git variables
---

# Husky hooks

## The hooks

- `pre-commit` runs `lint-staged` (prettier, cspell, shfmt, shellcheck on staged files)
- `commit-msg` runs `commitlint` against the conventional commit format
- `pre-push` runs `bun run check`. After pushing, run `git status`. If files changed, commit the diff as `style(<scope>):` and push again.
- `post-merge` runs five steps in order, covered below
- `post-rewrite` delegates to `post-merge` on the `rebase` argument, so a `pull.rebase=true` machine gets the same steps. It exits on `amend`, which rewrites nothing on the board.

## The post-merge steps

Ordering is the one coupling between the steps and nothing enforces it. Each step that can be switched off names its `CANON_SKIP_` variable in the hook's own header, since the header is what a person reads looking for the switch.

### Archiving the merged task

The first step archives the task each merged pull request closed and stays silent otherwise. It is the only trigger that fires after a merge, covered in `canon/context/claude-plugin/skill-archiving.md`. It reads `ORIG_HEAD..HEAD` rather than the tip, since one pull routinely fast-forwards over several merges and reading `git log -1` would strand every task but the last.

### Pushing the records

The second step runs `canon records push`, which backs the gitignored record folders to a private remote. The call sits after the archive so an unreachable remote delays no archiving, and it fires on every merge rather than on one that closed a task, since a review report and a memory entry both land on runs that close nothing.

A refusal prints its reason with a retry hint, except `unsafe-payload`, which points at running the push by hand to see the blocked paths, since waiting on the remote fixes nothing there. A checkout that never ran the one-time setup answers `no-repository` and reports nothing.

### Reclaiming merged worktrees

The third step runs `canon worktrees reclaim --json`, which removes the worktree and the branch behind a merged pull request so a shipped directory goes without a person remembering. The verb clears only what passes all three of its conditions, being a merged pull request, a clean working tree, and no live session on the directory, so an idle worker keeps its own worktree until someone retires the session. `CANON_SKIP_RECLAIM=1` turns the step off.

The reclaim call carries no `--root` and no `cd`, unlike the two steps above it, and that is load-bearing rather than an oversight. Git runs a hook from the top level of the worktree the pull happened in, and `reclaimReport` reads `process.cwd()` so `verdict` refuses that directory as `current-worktree`. A root argument would turn the running worktree into an ordinary candidate and let a pull inside a linked worktree delete the ground under itself. The two steps above pass `--root "$root"` for the opposite reason, because the board and the records live at the main root.

The step reads all three fields before reporting any of them, and the exit decides nothing. A run that removes one worktree and fails on another exits 1 with a directory already deleted, so a report keyed on the exit names the failure and never the removal, which is the one act in this file nothing undoes. A record arriving with `"reason":null` matches no quoted-string pattern, which is what lets one block separate a refusal from a removal that failed without reading the exit.

An unreadable reading refuses every verdict rather than some of them, so the step reports the reason. `gh-missing` is the one that stays quiet with it, since a machine without `gh` answers that on every merge forever, which is the shape the records push treats `no-repository` as. The hook header carries that gap instead.

Nothing automated tests the step itself. The sandbox drives model sessions against skills and fires no husky hook, so what stands in its place is the `--json` record under test at `src/commands/worktrees.test.ts`, the `check:shell` pass that reaches this file, and a hand probe driving the block against each record shape.

### Reinstalling the binary

The fourth step runs `canon upgrade --json` under `CANON_NON_INTERACTIVE=1`, since the hook has no TTY, so a global binary behind what is published reinstalls on the next merge instead of staying stale until someone runs `canon sync --check` by hand. The reclaim sits before it, since the upgrade reinstalls the binary the hook is running under and every step after it runs against a package that moved. `CANON_SKIP_UPGRADE=1` turns the step off.

The printed line comes from the JSON record's `message` field, which `src/commands/upgrade.ts` renders once per outcome rather than the hook reconstructing one from raw fields. The `current` state reuses `describeSkew` verbatim, matching the wording `canon sync --check` and `canon claude skills drift` use. `emit` runs `message` through `singleLine` first, collapsing it to one line and swapping any double quote for an apostrophe, since a registry error can carry either and the hook reads the field with a pattern rather than a parser.

`current` stays quiet, matching the archive block's silence on `no-match` and `no-board` and the records push printing only when something changed. A line on every merge that says nothing moved is the shape both siblings avoid. A reinstall that fails partway names both versions it was moving between, in that same `message` field, which is the one route back to a broken global binary the next session meets.

### Updating the plugin cache

The fifth step runs `canon claude plugin-update --json`, mirroring the binary reinstall for the marketplace plugin cache, which the binary reinstall never touches. Without it a dispatched session keeps resolving a retired skill body until an operator runs `claude plugin update` by hand. It sits last for the reason the reinstall sits after the records push: a slow or unreachable marketplace delays nothing else in the file. `CANON_SKIP_PLUGIN_UPDATE=1` turns the step off.

The verb resolves the plugin's own id by reading `claude/.claude-plugin/plugin.json`'s `name` field and matching it against a `claude plugin list --json` row by `<name>@` prefix, refusing rather than picking one when more than one installed row shares the name. `claude plugin update` carries no `--json` of its own, so the verb reads the version back off `claude plugin list --json` after the update runs, the same trust-the-disk move `canon upgrade` makes.

`current` stays quiet, and so do the refusal reasons `no-claude` and `no-plugin`, matching `gh-missing` and `no-repository` above them. Both name a permanent condition on a machine or project that will never carry the marketplace plugin, and a line nobody can act on teaches a reader to skip the block. Every other refusal, and an update that changed the version, prints once off the record's `message` field, run through `singleLine` first.

An older global binary carrying no `upgrade` or `plugin-update` subcommand produces no parseable record, and the hook stays quiet on that the way every such gap here does until a release lands.

## Gotchas

### Every hook runs as POSIX sh under errexit

Husky runs every hook as `sh -e "$hook"`, so the shebang is advisory and the file is POSIX sh under errexit whatever it declares. A bare `grep` that matches nothing aborts the hook and prints a husky failure on a clean pull, which is why each test sits inside an `if` condition rather than standing alone. Errexit exempts a condition and nothing else.

### A second shellcheck run reaches the hooks

`check:shell` runs twice, and the second run is what reaches these files. The first globs `*.sh` under `scripts`, `tooling`, `claude`, and `.claude/hooks`, and no husky hook carries an extension, so adding `.husky` to that path list would change nothing on its own. The name filter is the half that skips them. The second run takes `find .husky -maxdepth 1 -type f` with `--shell=sh`, which reaches every hook and skips the `_` directory husky owns, so a hook added later is covered the day it lands rather than when someone remembers to name it.

`canon pr key-changes` still reports a path with no extension as unnamed even where a bullet names it in a code span, which is why `.husky/post-merge` reads as uncovered on a pull request whose first bullet is about it.

### Git hook variables beat `-C`

Git hooks export `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, and `GIT_PREFIX`, and those beat `-C` on any shelled git call, so they have to be stripped. Under the pre-push hook an inherited `GIT_DIR` made `git -C src ls-tree` resolve against the whole repository, so `canon comments scan src` returned repo-wide figures for a subtree, output ordinary enough to be worse than an error. In a test fixture the same inheritance let `git config user.email` overwrite the real repository's committer identity and staged every tracked file as deleted.

Route every shelled git call through `gitEnv()`, fixtures included, and prove the guard by exporting `GIT_DIR` and running the suite, since the standalone run passes either way.
