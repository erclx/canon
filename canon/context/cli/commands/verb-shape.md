---
title: Verb shape
description: Walking a gitignored tree rather than asking git, holding two roots apart, guards an added argument widens, measuring an external tool, and ordering a record's fields for a shell reader
---

# Verb shape

## A verb whose subject is gitignored walks the tree instead of asking git

`listRepositoryFiles` is what every sweep in `src/migrate/` reads, and it answers about tracked files, which is the one population `canon migrate record-tree` has to miss entirely. The record folders are gitignored by construction, so that listing returns none of them and a verb built on it reports a clean tree over the 2,636 old-root citations the records were actually holding. `walkRecordTree` reads the record root with `readdir` and `Bun.Glob` instead. That is what makes `src/migrate/record-tree.ts` a sibling of `records.ts` rather than a scope flag on it: one module answers about a repository listing and the other about a directory walk, and folding them would give one file two enumeration models.

Asking git for the ignored half, with `--others --ignored`, was the alternative. It returns the backup history under `.canon/.records.git` along with everything else, which `runRecords` already measured for this tree at 9,744 files and 83M, so the listing pays to enumerate an object store before anything filters it back out. The walk skips that directory by name and never opens it. Measured at `d60b3117` on 2026-09-01.

## A verb reading both records and a git range takes two roots

`mainWorktreeRoot()` is the right root for a records read and the wrong one for a git range, and a verb doing both has to hold them apart. The plans folder, the board, and the memory pen are shared scratch at the main worktree root, while a dispatched branch's own commits live in a linked worktree, so one root answers both questions only in the main checkout. `canon tasks plan-reach` carries the split as `ReachOptions.repo`, defaulting to the records root and set by `runReach` to `process.cwd()`, which is the worktree the caller stands in. A single root there measures a checkout sitting on the trunk: the range closes on itself and every branch reports having written nothing, which is a clean answer rather than a failure and so reaches a reader as a result.

`canon gov test-order` has the same shape and answers it in prose instead, with `auto-ship` Step 4 telling the session which directory to run it from. A parameter is the stronger form, since an instruction is only as good as the body holding it, but the two are not equivalent surfaces: that verb takes its root from where it was invoked and has no records read to part company with.

## An argument added for testability widens the guards

`canon claude setup` takes an optional `[dest]` argument rather than hardcoding `$HOME/.claude`, so the settings merge is testable without pointing a test at a real home directory. Because the destination is an argument, `canon claude setup .claude` run from the toolkit root would rewrite the tracked `.claude/settings.json`, so the guard checks the exact destination path rather than a prefix, since the sandbox scenario legitimately writes under the repo.

## A verb driving an external tool measures it rather than reasoning about it

`canon worktrees reclaim` is shaped by two behaviors read off git 2.43.0 rather than assumed. `git worktree remove` takes a registration whose directory is already gone as readily as a live one and clears it, so the hand-deleted case needs no command of its own and the sequence is one unlock, one remove, and one branch delete whatever state the directory is in.

The same command removes the directory a caller is standing in without complaint, so `verdict` in `src/worktrees/reclaim.ts` refuses the worktree the reading runs from, and `runReclaim` scopes every git call in the removal to `mainWorktreeRoot` rather than to the caller's directory, since a removal earlier in a run would otherwise delete the directory the calls after it resolve against and leave each remaining branch undeleted while reporting the failure against the worktree rather than the cause. `RemovalOptions.cwd` carries no default for that reason, which is the one case in this domain where a required argument beats a safe one: the only value a default could hold is the process directory, and that is the unsafe half, so a caller that omits it meets a compiler error rather than the failure.

`git worktree prune` stays in the sequence as the recovery for a git that refuses `remove` on a stale registration, and it runs once between the removals and the branch deletes. It takes no path to scope it, so it clears the bookkeeping for every directory already gone, refused entries included, and a run placing it after the branch deletes would leave a branch standing with nothing left in the listing to find it by. `git worktree unlock` exits 128 with "is not locked" for the ordinary case, so its result is not read and a lock that genuinely refuses to lift surfaces as the remove failing instead. Measured at `69f9db56` on 2026-09-01.

## A record a shell reads orders its fields for the pattern rather than for the reader

`canon worktrees reclaim` carries a `--json` record, and `.husky/post-merge` is its first caller that is not a person. The record is `{reason, detail, dryRun, reclaimable, removed, failed, pruned, outcomes}`, and that order is load-bearing rather than cosmetic. A shell reads it with a greedy `sed` pattern rather than a parser, so `reason` sits ahead of the free-text `detail` a second match could otherwise be found in, and the scalar counts sit ahead of `outcomes`, whose per-entry `failedAt` and boolean `removed` match neither digit pattern. `src/commands/worktrees.test.ts` asserts the ordering, since a field reordered by a later edit breaks a caller no typecheck reaches.

`reclaimRecord` is a pure function over the values the run already holds, which is what makes the record testable without a repository, a `gh` credential, or a directory the test would then have to remove. `migrateExitCode` in `src/commands/records.ts` is the same shape. The counts derive from `outcomes` inside it rather than being passed in, since two numbers a caller computes are two numbers a caller can get wrong.

A dry run and a reading that found nothing reclaimable both carry `removal: null` on the source and differ on `reclaimable`, which is what lets a caller separate a quiet repository from a run that was asked not to act. The failure path does not return early: one `emitReclaim` call serves both endings, and the exit is `failed.length > 0 ? 1 : 0`, so no ending can ship without its record. Measured at `e6ac473f` on 2026-09-02.
