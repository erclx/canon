---
title: Guards
description: The bounded stdin read every payload hook opens with, the path form hook, the bare flag repair, the pull-request creation log, and the unattended agent guard
---

# Guards

## Decisions

### The stdin guard

Every hook that reads a payload opens with `IFS= read -r -d '' -t 2 input` and exits non-zero with a usage line on an empty payload. Under Claude Code the payload arrives and stdin closes, so the bound is never paid. An unbounded `cat` blocks forever when stdin is an open socket, holding the background task and the session open.

- Only `bare-flag-repair.sh` and `cloud-setup.sh` are exempt, because they read no payload
- `cloud-setup.sh` still drains stdin with the bounded read, since a `SessionStart` writer meeting a closed pipe fails, and it skips the read on a terminal so a run by hand does not wait
- The guard uses `read` rather than `timeout cat`, because macOS ships no `timeout` and a missing one empties every payload and refuses every legitimate call
- `[ -t 0 ]` is the wrong descriptor test, since it reports false on an open socket, which is where the hang came from

### Testing the stdin guard

Nothing else compares the two hook trees, so a guard landing in one leaves the other broken with every stage passing. `src/hooks/guard.test.ts` walks both directories rather than a fixed list, asserting per file a bounded refusal, silence on a payload the hook ignores, and the real verdict on one it acts on.

The acting payload is what a mangled read fails. A corrupted payload reaches the same quiet exit as one naming a filtered tool, so a test built on the filtered case passes whatever the read did to the bytes.

- Each hook carries a payload reaching its working branch, paired with a string only that branch emits, and a hook added without one fails
- The index hook runs with `canon` dropped from `PATH`, which pins it to the stale-index branch regardless of whether the CLI is installed
- `cloud-setup.sh` with `CLAUDE_CODE_REMOTE=true` off a cloud VM runs a real `bun link` onto that checkout, so use a stub `bun` and restore with `bun add -g @erclx/canon@<version>`

### The path form hook

`path-form.sh` shares the `Edit|Write|MultiEdit` matcher and hands back the absolute form of a path written from a linked worktree, so a session prefers that form over computing it. `governance/rules/claude/output.md` keeps the instruction as a self-sufficient fallback rather than a branch the hook replaced.

- The hook reaches a project through the seed at scaffold time and the rule through `canon gov sync`, so a target that synced governance alone would otherwise read a line naming a source it lacks
- It reads the worktree off `file_path`, a `*/.claude/worktrees/*` segment, not `git rev-parse`, which answers for the hook's own directory. `records-index.sh` does the same.
- It exits quietly on a path with no such segment and resolves `realpath` on one that has it
- The output rule does not branch on `CLAUDE_CODE_ENTRYPOINT` to pick a bare path or a `file://` link, since the harness's own per-surface link instruction decides

The companion outcome, reporting a turn that wrote files and named none, is `silent-turn.sh`, covered in `canon/context/development/hooks/compaction.md`.

### The bare flag repair

`bare-flag-repair.sh` shares the `Bash` matcher and clears `core.bare` when worktree entry has left it set. Git refuses every operation while the flag is on, which puts `post-checkout` and the other husky hooks out of reach, so a tool call is the only event that still fires ahead of the command that would fail.

`canon gate run` keeps its own in-process call to the same repair, but a planning or review session reads git constantly and runs the suite never, so the suite alone leaves such a session broken for its whole length.

- The hook announces the repair through `additionalContext` rather than clearing the flag silently, since it writes to the shared git config as a side effect of an unrelated call
- It calls `canon worktrees repair-bare-flag --json` through `src/cli.ts` rather than restating the predicate, and keeps the warning off stdout, where an unframed line corrupts the hook protocol
- Bun starts only when the flag is already set, and the flag read comes first because every invocation but a handful stops there
- That costs one process, roughly 2ms against 3.6ms for `dev-command-reminder.sh`, so the two stay separate hooks
- When the call fails or `src/cli.ts` is absent, the hook says the repair did not run, and a failed config write reaches it as the verb's `write-failed` message

### The pull-request creation log

`pr-create-log.sh` registers on `PostToolUse` for `Bash`, where `dev-command-reminder.sh` and `bare-flag-repair.sh` sit on `PreToolUse`. It filters the command string for `gh pr create`, or the output for an `opened=true` line, rather than narrowing at the matcher.

- The second form is `git-pr`'s, which opens a pull request over REST and prints that line only on its create path, since its edit path prints a URL as well
- On a match it greps `tool_response.stdout` for the pull request URL, which tells a creation from a failed call
- It appends a line to `.canon/tmp/pr/log/log.md` and hands back an `additionalContext` reminder naming the channel obligation `role-worker` states

The hook cannot know whether a session sent the announcement, only that a pull request now exists, so the log is a denominator for the next wave's miss rate rather than a record of the send.

`CLAUDE_PROJECT_DIR` is the session's own worktree rather than the main root, so a naive read would write the log into a folder that dies when the worktree is reclaimed. The hook strips a trailing `.claude/worktrees/*` segment first, as `records-index.sh` does.

### The unattended agent guard

`unattended-agent-guard.sh` is toolkit-only and carries a `canon-no-seed:` marker, holding the seeded copy back until the local hook is proven. It registers on `PreToolUse` for `Agent|Task`, the second name covering an installed build that still emits the pre-rename tool name.

It denies every `Agent` call from an unattended session rather than coordinating the write, since nothing serializes a session against its own fork and a background worker could otherwise keep writing the files by hand while the fork builds a plan.

- The payload's `subagent_type` and `isolation` stay unread, so the hook cannot separate a safe `isolation: worktree` fork from a same-directory one, and the blanket denial is deliberate

### Classifying an unattended session

The deny condition is `CLAUDE_CODE_SESSION_ATTENDED` read as exactly `0`, the one value measurements have confirmed. It reads `0` in a background session and is unset in an interactive session on the desktop app's Code tab. No interactive terminal session has been measured.

Any other reading, unset included, is a session the hook cannot classify, so it passes the call silently rather than block one it never measured. A terminal session reading `0` would collide with that silence, since nothing else distinguishes it from a background session, and closing the gap needs the unmeasured reading rather than a guess.

### Why no attended switch

The guard answers one question, an unattended fork colliding with its parent. An operator's standing "no subagents in this project" is a permission rule, and `permissions.deny` with `"Agent"` in `.claude/settings.json` or `settings.local.json` already binds every session and wins over any hook, as `wiki/claude/permissions.md` states.

The rejected alternative was a variable or settings key the hook reads to deny attended sessions too. It would duplicate the native rule, need its own test, and fail open whenever the key is unset.

### The held seed and its test

The seed stays held until an interactive terminal session reads `CLAUDE_CODE_SESSION_ATTENDED` as anything but `0`, since a seeded hook would otherwise block every attended terminal session. One `! echo "$CLAUDE_CODE_SESSION_ATTENDED"` there takes the reading. Seeding then also needs a settings registration and a second tree for the test to walk.

- `src/hooks/guard.test.ts` covers the denial with the variable at `0` on both `Agent` and `Task`, and the unset and non-zero boundary, each passing through silent
- Because the hook reads an environment variable, the shared `run` helper takes an `env` override that deletes or sets a key on the spawned process rather than inheriting the runner's
- The hook exists only in `.claude/hooks/`, so the classification block runs once against that path rather than looping over both trees

### Command scanners

`memory-guard.sh` and `review-post-scan.sh` cut a `Bash` command with the same `awk` shape and share one opener test and its accepted gaps, covered in `canon/context/development/hooks/command-scanners.md`.
