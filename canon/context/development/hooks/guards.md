---
title: Guards
description: The bounded stdin read every payload hook opens with, the path form hook, the bare flag repair, the pull-request creation log, the unattended agent guard, the memory guard, and the review post scan
---

# Guards

## The stdin guard

Every hook that reads a payload opens with `IFS= read -r -d '' -t 2 input` and exits non-zero with a usage line on an empty payload. Under Claude Code the payload arrives and stdin closes, so the read returns at once and the bound is never paid. An unbounded `cat` instead blocks forever when a caller runs the hook by hand or from a tool call whose stdin is an open socket, which holds the background task open and with it the session. Only `bare-flag-repair.sh` and `cloud-setup.sh` are exempt, and both are exempt because they read no payload.

`cloud-setup.sh` still drains stdin with the same bounded read, since a `SessionStart` writer meeting a closed pipe fails, and it skips the read on a terminal so a run by hand does not wait.

The guard uses `read` rather than `timeout cat`, because macOS ships no `timeout` and a missing one empties every payload and refuses every legitimate call. The obvious descriptor test `[ -t 0 ]` is the wrong one, since it reports false on an open socket, which is where the hang came from. Nothing else compares the two hook trees, so a guard landing in one leaves the other broken with every stage still passing. `src/hooks/guard.test.ts` walks both directories rather than a fixed list, asserting per file a bounded refusal, silence on a payload the hook ignores, and the real verdict on one it acts on.

The acting payload is what a mangled read fails. A corrupted payload reaches the same quiet exit as one naming a tool the hook filters out, so a test built on the filtered case passes whatever the read did to the bytes. Each hook therefore carries a payload reaching the branch that does its work, paired with a string only that branch emits, and a hook added without one fails rather than passing on the refusal alone.

The index hook runs with `canon` dropped from `PATH`, which pins it to the branch reporting a stale index instead of leaving the assertion to depend on whether the CLI is installed.

`cloud-setup.sh` run with `CLAUDE_CODE_REMOTE=true` anywhere but a cloud VM runs a real `bun link`, which repoints the machine's global `@erclx/canon` at that checkout. Exercise it with a stub `bun` on `PATH`, as `src/hooks/guard.test.ts` does, and restore a relinked machine with `bun add -g @erclx/canon@<version>`.

## The path form hook

`path-form.sh` shares the `Edit|Write|MultiEdit` matcher and hands back the absolute form of a path written from a linked worktree, so a session prefers that form over computing it. `governance/rules/claude/566-output.md` keeps the instruction as a self-sufficient fallback rather than a branch the hook replaced. The hook reaches a project only through `tooling/claude/seeds/` at scaffold time while the rule reaches one through `canon gov sync`, and a target that synced governance without ever scaffolding through the seed would otherwise read a line naming a source it does not have.

It reads the worktree branch off `file_path` itself, a `*/.claude/worktrees/*` segment, rather than shelling out to `git rev-parse`, since that call would answer for whatever directory the hook's own process happens to run in rather than the worktree the write came from. `records-index.sh` derives its main root the same way, off a path suffix rather than the session. It exits quietly on a path with no such segment and resolves `realpath` on one that has it.

The output rule once branched on `CLAUDE_CODE_ENTRYPOINT` to pick a bare path or a `file://` link. That branch retired onto the harness's own link instruction, which Claude Code gives per surface, so neither the rule nor this hook decides the link form.

The companion outcome, reporting a turn that wrote files and named none of them, is `silent-turn.sh`, covered in `canon/context/development/hooks/compaction.md`.

## The bare flag repair

`bare-flag-repair.sh` shares the `Bash` matcher and clears `core.bare` when worktree entry has left it set. Git refuses every operation while the flag is on, which puts `post-checkout` and the rest of the husky hooks out of reach, so a tool call is the only event that still fires ahead of the command that would fail. `canon gate run` keeps its own in-process call to the same repair, but a planning or review session reads git constantly and runs the suite never, so the suite alone leaves such a session broken for its whole length.

The hook writes to the shared git config as a side effect of an unrelated `Bash` call, so it announces the repair through `additionalContext` rather than clearing the flag silently. It calls `canon worktrees repair-bare-flag --json` through `src/cli.ts` rather than restating the predicate, and parses the record so the warning reaches `additionalContext` rather than stdout, where an unframed line corrupts the hook protocol. Bun starts only when the flag is already set. When that call fails, or `src/cli.ts` is absent, the hook says the repair did not run rather than going quiet, and a repair whose config write failed reaches it as the verb's own `write-failed` message.

The flag read comes first and costs one process, ahead of the payload parse, because every invocation but a handful stops there. That measured at roughly 2ms against 3.6ms for `dev-command-reminder.sh` on the same matcher, so the two stay separate hooks.

## The pull-request creation log

`pr-create-log.sh` registers on `PostToolUse` for the `Bash` matcher, where `dev-command-reminder.sh` and `bare-flag-repair.sh` sit on `PreToolUse` instead. It filters for a command containing `gh pr create`, or for an `opened=true` line in the output, rather than narrowing at the matcher, the same shape those two take for testing the command string over the tool name.

The second form is `git-pr`'s, which opens a pull request over REST and prints that line only on its create path, since its edit path prints a URL as well. On a match it greps `tool_response.stdout` for the pull request URL either form prints on success, which is what tells a creation apart from a failed or refused call. It then appends a line to `.canon/tmp/pr/log/log.md` and hands back an `additionalContext` reminder naming the channel obligation `role-worker` states.

The hook cannot know whether a session sent the announcement, only that a pull request now exists to announce, so the log is a denominator for the next wave's miss rate rather than a record of the send itself.

The log resolves off `CLAUDE_PROJECT_DIR`, and that value is the session's own worktree rather than the main root, so a naive read would write a wave's denominator into a folder that dies the moment the worktree it was built in gets reclaimed. The hook strips a trailing `.claude/worktrees/*` segment before writing, the way `records-index.sh` derives its main root off a path suffix.

## The unattended agent guard

`unattended-agent-guard.sh` is toolkit-only and carries a `canon-no-seed:` marker rather than shipping through `tooling/claude/seeds/.claude/hooks/`, holding the seeded copy back until the local hook is proven. It registers on `PreToolUse` for `Agent|Task`, the second name covering an installed build that still emits the tool's pre-rename name, and reads `tool_name` off the payload the way every guarded hook here does.

It denies every `Agent` call from an unattended session rather than coordinating the write, since nothing in this tree serializes a session against its own fork, and a background worker that forks an agent to build a plan can otherwise keep writing the same files by hand while the fork is still running. The payload's own `tool_input.subagent_type` and `tool_input.isolation` fields stay unread. The hook therefore cannot separate a safe `isolation: worktree` fork from a risky same-directory one, and the blanket denial is deliberate rather than an oversight.

The deny condition is `CLAUDE_CODE_SESSION_ATTENDED` read as exactly `0`, the one value measurements have confirmed. It reads `0` in a background session, and unset in an interactive session on the desktop app's Code tab, `CLAUDE_CODE_ENTRYPOINT=claude-desktop`. No interactive terminal session has been measured.

A session where the variable holds anything other than `0`, unset or unmeasured included, is one the hook cannot classify, and it lets the call through silently rather than blocking a session the reading never covered or reporting a pass it has no basis for. A terminal interactive session reading `0` would collide with that silence, since nothing else distinguishes it from a background session, and closing that gap needs the unmeasured reading rather than a guess.

The guard answers one question, an unattended fork colliding with its parent, and an operator's standing "no subagents in this project" is a different one. That is a permission rule, and it grows no attended switch here. A `permissions.deny` entry of `"Agent"` in `.claude/settings.json` or `.claude/settings.local.json` already binds every session and wins over any hook, which `wiki/claude/permissions.md` states under its subagent section. The rejected alternative was an environment variable or settings key the hook reads to deny attended sessions as well. It would duplicate coverage the native rule has, need its own test, and fail open whenever the key is unset. Feedback #1980 asked for it and received the documented route instead.

The seed stays held. The hold lifts once an interactive terminal session reads `CLAUDE_CODE_SESSION_ATTENDED` as anything but `0`, since a seeded hook in a target where that reading is `0` would block every attended terminal session. One `! echo "$CLAUDE_CODE_SESSION_ATTENDED"` typed into such a session takes the reading. Seeding then also needs a seed settings registration and a second tree for the test to walk.

`src/hooks/guard.test.ts` covers the denial with `CLAUDE_CODE_SESSION_ATTENDED=0` and the tool matcher on both `Agent` and `Task`, and covers the classification boundary with the variable unset and with a non-zero value, each expected to pass through silent. Because the hook reads an environment variable rather than payload alone, the shared `run` helper takes an `env` override that deletes or sets a key on the spawned process rather than inheriting whatever the test runner happens to carry. The hook exists only in `.claude/hooks/`, so the directory walk has no seed copy to reach, and the classification-boundary block runs once directly against that path rather than looping over both trees.

## The memory guard

`memory-guard.sh` is the check behind `autoMemoryEnabled: false`, which `canon/context/development/hooks/settings.md` records. The setting removes the harness's memory instruction, and the hook refuses a write that reaches the folder anyway. It registers on `PreToolUse` for `Write|Edit|MultiEdit`, widening the matcher `scratch-guard.sh` shares, and for `Bash` beside `dev-command-reminder.sh`. It denies with a reason on stderr and exit 2, as `unattended-agent-guard.sh` does.

The match is the folder's shape, `.claude/projects/<one segment>/memory`, also under the directory `CLAUDE_CONFIG_DIR` names. A bare `memory` segment stays writable, since `canon records push` has a `memory` kind and any repository path may hold one.

The `Bash` arm denies any command naming the folder where a path can sit, rather than one carrying a write operator. A list of write verbs is never complete, and a model reading the folder through `Bash` has no use for it once the feature is off. A command that only mentions the folder is not a write to it, so an `awk` pass first drops heredoc bodies, comments, and quoted spans holding whitespace, and the shape is matched on what is left. A write target carries no whitespace, so a heredoc, `-m` message, or `body=` field quoting the folder passes, while a bare or whitespace-free quoted token still denies, including a `grep` of it. A span or heredoc body handed to a shell, `python`, `node`, `perl`, `ruby`, or `eval` is code and not a target, so it is kept. The pass is copied from the seeded `review-post-scan.sh`, which this unseeded hook cannot source. The operator cleans the folder with a `!` command. A `Bash` command arrives unexpanded, so the match accepts `~`, `$HOME`, `${HOME}`, and an absolute spelling.

The hot path stays cheap. `Bash` is the highest-frequency tool, so the hook lifts the one `command` or `file_path` value out of the raw payload with a shell regex and tests it for a `projects/` and `memory` pair before `jq` or `awk` starts. The test reads the field and never the whole payload, because every real `PreToolUse` payload carries `transcript_path` under `~/.claude/projects/`, which matches the pair on its own. The decode is one `jq -r`, which keeps a multi-line command matched without the `@tsv` trap `canon/context/development/hooks/overview.md` records. The boundary tests build every payload with a `transcript_path`, and one case runs against a `jq` that fails when spawned.

Three gaps are accepted. A write built from a variable (`d=~/.claude/projects; echo x > "$d/.../memory/a.md"`) gets past a string test, a substitution inside double quotes passes as quoted text, and `autoMemoryDirectory` can move the folder anywhere, which the hook does not read settings to follow. The guard is the backstop, so none is chased with a shell parser.

The hook carries a `canon-no-seed:` marker and ships through no seed. `src/hooks/guard.test.ts` covers it with an acting case and one `describe` for the boundaries.

## The review post scan

`review-post-scan.sh` registers on `PreToolUse` for `Bash` and denies a `gh api` post or edit of a review or a pull request comment whose body file fails `canon labels scan --body-file`. It is seeded, since a leaked record path is a target's problem as much as this repository's, and it calls the `canon` on `PATH`. It filters on the command string rather than the matcher, the shape `dev-command-reminder.sh` takes, so a `Bash` call that is not a `gh api` post leaves on a single `case` match.

A command that only mentions a post is not one. A heredoc writing a review body that quotes the command is the route `review-pr` prescribes for a body file, and a search whose pattern holds it reads the same to a whole-string match. The hook therefore cuts the command into the commands it runs with a small `awk` pass, dropping heredoc bodies and leaving quoted text whole so a separator inside quotes splits nothing, and reads further only a command that starts with `gh api`, after any leading assignments or `command`. The method and body patterns run on that command alone. The pass is a scanner and not a shell parser, so a substitution inside double quotes is read as quoted text, and the hook then passes it rather than guess.

It covers `pulls/<n>/reviews`, `pulls/<n>/reviews/<id>`, `issues/<n>/comments`, and `issues/comments/<id>`. Review replies and follow-up summaries reach the same thread, and no workflow re-reads an issue comment once it is posted, so the hook is the only check those ever get. A pull request's inline comments, `pulls/<n>/comments`, are left out deliberately because no shipped skill posts one. A pull request create or edit is left out as well, since the pull request skill scans its own title and body and the phase label gate re-reads it on every edit.

The method is the explicit `-X` or `--method` when one is named, wherever it sits in the command. With none named, `gh` sends a `POST` once any field flag is present, so the hook reads that as a write too, and a call carrying no fields is a read and passes silent.

The hook gates on the scan's exit code and reads no record field, so a check added to the scan reaches review posts with no second change. It passes no `--title`, which is what makes the scan read the text as a review rather than an ordinary pull request body and grade it against the closed section list.

The body must be a file named by `-F body=@<file>`, resolved against the payload's `cwd` rather than `CLAUDE_PROJECT_DIR` or the hook's own directory, since a session in a linked worktree writes the body relative to itself. Three shapes the hook cannot read are refused rather than let through. An inline `-f body=` or `-F body=` value and a `@-` stdin body have no file to scan. A file that does not exist yet, which is what a heredoc and a post in one call produces, is blocked with a reason telling the session to write the body in an earlier call, since the file is absent when the hook runs and passing it would post a body no scan read. A body supplied through `--input` is outside what the hook reads and passes.

A scan exit of 2 blocks with the scan's warning lines on stderr. Any other non-zero exit blocks too, with the scan's own output, so a refusal is never read as a pass. The hook writes nothing to stdout on a block, since a blocking `PreToolUse` hook reaches the session through stderr alone. With `canon` absent from `PATH` the call goes through and `additionalContext` says the scan did not run, since every surface the hook guards already requires the CLI and blocking would take a target's posting away over a missing binary rather than a finding.

The alternative was a `canon pr review-post` verb that scans and posts, which keeps the parse in TypeScript. A session can still call `gh api` directly, which is the slip three review passes made with the manual scan step, while the hook fires on the tool call whatever the session remembered. The cost is parsing a command string, so the hook reads the one shape every shipped skill uses.

`src/hooks/guard.test.ts` carries the acting case per tree with a stub `canon` exiting 2, and a verdicts block covering a clean body, a read of the same endpoint, a post naming no method, a method placed after the endpoint, a comment post, a pull request create, an inline body, a body not yet written, a relative path, `canon` absent, a post chained after another command, a heredoc and a post in one call, and four commands that only mention a post.
