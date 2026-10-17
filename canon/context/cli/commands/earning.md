---
title: What earns a verb
description: Where a shared helper lifts to, the tests a new verb passes, and the skill catalog verbs
---

# What earns a verb

## Decisions

### Shared helpers

A helper lifts out of its first domain once a second domain needs it, into the folder of the domain that fits the contract, or to the `src/` root when none does.

- `stripFrontmatter` moved from `src/gov/payload.ts` to `src/markdown/frontmatter.ts` when `docs` arrived, so `docs` carries no dependency on `gov`
- `copyPreservingMode`, `resolveTarget`, and `cliRun` lifted to the root the same way
- `listIgnored` lifted from `src/indexes/walk.ts` to `src/git/ignore.ts` when the comment scan became its second caller

### A subject lands in a named folder

When what moves is a subject rather than a function, it lands in a folder. `INSTALL_BROWSER`, `isBrowserMissing`, and `isEngineMissing` came out of `src/demo/` into `src/browser/engine.ts` when `canon inventory` became the second command driving a browser.

The three answer one question together, what a command needs to know before it can report a failure honestly. A root file per predicate would have spread it across three.

### Shared engines

Behavior shared across domains lands in `src/sync/` rather than the first domain that needs it. Gov is the first consumer of the sync engine, and burying it under `src/gov/` would force a move when a second consumer arrives.

Feature entries stay separate from this domain. They document a user-facing artifact such as a deck folder's `deck.json` or the design token schema, worth reading without the CLI plumbing.

### What earns a command

A domain earns a command when the operation is mechanical, not when the domain is important. Tasks gained `archive`, then `pull-request` and `outcome`, each taking a decision a skill already made and applying it to a file.

Creating a task proposes a phase label from the board and writes prose from a conversation, which is judgment. It stays in `task-board`, and no `create` verb exists to tempt a caller.

### A structured edit to shared scratch earns a verb

Worktree isolation is why. `Edit` and `Write` refuse a main-root path from a linked worktree and a shell stream editor is banned for an in-place edit, so a verb resolving the root in-process is what is left.

- `pull-request` and `outcome` are the two the board takes
- Creating a whole file earns nothing, since a heredoc through `Bash` writes it safely, which is why no verb exists for a plan or a review report

### Answering a question no skill can answer alone

`sessions list` reads a registry outside the project to say which session holds which branch. A runbook could only describe the lookup and every session would re-derive it.

The test still holds, since the work is a mechanical read rather than a judgment. The reasoning sits in `canon/context/cli/overview.md`.

### `sessions list --self`

It narrows that read to the caller's own row, which a dispatcher reads to learn the `sessionId` it carries into a launch. The join tries three identities in order and never a fourth.

- `CLAUDE_CODE_SESSION_ID`
- `CLAUDE_PID`
- The pid the `CLAUDE_CODE_MESSAGING_SOCKET` basename spells
- Never `CLAUDE_CODE_HOST_SESSION_ID`, which holds a `local_`-prefixed harness value matching no row

### `--self` refusals name the failed half

`no-self-identity` means the environment states none of the three. `no-self-row` means it states one and no live row carries it. Both refuse as `no-registry` does, rather than returning an empty roster.

### Replacing a reading taken by hand

`canon records size` reports each record folder's file count, bytes, two mtime windows at 7 and 30 days, and the dates of its least and most recently written file. It gates on none, since a record folder has no correct size and the number is one to notice.

What earned it is that the memory pen went from 44 entries to 236 between two readings taken by hand two weeks apart.

### The growth read is a proxy

`mtime` overstates and never understates. A machine restored by `canon records pull` reads its whole tree as new, because a hard reset re-dates every file it writes.

The set read is `BACKED_FOLDERS` plus the scratch folder, since deletable without loss is not empty. `.records.git` is the backup history and `worktrees/` holds checkouts with their own removal verb.

### `canon records prune-tmp`

It passes the same test, replacing a manual scratch cleanup with a mechanical report. It is a dry run by default and deletes only under `--write`.

`newestMtime`, exported from `src/records/size.ts` for this second caller, walks with the `walk` and `absorb` pair `sizeRecords` uses, so the two verbs agree on what counts as a file and which mtime a rewritten entry carries.

### What prune-tmp skips

`tmp/handoff/` and `tmp/pr/poll/` are skipped, since a reader deletes a handoff itself and a poll baseline is live state. The pre-split names those folders replaced are skipped the same way on a project the rename never reached.

- `memory-routing/`
- `teach-promotion/`
- `ui-checklist/`
- `pr-poll/`

### The skip set reads other migrations' tables

`RECORD_LAYOUT_MOVES` names `memory-archive`, the retired-entry archive `records push` still backs. `PROMOTED_FOLDERS` in `src/migrate/scratch-evidence.ts` names an evidence folder a durable record cites.

A project that has not run either migration still carries both at the scratch root, where the age test would eventually offer them for deletion. `migratedScratchNames()` derives the skip from each table's rows and names the migration to run as the reason, rather than a third hand-kept list.

### The skill catalog verbs

`canon claude skills list` reads `claude/skills/` alone. Internal skills under `.claude/skills/` are excluded, since a count spanning both reports work that never installs into a target.

Each entry carries a `requirement` boolean for the sibling `REQUIREMENT.md`. It reports presence and never a reason, and since coverage is universal a `false` is a gap to close rather than a recorded exemption.

- `canon claude skills audit` gates that rule across both corpora
- The boolean reads the shipped catalog while the audit answers whether a working tree conforms

### `skills drift <ref>`

It is the one verb under `skills` reading history, naming which shipped bodies were rewritten between that ref and `HEAD`. A session holds a skill body from the moment it loads one, and re-invoking does not re-read the file.

The ref is required, since `HEAD` is the only default and would answer every run with nothing moved. Nothing records the commit a session started from, so a caller recovers it through `git log -1 --format=%H --before='<duration> ago'` and rounds up. That is safe because the report over-reports in that direction.

### A second route to a stale body

A session editing a body and then invoking that skill later in one chain replays what it loaded before the edit. That is the ordinary ship shape, since a branch touching `context-fold`, `git-stage`, or `git-pr` runs those skills at the end.

The verb does not reach this route, since the edit is still uncommitted while the replay happens.

### Staleness shape decides who notices

A held body naming a file the branch deleted fails loudly by having nothing to read. One naming a file that still exists while saying something different resolves and reads current, so the session applies the stale rule and reports success.

### Reading the report is not acting on it

The report fires only when a caller runs it. One session ran the verb at start, read a moved review body in the result, and applied the stale rule for the rest of the day.

### `skills reach`

`canon claude skills reach` is the fourth verb under `skills`. It reads the shipped bodies for a path their reader cannot open, keying on ownership rather than existence.

It reports and never gates, since a body naming a toolkit path is sometimes a toolkit-scoped instruction. `canon/context/cli/audits/skills.md` carries the ownership key, the qualifier, and why both landed where they did.
