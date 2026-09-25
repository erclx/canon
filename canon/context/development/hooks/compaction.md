---
title: Compaction and turn hooks
description: The PreCompact handoff hook and its manual and automatic channels, what the client does with a blocked automatic compaction, the silent turn hook on Stop, and driving a compaction spike
---

# Compaction and turn hooks

## The compaction handoff

`precompact-handoff.sh` is toolkit-only and sits on an event carrying no tool. It registers on `PreCompact` under both matchers, refuses the first `/compact` of a session with exit 2, and names the `session-compact` skill in the stderr text that exit 2 turns into the blocking reason. One sentence sends a session holding `canon:role-orchestrator` to its own handoff runbook, since the hook cannot tell that role from a plain session. On an automatic compaction it exits 0 and writes to stdout instead, so it blocks on `manual` and instructs on `auto`.

Each trigger gets the channel that reaches the session on it. The vendor's `additionalContext` field is not offered for this event, so on `manual` the stderr text exit 2 turns into a blocking reason is the channel. On `auto` a block stops a compaction and tells nobody, which the client reading below confirms, so exit-0 stdout is the channel instead, collected as `newCustomInstructions` and merged into what the summarizer is given. Measured at `70b64982` on 2026-08-31.

The once-per-session marker stays on `manual` alone, since a precompute pass drains anything counted per session on `auto`. The seed copy is withheld, since a scaffolded target without the plugin would meet a blocked `/compact` naming a skill it does not carry.

The matcher separates a manual compaction from an automatic one. The vendor reference documents no event-specific payload field for `PreCompact`, so the script reads `trigger` and routes on it rather than trusting the matcher alone, since a registration widened to `*` would otherwise send an automatic compaction down the blocking path. An absent value takes the manual path, the conservative reading of a payload naming no trigger. The `hook_event_name` test ahead of it is what keeps the hook silent under `hooks-guard.test.ts`'s inert payload, which names a tool and no event.

### The once-per-session marker

Dedupe writes a marker under `.canon/tmp/hooks/precompact-handoff/` keyed on `session_id`, the way three other hooks here do, and on the manual path it is load-bearing rather than a courtesy. A hook that never stops blocking refuses every `/compact` the session will ever take. The first asks and the second proceeds, so a session that ignores the message is not asked twice. The hook asks and does not enforce, since nothing it can read tells it whether a map was written or was worth writing.

The automatic path reads and writes no marker at all, which is why the branch on `trigger` sits ahead of the marker logic rather than inside it: a compaction the session did not ask for never spends the one refusal a typed `/compact` is owed.

The marker write fails open. Both the `mkdir` and the truncation exit 0 rather than block when the project root refuses them, because a hook that blocks without recording the block strands the session on every compaction it will ever take, where failing open costs one handoff nobody was asked for. The three hooks whose markers only dedupe advice can leave that unchecked, and this one cannot. Its test drives the branch off a fixture root at mode `0555`, which reads the same as the writable case in every other respect, so the case fails under a permission the mode does not stop rather than passing for a reason it is not about.

`ActingCase` carries an optional `stream` and `code`, so a hook reaching the session by blocking is asserted on stderr with exit 2 rather than the default stdout-with-exit-0 shape the guard test otherwise assumes. Five further cases sit outside the directory walk: an automatic compaction instructing rather than blocking, the same instruction arriving on a second automatic firing, a payload naming no trigger taking the manual path, a manual compaction blocking once and clearing, and stdout staying empty under a block.

### What the client does with a blocked automatic compaction

This reading comes from the shipped binary, which is bun-compiled and carries its own source, so `grep -a` over it reads the code rather than a symbol table. What it shows diverges from the vendor page's documented account of the event. Measured at client version `2.1.251` on 2026-08-31.

A block does hold on `auto`. The runner passes the trigger as the matcher's match query and returns a `blockedBy` field whenever a hook exits 2, and both compaction paths honor it, the newer one returning `hookBlocked` and the older one throwing an error its caller converts to a `hook_blocked` outcome. Neither errors out, so the turn carries on with the context it already had.

What the client does not do is tell the session. The newer path writes `blockedBy` to the debug log and returns. The older path calls its shared notifier with the auto flag set, which suppresses the warning for exactly this trigger, and it then throws an error whose text the auto caller matches on its prefix and drops. Exit-2 stderr becoming a blocking reason the model reads is a property of the manual path alone, where the throw reaches the command that renders it.

Exit-0 stdout is the channel that stays open on both triggers. The runner collects the output of every hook that succeeded without blocking into `newCustomInstructions`, and each path merges that into the instructions the summarizer is given. It is per invocation rather than accumulated, since the runner builds the list from the results of that single call and nothing outside it keeps them.

### Why a count cannot bound the automatic trigger

A precompute pass runs the same hook ahead of the real compaction with a payload identical to it, and every field is common to both, so nothing in it separates the two. When that pass is refused it removes its own record rather than marking it failed, which frees the slot and lets it arm again on the next turn with no backoff. Anything counted per session is therefore drained by firings the session never sees.

Elapsed time fails for a nearer reason, since the precompute arms ahead of the threshold and any window it opens covers the firing that matters. Exit-0 stdout needs no bound at all, since nothing on the automatic path depends on one.

A driven run in a scratch project confirmed the reading. A probe hook registered on `auto` refused the first firing with exit 2 and wrote an instruction to stdout on every later one. The refusal held, logged as `Reactive compact blocked by PreCompact hook`, and the same session fired the hook again four seconds later, when the written marker let the compaction run from 81,057 tokens down to 1,928. Nothing reached the session in the transcript or anywhere else.

The immediate retry, alongside the precompute drain, is the second way a per-session count is spent.

The operator's own `autoCompactWindow`, covered in `canon/context/development/hooks/settings.md`, is a lever this hook is not and does not reach. It decides whether a compaction happens at all, where the hook decides only what the summarizer is told when one does.

## The silent turn hook

`silent-turn.sh` registers on `Stop` with no `matcher` field at all, since the event carries no `tool_name` to filter on. It ships through the seed rather than staying toolkit-only, on the capability-seeding criterion in `canon/context/tooling/seeds.md`: the defect it reports is exactly as real in a scaffolded target as it is here, and nothing in its detection logic reads a toolkit-specific path.

`last_assistant_message` sits directly on the `Stop` payload, a field neither vendor page names, and carries the turn's closing text with no lag, so the hook reads it straight off the payload rather than parsing `transcript_path` for the same text. `transcript_path` lags in both directions, whether a turn wrote files or wrote none, leaving the file missing its own closing entry for roughly two seconds after `Stop` fires. Every `Write` and `Edit` tool call, by contrast, is already in the file the moment `Stop` fires, so the hook reads paths from there with no retry.

Bounding the read to one turn needs no heuristic. The payload's `prompt_id` matches, byte for byte, the `promptId` field the transcript stamps on that turn's initiating entry and on the tool-result echoes belonging to it, so the hook takes every line from the first such match to end of file. `Read` carries `input.file_path` the same way `Write` and `Edit` do, which is why the filter tests the tool's `name` rather than the field's presence.

### Blocking once

The block-once guarantee rests on `stop_hook_active` alone, read fresh on every firing rather than backed by a session-keyed marker file. A forced continuation's `Stop` event carries `stop_hook_active: true` and passes clean. The blocking reason reaches the model as text it reasons about and acts on, unlike the suppressed notice `precompact-handoff.sh` meets on its own `auto` trigger.

It blocks rather than advising the way every other seeded hook does, because exit-0 stdout never reaches the session on `Stop`. A probe hook wrote a distinctive line to stdout after a turn withheld a filename, and a second turn asked to quote anything a hook had told it quoted nothing. Advising was the alternative, costing a scaffolded target nothing it would notice, and it lost anyway, since a channel nobody reads is not a report. Measured at `f47f8f02` on 2026-09-03.

A missing input exits quiet rather than blocking, on every guard from `transcript_path` down to the boundary match, so a transient miss never reports as though it were the defect this hook exists to catch. A payload missing `transcript_path`, `prompt_id`, or a `promptId` match is malformed rather than stale, since reading `last_assistant_message` off the payload removes the lag this design would otherwise carry.

Two written paths sharing a basename would otherwise let one mention clear both, since the ordinary check tests only the basename. The hook counts basenames across the turn's written paths first, and a basename shared by more than one falls back to matching the full path instead. The count pipes the basenames through `sort | uniq -d` rather than keeping an associative array, since macOS ships bash 3.2 and `declare -A` fails there on every turn. A scan in `src/hooks-guard.test.ts` fails on any bash-4-only construct in either hook tree.

## Gotchas

### Driving a compaction spike

Drive a compaction spike in a scratch project outside this checkout, since a fixture under this root inherits this project's own instruction file through the ancestor chain. `CLAUDE_CODE_AUTO_COMPACT_WINDOW` takes an absolute token count clamped to the range 100K to 1M, so 100K is the smallest window a session can be driven across.

- A single prompt followed by tool calls bails with `no assistant messages in summarize set` before hooks run, so the run needs a turn per file through `claude -p -c`
- Repeated filler text tokenizes far below its byte count, so a fixture built from one repeated sentence peaks at roughly half the intended window
- A project holding no settings file registers no hooks and reports only `Found 0 total hooks in registry`, which reads the same as a hook that ran and did nothing
- The outer session's classifier refuses `--dangerously-skip-permissions` and `--permission-mode bypassPermissions` for a nested session that writes files, where `--permission-mode acceptEdits` runs clean
- Move the nested session's cwd with it via `env --chdir=<dir> claude -p ...` as one plain command, since `--add-dir` alone leaves it writing through the outer project's own scratch-guard hook
