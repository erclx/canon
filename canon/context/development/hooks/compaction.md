---
title: Compaction and turn hooks
description: The PreCompact handoff hook, what the client does with a blocked compaction, the silent turn and reply link Stop hooks, and driving a spike
---

# Compaction and turn hooks

## Decisions

### The compaction handoff

`precompact-handoff.sh` is toolkit-only and sits on an event carrying no tool. It registers on `PreCompact` under both matchers and blocks on `manual` and instructs on `auto`.

- It refuses the first `/compact` of a session with exit 2 and names the `session-compact` skill in the stderr text that becomes the blocking reason
- One sentence sends a session holding `canon:role-orchestrator` to its own handoff runbook, since the hook cannot tell that role from a plain session
- On an automatic compaction it exits 0 and writes to stdout
- The seed copy is withheld, since a target without the plugin would meet a blocked `/compact` naming a skill it lacks

### Channels per trigger

Each trigger gets the channel that reaches the session. The vendor's `additionalContext` is not offered for this event, so on `manual` the exit-2 stderr text is the channel. On `auto` a block tells nobody, so exit-0 stdout is the channel, merged into the summarizer's instructions as `newCustomInstructions`. Measured at `70b64982` on 2026-08-31.

The vendor reference documents no event-specific `PreCompact` payload field, so the script reads `trigger` and routes on it rather than trusting the matcher, since a registration widened to `*` would send an automatic compaction down the blocking path.

- An absent value takes the manual path, the conservative reading
- The `hook_event_name` test ahead of it keeps the hook silent under `src/hooks/guard.test.ts`'s inert payload, which names a tool and no event

### The once-per-session marker

Dedupe writes a marker under `.canon/tmp/hooks/precompact-handoff/` keyed on `session_id`, as three other hooks do, and on the manual path it is load-bearing. The first `/compact` asks and the second proceeds, since a hook that never stops blocking refuses every one.

The hook asks and does not enforce, since nothing it can read tells it whether a map was written or worth writing.

- The automatic path reads and writes no marker, and the `trigger` branch sits ahead of the marker logic so an unrequested compaction never spends the refusal a typed `/compact` is owed
- The marker write fails open, with `mkdir` and the truncation exiting 0 when the root refuses them, because a hook blocking without recording the block strands the session
- The three hooks whose markers only dedupe advice can leave that unchecked, and this one cannot
- Its test drives the branch off a fixture root at mode `0555`, so the case fails under a permission the mode does not stop

### Testing the handoff

`ActingCase` carries an optional `stream` and `code`, so a hook reaching the session by blocking is asserted on stderr with exit 2 rather than the default stdout-with-exit-0 shape. Five cases sit outside the directory walk.

- An automatic compaction instructing rather than blocking, and the same instruction on a second automatic firing
- A payload naming no trigger taking the manual path
- A manual compaction blocking once and clearing
- Stdout staying empty under a block

### What the client does with a blocked automatic compaction

This reading comes from the shipped binary, which is bun-compiled and carries its own source, so `grep -a` reads the code. It diverges from the vendor page. Measured at client version `2.1.251` on 2026-08-31.

- A block does hold on `auto`. The runner passes the trigger as the matcher's match query and returns `blockedBy` whenever a hook exits 2, and both compaction paths honor it.
- The newer path returns `hookBlocked` and the older throws an error converted to a `hook_blocked` outcome. Neither errors out, so the turn carries on with its context.
- The client does not tell the session. The newer path logs `blockedBy` to debug, and the older path's notifier suppresses the warning for this trigger, then throws an error the caller drops.
- Exit-2 stderr reaching the model is a property of the manual path alone, where the throw reaches the command that renders it
- Exit-0 stdout stays open on both triggers, collected per invocation into `newCustomInstructions` and merged into the summarizer's instructions, since the runner builds the list from that single call

### Why a count cannot bound the automatic trigger

A precompute pass runs the same hook ahead of the real compaction with an identical payload, so nothing separates the two. A refused pass removes its own record, which frees the slot and lets it arm again next turn with no backoff, so a per-session count is drained by firings the session never sees.

- Elapsed time fails too, since the precompute arms ahead of the threshold and any window it opens covers the firing that matters
- Exit-0 stdout needs no bound, since nothing on the automatic path depends on one
- A driven run confirmed it. A probe hook on `auto` refused the first firing, logged as `Reactive compact blocked by PreCompact hook`.
- Four seconds later the written marker let the compaction run from 81,057 tokens to 1,928, with nothing reaching the session, and that immediate retry is the second way a per-session count is spent

The operator's `autoCompactWindow`, covered in `canon/context/development/hooks/settings.md`, decides whether a compaction happens at all, where the hook decides only what the summarizer is told when one does.

### The silent turn hook

`silent-turn.sh` registers on `Stop` with no `matcher` field, since the event carries no `tool_name`. It ships through the seed on the capability-seeding criterion in `canon/context/tooling/seeds.md`, because the defect it reports is as real in a target as here and its detection reads no toolkit-specific path.

- `last_assistant_message` sits on the `Stop` payload, a field neither vendor page names, and carries the closing text with no lag, so the hook reads it there rather than from `transcript_path`
- `transcript_path` lags in both directions for roughly two seconds after `Stop`, but every `Write` and `Edit` call is already in the file, so the hook reads paths from there with no retry
- The payload's `prompt_id` matches the `promptId` stamped on that turn's first entry and its tool-result echoes, so the hook takes every line from the first match on
- `Read` carries `input.file_path` like `Write` and `Edit`, so the filter tests the tool's `name` rather than the field's presence

### Blocking once

The block-once guarantee rests on `stop_hook_active` alone, read fresh on every firing rather than backed by a marker file. A forced continuation's `Stop` event carries `stop_hook_active: true` and passes clean, and the blocking reason reaches the model as text it acts on.

- It blocks rather than advising, as other seeded hooks do, because exit-0 stdout never reaches the session on `Stop`, and a probe line was never quoted back. Measured at `f47f8f02` on 2026-09-03.
- A missing input exits quiet on every guard from `transcript_path` down, so a transient miss never reports as the defect this hook catches
- A payload missing `transcript_path`, `prompt_id`, or a `promptId` match is malformed rather than stale, since reading `last_assistant_message` off the payload removes the lag

### Shared basenames

Two written paths sharing a basename would let one mention clear both, since the ordinary check tests only the basename. The hook counts basenames across the turn's written paths first, and a shared one falls back to matching the full path.

The count pipes basenames through `sort | uniq -d` rather than an associative array, since macOS ships bash 3.2 and `declare -A` fails there on every turn. A scan in `src/hooks/guard.test.ts` fails on any bash-4-only construct in either hook tree.

### The reply link hook

`reply-links.sh` registers on `Stop` beside `silent-turn.sh` and blocks a closing reply whose markdown links name a file not on disk. The desktop app opens such a link as "Couldn't read this file", and the output rule already asks for full paths, so a failing check replaces a second reminder. It ships through the seed on the same criterion.

- The work sits in `canon hooks reply-links`, which reads the reply on stdin and exits 1 on findings, since a verb run by hand reports failure as 1 and the hook exit table reserves 2 for a block
- The wrapper maps that to the exit 2 a block needs and reads the `--json` record, not the exit code, since a binary predating the verb exits 1 on an unknown command, as a finding does

### What the reply link hook resolves

A link resolves against the main worktree root, since the output rule says the editor is rooted there. A relative link to a file existing only inside a linked worktree therefore reads as missing, which is the report the rule asks for.

- An absolute link into `.claude/worktrees/<name>/.canon/` is reported with the main-root path when that file exists, because the records folders are gitignored and a worktree never holds them
- Placeholders, globs, URLs, anchors, and anything inside a code span or fence are skipped
- A `:42`, `:42-50`, or `#L42` tail is stripped first, and a malformed percent escape is skipped rather than thrown on
- The pre-filter is a shell test for `](` on the raw payload ahead of any `jq` spawn, so a link-free reply costs a bounded read and 2 ms (2026-10-17), and the CLI starts only for a link

### Failing to measure

The hook reports a check it could not run and never passes it as clean, but it exits 1 for that rather than 2. Exit 2 forces a continuation, and a hook unable to read `stop_hook_active` would then block every continuation after it. Exit 1 puts the text in front of the operator and leaves the session alone.

- A missing `jq`, an unreadable payload, a `cwd` missing from disk, no resolvable runner, and a verb answering no record each take this path
- Only the closing message is checked, because the payload carries `last_assistant_message` and nothing earlier, so a bad link mid-turn passes
- The bad reply is already on screen when the hook fires, so the fix arrives as a follow-up
- Reference-style links and backticked path-like tokens are not read, and widening to the latter waits on a week of blocks showing how often an illustrative path would false-positive

### Copies and registration

The seeded copy resolves an installed `canon` alone and names `bun add -g @erclx/canon` when none is on `PATH`. The toolkit copy runs the checkout's `src/cli.ts` first, the order `standards-audit.sh` documents, so the hook and the build under test read one verb.

- That makes a second intentional pair beside the audit hook, and the hand diff in `canon/context/development/hooks/overview.md` skips both
- A target installed before this hook shipped keeps its `hooks` block, which sync never rewrites, so the seeded script lands there unregistered
- `src/hooks/guard.test.ts` stubs `canon` and `bun` to answer a record, covering a passing continuation, a link-free reply never starting the stub, a clean record, and the two reporting paths
- `src/hooks/reply-links.test.ts` spawns the real verb from a linked worktree
- Whether the desktop app resolves a relative link against the main root or the session's directory comes from the output rule and is not yet confirmed in a driven session

## Gotchas

### Driving a compaction spike

Drive a compaction spike in a scratch project outside this checkout, since a fixture under this root inherits this project's instruction file through the ancestor chain. `CLAUDE_CODE_AUTO_COMPACT_WINDOW` takes an absolute token count clamped to 100K to 1M, so 100K is the smallest window a session can be driven across.

- A single prompt followed by tool calls bails with `no assistant messages in summarize set` before hooks run, so the run needs a turn per file through `claude -p -c`
- Repeated filler text tokenizes far below its byte count, so a fixture built from one repeated sentence peaks at roughly half the intended window
- A project holding no settings file registers no hooks and reports only `Found 0 total hooks in registry`, which reads the same as a hook that ran and did nothing
- The outer session's classifier refuses `--dangerously-skip-permissions` and `bypassPermissions` for a nested session that writes files, where `--permission-mode acceptEdits` runs clean
- Move the nested session's cwd with it via `env --chdir=<dir> claude -p ...` as one plain command, since `--add-dir` alone leaves it writing through the outer project's scratch-guard hook
