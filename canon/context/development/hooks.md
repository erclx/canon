---
title: Hooks
description: Where shell scripts live, the Claude Code hook families and their stdin guard, the three session budget settings the repository records without setting, and the husky hooks with their POSIX sh constraints
---

# Hooks

## Shell scripts

All `.sh` files live under `scripts/`, except Claude Code hooks, which live in `.claude/hooks/`. Do not place shell scripts anywhere else.

## Claude hooks

`.claude/hooks/` holds the toolkit's own Claude Code hooks, wired through `.claude/settings.json`. Eight carry the same names as the hooks `canon claude init` seeds from `tooling/claude/seeds/.claude/hooks/`, covered in `canon/context/claude-plugin/cli.md`: `index-reminder.sh`, `memory-index.sh`, `path-form.sh`, `pr-create-log.sh`, `scratch-guard.sh`, `silent-turn.sh`, `standards-audit.sh`, and `tasks-index.sh`. Seven stay byte-identical to their seeded copies, checked by a hand diff rather than assumed. `standards-audit.sh` is the one pair that diverges on purpose, covered below.

Five of the eight, `index-reminder.sh`, `memory-index.sh`, `scratch-guard.sh`, `standards-audit.sh`, and `tasks-index.sh`, match on the edited file's own path rather than resolving a root, and each matches both the current `.canon/` root and the retired `.claude/` root, spelling the scratch folder `tmp` under the first and `.tmp` under the second. A hook fixed at one spelling alone stops matching the moment a target sits on the other, and the index goes stale with nothing said.

### The stdin guard

Every hook that reads a payload opens with `IFS= read -r -d '' -t 2 input` and exits non-zero with a usage line on an empty payload. Under Claude Code the payload arrives and stdin closes, so the read returns at once and the bound is never paid. An unbounded `cat` instead blocks forever when a caller runs the hook by hand or from a tool call whose stdin is an open socket, which holds the background task open and with it the session. Only `bare-flag-repair.sh` is exempt, and it is exempt because it reads no payload.

`read` rather than `timeout cat`, because macOS ships no `timeout` and a missing one empties every payload and refuses every legitimate call. The obvious descriptor test `[ -t 0 ]` is the wrong one, since it reports false on an open socket, which is where the hang came from. Nothing compares the two hook trees, so a guard landing in one leaves the other broken with every stage still passing. `src/hooks-guard.test.ts` walks both directories rather than a fixed list, asserting per file a bounded refusal, silence on a payload the hook ignores, and the real verdict on one it acts on.

The acting payload is what a mangled read fails. A corrupted payload reaches the same quiet exit as one naming a tool the hook filters out, so a test built on the filtered case passes whatever the read did to the bytes. Each hook therefore carries a payload reaching the branch that does its work, paired with a string only that branch emits, and a hook added without one fails rather than passing on the refusal alone.

The two index hooks run with `canon` dropped from `PATH`, which pins them to the branch reporting a stale index instead of leaving the assertion to depend on whether the CLI is installed.

### What the audit hook could not read

Both copies of `standards-audit.sh` depend on something outside themselves, and each reports the dependency it failed to resolve rather than exiting clean. A pass on a file nobody checked reads the same as a pass on a file carrying no violation, and the report is what separates them.

Neither copy parses a standard directly. Both read a `markdown audit --json` record, so both reach the defect by the same two routes: resolving no runner reports that nothing ran, and a record naming an empty shipped ban set reports a check narrowed to what the verb could measure. The verb returns that field either way, and reading the findings beside it alone is what would let a narrowed check report a pass.

The seed differs from the toolkit copy in what it can resolve rather than in what it reads. It reaches an installed binary alone, since a scaffolded project has no checkout to run the CLI out of, and it names `bun add -g @erclx/canon` when the machine carries none. A non-zero exit is the blunter alternative and carries more than a PostToolUse event warrants.

`hooks-guard.test.ts` covers all four branches, and each case stubs a runner or withholds one, so the verdict comes from the fixture rather than from whichever build the machine carries.

### The dev command reminder

`dev-command-reminder.sh` is toolkit-only and has no seed counterpart. It fires once per session when a `Bash` command runs `check`, `format`, or `check:install`, and points the agent at this domain. The matcher tests the command string rather than the tool name, because `Bash` is the highest-frequency tool in a session and a loose matcher would add latency to every shell call. It stays silent on `check:types` and `test`, which need no reminder.

The filter, the match, and the session id come out of one `jq` pass, so the hot path costs a single process and the second `jq` runs only when the hook actually fires. Splitting the fields through `@tsv` instead looks equivalent and is not: `@tsv` escapes a newline to a literal `\n`, which puts a backslash where the matcher expects whitespace or end of string, and every multi-line command stops matching. A run with no `session_id` exits rather than sharing one marker file, since per-session dedupe needs a real id.

The `entry` the hook names is guarded on existing, so a path this repository does not carry disables the reminder in silence rather than failing it. That target is `canon/context/development/index.md`, the catalog naming every sibling, because the gotchas the reminder exists to surface sit in several of them and no one file holds the set.

### The path form hook

`path-form.sh` shares the `Edit|Write|MultiEdit` matcher and hands back the absolute form of a path written from a linked worktree, so a session prefers that form over computing it. `governance/rules/core/015-output.md` keeps the instruction as a self-sufficient fallback rather than a branch the hook replaced, since the hook reaches a project only through `tooling/claude/seeds/` at scaffold time while the rule reaches one through `canon gov sync`, and a target that synced governance without ever scaffolding through the seed would otherwise read a line naming a source it does not have. It reads the worktree branch off `file_path` itself, a `*/.claude/worktrees/*` segment, rather than shelling out to `git rev-parse`, since that call would answer for whatever directory the hook's own process happens to run in rather than the worktree the write came from. `tasks-index.sh` and `memory-index.sh` already derive their main root the same way, off a path suffix rather than the session. It exits quietly on a path with no such segment and resolves `realpath` on one that has it.

The entrypoint branch of the same rule, bare against a `file://` link, stayed prose rather than moving into this hook. Claude Code's own hook documentation lists `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, and `CLAUDE_PLUGIN_DATA` among the environment a hook subprocess inherits and does not list `CLAUDE_CODE_ENTRYPOINT`, and it documents `OTEL_*` variables as deliberately stripped from every spawned subprocess, so the same curation could apply to a variable it never names as passed through. A live spike inside a running session could not confirm either way, since `.claude/settings.json` loads once at session start and a hook added mid-session never fires until the next one begins.

The companion outcome, reporting a turn that wrote files and named none of them, shipped as `silent-turn.sh`, covered below.

### The compaction handoff

`precompact-handoff.sh` is the first hook here on an event carrying no tool, and it is toolkit-only. It registers on `PreCompact` under both matchers, refuses the first `/compact` of a session with exit 2, and names the `session-map` skill in the stderr text that exit 2 turns into the blocking reason. On an automatic compaction it exits 0 and writes to stdout instead, so it blocks on `manual` and instructs on `auto`.

Each trigger gets the channel that reaches the session on it. The vendor's `additionalContext` field is not offered for this event, so on `manual` the stderr text exit 2 turns into a blocking reason is the channel. On `auto` a block stops a compaction and tells nobody, which the client reading below confirms, so exit-0 stdout is the channel instead, collected as `newCustomInstructions` and merged into what the summarizer is given. The once-per-session marker stays on `manual` alone, since a precompute pass drains anything counted per session on `auto`. The seed copy is withheld, since a scaffolded target without the plugin would meet a blocked `/compact` naming a skill it does not carry. Measured at `70b64982` on 2026-08-31.

The matcher separates a manual compaction from an automatic one. The vendor reference documents no event-specific payload field for `PreCompact`, so the script reads `trigger` and routes on it rather than trusting the matcher alone: a registration widened to `*` would otherwise send an automatic compaction down the blocking path. An absent value takes the manual path, the conservative reading of a payload naming no trigger. The `hook_event_name` test ahead of it is what keeps the hook silent under `hooks-guard.test.ts`'s inert payload, which names a tool and no event.

Dedupe writes a marker under `.canon/tmp/hooks/precompact-handoff/` keyed on `session_id`, the way three other hooks here do, and it is load-bearing rather than a courtesy on the manual path: a hook that never stops blocking refuses every `/compact` the session will ever take. The first asks and the second proceeds, so a session that ignores the message is not asked twice. The hook asks and does not enforce, since nothing it can read tells it whether a map was written or was worth writing.

The automatic path reads and writes no marker at all, which is why the branch on `trigger` sits ahead of the marker logic rather than inside it: a compaction the session did not ask for never spends the one refusal a typed `/compact` is owed.

The marker write fails open. Both the `mkdir` and the truncation exit 0 rather than block when the project root refuses them, because a hook that blocks without recording the block strands the session on every compaction it will ever take, where failing open costs one handoff nobody was asked for. The three hooks whose markers only dedupe advice can leave that unchecked, and this one cannot. Its test drives the branch off a fixture root at mode `0555`, which reads the same as the writable case in every other respect, so the case fails under a permission the mode does not stop rather than passing for a reason it is not about.

`ActingCase` carries an optional `stream` and `code`, so a hook reaching the session by blocking is asserted on stderr with exit 2 rather than the default stdout-with-exit-0 shape the guard test otherwise assumes. Five further cases sit outside the directory walk: an automatic compaction instructing rather than blocking, the same instruction arriving on a second automatic firing, a payload naming no trigger taking the manual path, a manual compaction blocking once and clearing, and stdout staying empty under a block.

### What the client does with a blocked automatic compaction

Read from the shipped binary at `2.1.251`, a bun-compiled executable carrying its own source, so `grep -a` over it reads the code rather than a symbol table. This diverges from the vendor page's documented account of the event.

A block does hold on `auto`. The runner passes the trigger as the matcher's match query and returns a `blockedBy` field whenever a hook exits 2, and both compaction paths honor it, the newer one returning `hookBlocked` and the older one throwing an error its caller converts to a `hook_blocked` outcome. Neither errors out, so the turn carries on with the context it already had.

What the client does not do is tell the session. The newer path writes `blockedBy` to the debug log and returns. The older path calls its shared notifier with the auto flag set, which suppresses the warning for exactly this trigger, and it then throws an error whose text the auto caller matches on its prefix and drops. Exit-2 stderr becoming a blocking reason the model reads is a property of the manual path alone, where the throw reaches the command that renders it.

Exit-0 stdout is the channel that stays open on both triggers. The runner collects the output of every hook that succeeded without blocking into `newCustomInstructions`, and each path merges that into the instructions the summarizer is given. It is per invocation rather than accumulated, since the runner builds the list from the results of that single call and nothing outside it keeps them.

A count is the wrong bound on this trigger. A precompute pass runs the same hook ahead of the real compaction with a payload identical to it, and every field is common to both, so nothing in it separates the two. When that pass is refused it removes its own record rather than marking it failed, which frees the slot and lets it arm again on the next turn with no backoff, so anything counted per session is drained by firings the session never sees. Elapsed time fails for a nearer reason too, since the precompute arms ahead of the threshold and any window it opens covers the firing that matters. Exit-0 stdout needs no bound at all, since nothing on the automatic path depends on one.

Measured at client version `2.1.251` on 2026-08-31.

### What the driven run showed

Confirmed empirically in a scratch project outside this checkout, since a fixture under this root inherits this project's own instruction file through the ancestor chain. `CLAUDE_CODE_AUTO_COMPACT_WINDOW` takes an absolute token count clamped to the range 100K to 1M, so 100K is the smallest window a session can be driven across for a test like this.

A probe hook registered on `auto`, logging every firing, refusing the first with exit 2, and writing an instruction to stdout on every later one, confirmed the reading above. The refusal held on the first firing, logged as `Reactive compact blocked by PreCompact hook`, and the same session fired the hook again four seconds later. By then the dedupe marker was written, so the compaction ran and completed at 81,057 tokens down to 1,928. Nothing reached the session in the transcript or anywhere else, confirming the client suppresses the notification on this trigger and drops the text. The immediate retry, alongside the precompute drain described above, is the second way a per-session count is spent.

Driving a spike like this has its own obstacles. A single prompt followed by tool calls bails with `no assistant messages in summarize set` before hooks run, so the run needs a turn per file through `claude -p -c`. Repeated filler text tokenizes far below its byte count, so a fixture built from one repeated sentence peaks at roughly half the intended window. A project holding no settings file registers no hooks and reports only `Found 0 total hooks in registry`, which reads the same as a hook that ran and did nothing. Driving a nested session to write files adds a further obstacle: `--dangerously-skip-permissions` and `--permission-mode bypassPermissions` are both refused outright by the outer session's own classifier, where `--permission-mode acceptEdits` runs clean, and the nested session's cwd has to move with it via `env --chdir=<dir> claude -p ...` as one plain command, since launching with `--add-dir` alone leaves it writing through the outer project's own scratch-guard hook instead of the scratch project's.

The operator's own `autoCompactWindow`, recorded below, is a lever this hook is not and does not reach. It decides whether a compaction happens at all, where the hook decides only what the summarizer is told when one does.

### The silent turn hook

`silent-turn.sh` registers on `Stop` with no `matcher` field at all, since the event carries no `tool_name` to filter on. It ships through the seed rather than staying toolkit-only, on the capability-seeding criterion in `canon/context/tooling.md`: the defect it reports is exactly as real in a scaffolded target as it is here, and nothing in its detection logic reads a toolkit-specific path.

`last_assistant_message` sits directly on the `Stop` payload, a field neither vendor page names, and carries the turn's closing text with no lag, so the hook reads it straight off the payload rather than parsing `transcript_path` for the same text. `transcript_path` lags in both directions, whether a turn wrote files or wrote none, leaving the file missing its own closing entry for roughly two seconds after `Stop` fires. Every `Write` and `Edit` tool call, by contrast, is already in the file the moment `Stop` fires, so the hook reads paths from there with no retry.

Bounding the read to one turn needs no heuristic. The payload's `prompt_id` matches, byte for byte, the `promptId` field the transcript stamps on that turn's initiating entry and on the tool-result echoes belonging to it, so the hook takes every line from the first such match to end of file. `Read` carries `input.file_path` the same way `Write` and `Edit` do, which is why the filter tests the tool's `name` rather than the field's presence.

The block-once guarantee rests on `stop_hook_active` alone, read fresh on every firing rather than backed by a session-keyed marker file. A forced continuation's `Stop` event carries `stop_hook_active: true` and passes clean. The blocking reason reaches the model as text it reasons about and acts on, unlike the suppressed notice `precompact-handoff.sh` meets on its own `auto` trigger, since the advisory channel this hook could otherwise use reaches nobody on `Stop`.

It blocks rather than advising the way every other seeded hook does, because a driven spike found exit-0 stdout never reaches the session on `Stop`: a probe hook wrote a distinctive line to stdout after a turn withheld a filename, and a second turn asked to quote anything a hook had told it quoted nothing. Advising was the alternative, costing a scaffolded target nothing it would notice, and it lost anyway, since a channel nobody reads is not a report. Measured at `f47f8f02` on 2026-09-03.

A missing input exits quiet rather than blocking, on every guard from `transcript_path` down to the boundary match, so a transient miss never reports as though it were the defect this hook exists to catch. A payload missing `transcript_path`, `prompt_id`, or a `promptId` match is malformed rather than stale, since reading `last_assistant_message` off the payload rather than off `transcript_path` removes the lag this design would otherwise carry.

Two written paths sharing a basename would otherwise let one mention clear both, since the ordinary check tests only the basename. The hook counts basenames across the turn's written paths first, and a basename shared by more than one falls back to matching the full path instead.

### The bare flag repair

`bare-flag-repair.sh` shares the `Bash` matcher and clears `core.bare` when worktree entry has left it set. Git refuses every operation while the flag is on, which puts `post-checkout` and the rest of the husky hooks out of reach, so a tool call is the only event that still fires ahead of the command that would fail. `canon gate run` keeps its own call to the same repair through `scripts/core/repair-bare-flag.sh`, but a planning or review session reads git constantly and runs the suite never, so the suite alone leaves such a session broken for its whole length.

The hook writes to the shared git config as a side effect of an unrelated `Bash` call, so it announces the repair through `additionalContext` rather than clearing the flag silently. It sources `repair_bare_flag` from `scripts/lib/worktree.sh` rather than restating the predicate, and stubs `log_warn` before the source so the library warning lands in a variable instead of on stdout, where an unframed line corrupts the hook protocol.

The flag read comes first and costs one process, ahead of the payload parse, because every invocation but a handful stops there. That measured at roughly 2ms against 3.6ms for `dev-command-reminder.sh` on the same matcher, so the two stay separate hooks.

### The pull-request creation log

`pr-create-log.sh` is the first hook registered on `PostToolUse` for the `Bash` matcher, where `dev-command-reminder.sh` and `bare-flag-repair.sh` sit on `PreToolUse` instead. It filters for a command containing `gh pr create` rather than narrowing at the matcher, the same shape those two take for testing the command string over the tool name. On a match it greps `tool_response.stdout` for the pull request URL `gh pr create` prints on success, which is what tells a creation apart from a failed or refused call, then appends a line to `.canon/tmp/pr/log/log.md` and hands back an `additionalContext` reminder naming the channel obligation `role-worker` states. The hook cannot know whether a session sent the announcement, only that a pull request now exists to announce, so the log is a denominator for the next wave's miss rate rather than a record of the send itself.

The log resolves off `CLAUDE_PROJECT_DIR`, and that value is the session's own worktree rather than the main root, so a naive read would write a wave's denominator into a folder that dies the moment the worktree it was built in gets reclaimed. The hook strips a trailing `.claude/worktrees/*` segment before writing, the way `tasks-index.sh` and `memory-index.sh` already derive their main root off a path suffix.

### The unattended agent guard

`unattended-agent-guard.sh` is toolkit-only and carries a `canon-no-seed:` marker rather than shipping through `tooling/claude/seeds/.claude/hooks/`, holding the seeded copy back until the local hook is proven. It registers on `PreToolUse` for `Agent|Task`, the second name covering an installed build that still emits the tool's pre-rename name, and reads `tool_name` off the payload the way every guarded hook here does.

It denies every `Agent` call from an unattended session rather than coordinating the write, since nothing in this tree serializes a session against its own fork, and a background worker that forks an agent to build a plan can otherwise keep writing the same files by hand while the fork is still running. The payload's own `tool_input.subagent_type` and `tool_input.isolation` fields stay unread, so the hook cannot separate a safe `isolation: worktree` fork from a risky same-directory one and denies every `Agent` call it reaches while unattended, a deliberate blanket reading rather than an oversight.

The deny condition is `CLAUDE_CODE_SESSION_ATTENDED` read as exactly `0`, the one value measurements have actually confirmed. It reads `0` in a background session, and unset in an interactive session on the desktop app's Code tab, `CLAUDE_CODE_ENTRYPOINT=claude-desktop`. No interactive terminal session has been measured. A session where the variable holds anything other than `0`, unset or unmeasured included, is one the hook cannot classify, and it lets the call through silently rather than blocking a session the reading never covered or reporting a pass it has no basis for. A terminal interactive session reading `0` would collide with that silence, since nothing else distinguishes it from a background session, and closing that gap needs the still-unmeasured reading rather than a guess.

`src/hooks-guard.test.ts` covers the denial with `CLAUDE_CODE_SESSION_ATTENDED=0` and the tool matcher on both `Agent` and `Task`, and covers the classification boundary with the variable unset and with a non-zero value, each expected to pass through silent. Because the hook reads an environment variable rather than payload alone, the shared `run` helper takes an `env` override that deletes or sets a key on the spawned process rather than inheriting whatever the test runner happens to carry. The hook exists only in `.claude/hooks/`, so the directory walk that asserts an acting case per file never reaches a seed copy to test, and the classification-boundary block runs once directly against that path rather than looping over both trees.

### Silencing a hook discards the guarantee it carries

A hook that is the only enforcer of a rule cannot discard its command's output, because the reflexive `>/dev/null 2>&1 || exit 0` makes the documented guarantee false. The task index hook suppressed a regen failure while `standards/tasks.md` promised a missing frontmatter field surfaces on the next edit, and the folder is gitignored so `bun run check` cannot reach it and no gate stage would ever have gone red. Before silencing a hook, name the stage that catches the same failure. Where none exists, capture into a variable, exit 0 on success, and emit the error lines as `additionalContext`.

### The two hook trees drift with nothing comparing them

`.claude/hooks/` and `tooling/claude/seeds/.claude/hooks/` hold the same five scripts maintained twice, and nothing regenerates or compares them. A branch fixing one side can leave the other running the old logic, and the drift is silent because each copy is valid shell that passes every stage, so only a hand diff finds it. `standards-audit.sh` is the one pair that diverges on purpose, since the toolkit's copy runs the CLI out of the checkout where the seed reads it off PATH.

### Linting the hooks

`check:shell` lints `.claude/hooks/` alongside `scripts/`, `tooling/`, and `claude/`. It has to, because the shell stage is gated on any `.sh` change. Linting a narrower set than the gate keys on produces a stage that fires on a hook edit, inspects other directories, and reports a pass that says nothing about the file that triggered it. Keep the glob and the gate pattern in step whenever either moves.

The husky hooks are linted by a second run rather than by that glob, and the reason is under the husky section below. A file with no extension is reached by a path list and skipped by a name filter, so the two halves have to move together.

The stage's own `scope` in `src/gate/stages.ts` is the third half and it moves with them. It reads `/\.sh$|^\.husky\/|^package\.json$/`, and the `.husky` prefix is what makes a branch touching only a hook run the stage at all. Widening `check:shell` without it lints those files on a branch that happened to change a `.sh` file or the manifest and skips them otherwise, which is a gate passing by coincidence. `src/gate/stages.test.ts` asserts the three arms so the scope cannot narrow back unnoticed.

## Session budget settings

Three Claude Code settings bound what a long session costs, and they sit in this entry because `.claude/settings.json` is the same file the hooks above register in. This repository sets none of them, and `tooling/claude/seeds/.claude/settings.json` sets none of them either. Two are live in the operator's own `~/.claude/settings.json` and the third is deliberately unset, so this section is the only place the repository says so. A session reading the settings file alone would conclude all three are unconfigured and set them again, possibly to a different value.

`governance/rules/claude/576-settings.md` routes that session here, since JSON carries no pointer of its own. The rule globs `.claude/settings.json` and the seed copy at `tooling/claude/seeds/.claude/settings.json`, so editing either loads the two facts that hold in any project, being the `autoContinueAtUsageLimit` inversion and the `autoCompactWindow` cap, and a third bullet sending the reader to whatever development record their own project keeps. It names no path, since a rule reaches a target through `canon gov sync` while this entry never leaves the repository, so a citation to this file would resolve for nobody holding the rule.

Every value below was read from `https://code.claude.com/docs/en/settings-reference`, `https://code.claude.com/docs/en/model-config`, `https://code.claude.com/docs/en/cross-session-messaging`, and `https://code.claude.com/docs/en/costs` on 2026-08-28.

### autoCompactWindow

The setting fixes how full the context window gets before Claude Code compacts. It takes an absolute token count from 100K to 1M rather than a percentage, accepting a plain integer, a `k` or `M` suffix, or a bare number from 100 to 1000 read as thousands. Its documented scope is any settings file. Left unset, a session compacts at its model's context limit, and `/autocompact <value>` writes a value to the user file rather than to the project one.

The operator's user file sets it to 750000. Claude Code caps the window at the model's own context window, so a 200K session reaches the cap first and the setting changes nothing there, and the value bites only on a session running the 1M window.

The value stays in the user file rather than moving here or into the seed. A threshold that suits an orchestrator open all day is wrong for a session that opens for ten minutes, which makes it a per-operator preference rather than a project fact, and committing one machine's answer here would impose it on everyone who opens the repository.

### autoContinueAtUsageLimit

The setting makes a session wait in place and continue its task after a claude.ai usage limit resets, instead of losing where it was. It is set to `true` in the operator's user file.

The project file cannot assert it. Its documented scope is user or managed, and the precedence rules carve out one direction for this key alone: while a repository file sets it and no user, `--settings`, or managed value does, Claude Code reads the setting as off. Writing `true` into `.claude/settings.json` would therefore turn the behavior off for anyone carrying no value of their own.

The rolling five-hour usage-limit window is not readable locally. There is no `claude usage` subcommand, `/usage` is interactive, `stats-cache.json` holds daily counts rather than a rolling window, and nothing under `~/.claude/` names usage, limit, or quota. Do not rebuild that search.

### crossSessionInbound

The setting decides what a session does with a message from one of your other sessions, on an `accept`, `hold`, `refuse` ladder. Claude Code delivers an inbound message as a new turn whenever the receiving session sits idle, and that turn carries the whole context, which is what makes the key a cost lever for a dispatch loop. The vendor's own cost page names `hold` as the way to stop paying it.

This repository leaves it unset. `hold` and `refuse` are the two values that bound the cost, and both break the worker handback the orchestrator loop runs on, since a held message reaches nobody until an `accept` later applies and a refused one is dropped outright. `accept` is the third value and bounds nothing, so no value on the ladder both saves tokens and keeps the loop working.

Precedence is the reason to leave the seed alone as well. A project or local value wins over managed, `--settings`, and user values when it is stricter and is ignored when it is not, so a `hold` seeded into a scaffolded target would override that operator's own `accept` rather than yield to it.

## Husky hooks

- `pre-commit` runs `lint-staged` (prettier, cspell, shfmt, shellcheck on staged files).
- `commit-msg` runs `commitlint` against the conventional commit format.
- `pre-push` runs `bun run check`. After pushing, run `git status`. If files changed, commit the diff as `style(<scope>):` and push again.
- `post-merge` archives the task each merged pull request closed and stays silent otherwise. It is the only trigger that fires after a merge, covered in `canon/context/claude-plugin/skill-archiving.md`. It reads `ORIG_HEAD..HEAD` rather than the tip, since one pull routinely fast-forwards over several merges and reading `git log -1` would strand every task but the last.
- `post-merge` then runs `canon records push`, which backs the nine gitignored record folders to a private remote. The call sits after the archive so an unreachable remote delays no archiving, and it fires on every merge rather than on one that closed a task, since a review report and a memory entry both land on runs that close nothing.
- A checkout that never ran the one-time setup answers `no-repository` and reports nothing
- `post-merge` then runs `canon worktrees reclaim --json`, which removes the worktree and the branch behind a merged pull request so a shipped directory goes without a person remembering.
- The verb clears only what passes all three of its conditions, being a merged pull request, a clean working tree, and no live session on the directory, so an idle worker keeps its own worktree until someone retires the session.
- `CANON_SKIP_RECLAIM=1` turns the step off, named in the hook's own header beside `CANON_SKIP_UPGRADE=1` for the same reason: the header is what a person reads looking for the switch.
- The reclaim call carries no `--root` and no `cd`, unlike the two steps above it, and that is the load-bearing part rather than an oversight. Git runs a hook from the top level of the worktree the pull happened in, and `reclaimReport` reads `process.cwd()` so `verdict` refuses that directory as `current-worktree`.
- A root argument would turn the running worktree into an ordinary candidate and let a pull inside a linked worktree delete the ground under itself. The two steps above pass `--root "$root"` for the opposite reason, because the board and the records live at the main root.
- The step reads all three fields before reporting any of them, and the exit decides nothing. A run that removes one worktree and fails on another exits 1 with a directory already deleted, so a report keyed on the exit names the failure and never the removal, which is the one act in this file nothing undoes.
- A record arriving with `"reason":null` matches no quoted-string pattern, which is what lets one block separate a refusal from a removal that failed without reading the exit.
- An unreadable reading refuses every verdict rather than some of them, so the step reports the reason. `gh-missing` is the one that stays quiet with it, since a machine without `gh` answers that on every merge forever, which is the shape the records push treats `no-repository` as. The hook header carries that gap instead.
- Nothing automated tests the step itself. The sandbox drives model sessions against skills and fires no husky hook, so what stands in its place is the `--json` record under test at `src/commands/worktrees.test.ts`, the `check:shell` pass that now reaches this file, and a hand probe driving the block against each record shape.
- `post-merge` runs `canon upgrade --json` last of all, under `CANON_NON_INTERACTIVE=1` since the hook has no TTY, so a global binary behind what is published reinstalls on the next merge instead of staying stale until someone runs `canon sync --check` by hand.
- The reclaim sits before that block rather than after it, since the upgrade reinstalls the binary the hook is running under and every step after it would run against a package that moved. Ordering is the one coupling between the four steps and nothing enforces it.
- `CANON_SKIP_UPGRADE=1` turns the step off, documented in the hook's own header rather than only here, since the header is what a person reads looking for the switch.
- The printed line comes from the JSON record's `message` field, which `src/commands/upgrade.ts` renders once per outcome rather than the hook reconstructing one from raw fields. The `current` state reuses `describeSkew` verbatim, matching the wording `canon sync --check` and `canon claude skills drift` already use.
- `emit` runs `message` through `singleLine` first, collapsing it to one line and swapping any double quote for an apostrophe. A registry error can carry either, and the hook reads the field with a pattern rather than a parser.
- `current` stays quiet, matching the archive block's silence on `no-match` and `no-board` and the records push printing only when something changed. A line on every merge that says nothing moved is the shape both siblings were written to avoid.
- A reinstall that fails partway names both versions it was moving between, in that same `message` field, which is the one route back to a broken global binary the next session meets.
- An older global binary carrying no `upgrade` subcommand produces no parseable record, and the hook stays quiet on that the way every such gap here does until a release lands.
- `post-merge` runs `canon claude plugin-update --json` last of all, mirroring the binary reinstall directly above it. The binary step keeps PATH current with what a merge published, and this step does the same for the marketplace plugin cache, which the binary reinstall never touches. Without it a dispatched session keeps resolving a retired skill body until an operator runs `claude plugin update` by hand.
- Sits last, after the binary reinstall, for the same reason that block sits after the records push: a slow or unreachable marketplace delays nothing else in the file, since nothing runs after it.
- `CANON_SKIP_PLUGIN_UPDATE=1` turns the step off, documented in the hook's own header beside the other three `CANON_SKIP_` variables.
- The verb resolves the plugin's own id by reading `claude/.claude-plugin/plugin.json`'s `name` field and matching it against a `claude plugin list --json` row by `<name>@` prefix, refusing rather than picking one when more than one installed row shares the name. `claude plugin update` carries no `--json` of its own, so the verb reads the version back off `claude plugin list --json` again after the update runs, the same "trust the disk, not the manager's own report" move `canon upgrade` makes.
- `current` stays quiet, matching the binary reinstall's own silence on its no-op state.
- A refusal reason of `no-claude` or `no-plugin` stays quiet too, matching `gh-missing` and `no-repository` above them: both name a permanent condition on a machine or project that will never carry the marketplace plugin, and a line nobody can act on twice teaches a reader to skip the block. Every other refusal, and an update that changed the version, prints once off the record's `message` field, run through `singleLine` first the way the binary reinstall's own message is.
- An older global binary carrying no `plugin-update` subcommand produces no parseable record, and the hook stays quiet on that the way every such gap here does until a release lands.
- `post-rewrite` delegates to `post-merge` on the `rebase` argument, so a `pull.rebase=true` machine gets the same check. It exits on `amend`, which rewrites nothing on the board.

Husky runs every hook as `sh -e "$hook"`, so the shebang on both is advisory and the file is POSIX sh under errexit whatever it declares. A bare `grep` that matches nothing aborts the hook and prints a husky failure on a clean pull, which is why each test sits inside an `if` condition rather than standing alone. Errexit exempts a condition and nothing else.

`check:shell` runs twice, and the second run is what reaches this file. The first globs `*.sh` under `scripts`, `tooling`, `claude`, and `.claude/hooks`, and no husky hook carries an extension, so adding `.husky` to that path list would change nothing on its own. The name filter is the half that skips them. The second run takes `find .husky -maxdepth 1 -type f` with `--shell=sh`, which reaches all five hooks and skips the `_` directory husky owns, and a sixth hook added later is covered the day it lands rather than when someone remembers to name it.

Two gates missed this file for that one reason and only one of them is closed. `canon pr key-changes` still reports a path with no extension as unnamed even where a bullet names it in a code span, which is why `.husky/post-merge` reads as uncovered on a pull request whose first bullet is about it.

Git hooks export `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, and `GIT_PREFIX`, and those beat `-C` on any shelled git call, so they have to be stripped. `canon comments scan src` passed standalone and failed under the pre-push hook, where the inherited `GIT_DIR` made `git -C src ls-tree` resolve against the whole repository and the trend arm returned repo-wide figures for a subtree, output ordinary enough to be worse than an error. It recurred in `src/sync/history.ts` and its fixtures at higher cost: the fixture's `git config user.email` overwrote the real repository's committer identity and the index staged all 785 tracked files as deleted. Route every shelled git call through `gitEnv()`, fixtures included, and prove the guard by exporting `GIT_DIR` and running the suite, since the standalone run passes either way.
