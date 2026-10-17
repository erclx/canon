---
title: Verb shape
description: Walking a gitignored tree, holding two roots apart, guards an added argument widens, measuring an external tool, and ordering a record for a shell
---

# Verb shape

## Decisions

### A gitignored subject needs a walk

`listRepositoryFiles` is what every sweep in `src/migrate/` reads, and it answers about tracked files, the one population `canon migrate record-tree` has to miss entirely. The record folders are gitignored by construction, so a verb built on it reported a clean tree over the 2,636 old-root citations the records held.

`walkRecordTree` reads the record root with `readdir` and `Bun.Glob` instead.

### A sibling, not a scope flag

That makes `src/migrate/record-tree.ts` a sibling of `records.ts`. One module answers about a repository listing and the other about a directory walk, and folding them would give one file two enumeration models.

### Asking git for the ignored half lost

`--others --ignored` returns the backup history under `.canon/.records.git` along with everything else. `runRecords` measured that for this tree at 9,744 files and 83M, so the listing pays to enumerate an object store before anything filters it out.

The walk skips that directory by name and never opens it. Measured at `d60b3117` on 2026-09-01.

### Records and a git range take two roots

`mainWorktreeRoot()` is right for a records read and wrong for a git range, and a verb doing both holds them apart. The plans folder and the board are shared scratch at the main worktree root, while a dispatched branch's commits live in a linked worktree.

`canon tasks plan-reach` carries the split as `ReachOptions.repo`, defaulting to the records root and set by `runReach` to `process.cwd()`, the worktree the caller stands in.

### One root reads a clean answer

A single root measures a checkout sitting on the trunk. The range closes on itself and every branch reports having written nothing, a clean answer rather than a failure, so it reaches a reader as a result.

### `test-order` answers it in prose

`canon gov test-order` has the same shape, with `auto-ship` Step 4 telling the session which directory to run it from. A parameter is stronger, since an instruction is only as good as the body holding it.

The two are not equivalent surfaces. That verb takes its root from where it was invoked and has no records read to part company with.

### An argument added for testability widens the guards

`canon claude setup` takes an optional `[dest]` argument rather than hardcoding `$HOME/.claude`, so the settings merge is testable without a real home directory.

Because the destination is an argument, `canon claude setup .claude` from the toolkit root would rewrite the tracked `.claude/settings.json`. The guard checks the exact destination path rather than a prefix, since the sandbox scenario legitimately writes under the repo.

### Measure an external tool

`canon worktrees reclaim` is shaped by two behaviors read off git 2.43.0 rather than assumed. `git worktree remove` takes a registration whose directory is already gone as readily as a live one, so the hand-deleted case needs no command of its own.

The sequence is one unlock, one remove, and one branch delete whatever state the directory is in.

### Removal never deletes the caller's directory

The same command removes the directory a caller is standing in without complaint. `verdict` in `src/worktrees/reclaim.ts` refuses the worktree the reading runs from.

`runReclaim` scopes every git call in the removal to `mainWorktreeRoot`. Otherwise a removal earlier in a run would delete the directory later calls resolve against, leaving each remaining branch undeleted and reporting the failure against the worktree rather than the cause.

### `RemovalOptions.cwd` has no default

It is the one case in this domain where a required argument beats a safe one. The only value a default could hold is the process directory, the unsafe half, so a caller omitting it meets a compiler error rather than the failure.

### `prune` runs once, between

`git worktree prune` stays as the recovery for a git that refuses `remove` on a stale registration. It takes no path, so it clears the bookkeeping for every directory already gone, refused entries included.

Placed after the branch deletes, it would leave a branch standing with nothing in the listing to find it by.

### `unlock` is not read

`git worktree unlock` exits 128 with "is not locked" for the ordinary case, so its result is ignored and a lock that genuinely refuses to lift surfaces as the remove failing. Measured at `69f9db56` on 2026-09-01.

### A shell-read record orders its fields for the pattern

`canon worktrees reclaim` carries a `--json` record, and a post-merge hook is its first caller that is not a person. The record is `{reason, detail, dryRun, reclaimable, removed, failed, pruned, outcomes}`, and the order is load-bearing.

### Why the order matters

This repository's `.husky/post-merge` reaches it through `canon hooks post-merge`, which parses with `JSON.parse`. The base stack's hook and any hook installed before that verb read it with a greedy `sed` pattern.

- `reason` sits ahead of the free-text `detail`, which a second match could otherwise be found in
- The scalar counts sit ahead of `outcomes`, whose per-entry `failedAt` and boolean `removed` match neither digit pattern
- `src/commands/worktrees.test.ts` asserts the ordering, since a reordered field breaks a caller no typecheck reaches

### `reclaimRecord` is pure

It is a pure function over values the run already holds, so the record is testable without a repository, a `gh` credential, or a directory the test must remove. `migrateExitCode` in `src/commands/records.ts` has the same shape.

The counts derive from `outcomes` inside it, since two numbers a caller computes are two numbers a caller can get wrong.

### One emit serves both endings

A dry run and a reading that found nothing reclaimable both carry `removal: null` on the source and differ on `reclaimable`, so a caller can separate a quiet repository from a run asked not to act.

The failure path does not return early. One `emitReclaim` call serves both endings and the exit is `failed.length > 0 ? 1 : 0`, so no ending ships without its record. Measured at `e6ac473f` on 2026-09-02.
