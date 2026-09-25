---
title: Guards
description: The bounded stdin read every payload hook opens with, the path form hook, the bare flag repair, the pull-request creation log, and the unattended agent guard
---

# Guards

## The stdin guard

Every hook that reads a payload opens with `IFS= read -r -d '' -t 2 input` and exits non-zero with a usage line on an empty payload. Under Claude Code the payload arrives and stdin closes, so the read returns at once and the bound is never paid. An unbounded `cat` instead blocks forever when a caller runs the hook by hand or from a tool call whose stdin is an open socket, which holds the background task open and with it the session. Only `bare-flag-repair.sh` is exempt, and it is exempt because it reads no payload.

The guard uses `read` rather than `timeout cat`, because macOS ships no `timeout` and a missing one empties every payload and refuses every legitimate call. The obvious descriptor test `[ -t 0 ]` is the wrong one, since it reports false on an open socket, which is where the hang came from. Nothing else compares the two hook trees, so a guard landing in one leaves the other broken with every stage still passing. `src/hooks-guard.test.ts` walks both directories rather than a fixed list, asserting per file a bounded refusal, silence on a payload the hook ignores, and the real verdict on one it acts on.

The acting payload is what a mangled read fails. A corrupted payload reaches the same quiet exit as one naming a tool the hook filters out, so a test built on the filtered case passes whatever the read did to the bytes. Each hook therefore carries a payload reaching the branch that does its work, paired with a string only that branch emits, and a hook added without one fails rather than passing on the refusal alone.

The two index hooks run with `canon` dropped from `PATH`, which pins them to the branch reporting a stale index instead of leaving the assertion to depend on whether the CLI is installed.

## The path form hook

`path-form.sh` shares the `Edit|Write|MultiEdit` matcher and hands back the absolute form of a path written from a linked worktree, so a session prefers that form over computing it. `governance/rules/core/015-output.md` keeps the instruction as a self-sufficient fallback rather than a branch the hook replaced. The hook reaches a project only through `tooling/claude/seeds/` at scaffold time while the rule reaches one through `canon gov sync`, and a target that synced governance without ever scaffolding through the seed would otherwise read a line naming a source it does not have.

It reads the worktree branch off `file_path` itself, a `*/.claude/worktrees/*` segment, rather than shelling out to `git rev-parse`, since that call would answer for whatever directory the hook's own process happens to run in rather than the worktree the write came from. `tasks-index.sh` and `memory-index.sh` derive their main root the same way, off a path suffix rather than the session. It exits quietly on a path with no such segment and resolves `realpath` on one that has it.

The entrypoint branch of the same rule, bare against a `file://` link, stays prose rather than moving into this hook. Claude Code's own hook documentation lists `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, and `CLAUDE_PLUGIN_DATA` among the environment a hook subprocess inherits and does not list `CLAUDE_CODE_ENTRYPOINT`. It also documents `OTEL_*` variables as deliberately stripped from every spawned subprocess, so the same curation could apply to a variable it never names as passed through. A live spike inside a running session cannot confirm either way, since `.claude/settings.json` loads once at session start and a hook added mid-session never fires until the next one begins.

The companion outcome, reporting a turn that wrote files and named none of them, is `silent-turn.sh`, covered in `canon/context/development/hooks/compaction.md`.

## The bare flag repair

`bare-flag-repair.sh` shares the `Bash` matcher and clears `core.bare` when worktree entry has left it set. Git refuses every operation while the flag is on, which puts `post-checkout` and the rest of the husky hooks out of reach, so a tool call is the only event that still fires ahead of the command that would fail. `canon gate run` keeps its own call to the same repair through `scripts/core/repair-bare-flag.sh`, but a planning or review session reads git constantly and runs the suite never, so the suite alone leaves such a session broken for its whole length.

The hook writes to the shared git config as a side effect of an unrelated `Bash` call, so it announces the repair through `additionalContext` rather than clearing the flag silently. It sources `repair_bare_flag` from `scripts/lib/worktree.sh` rather than restating the predicate, and stubs `log_warn` before the source so the library warning lands in a variable instead of on stdout, where an unframed line corrupts the hook protocol.

The flag read comes first and costs one process, ahead of the payload parse, because every invocation but a handful stops there. That measured at roughly 2ms against 3.6ms for `dev-command-reminder.sh` on the same matcher, so the two stay separate hooks.

## The pull-request creation log

`pr-create-log.sh` registers on `PostToolUse` for the `Bash` matcher, where `dev-command-reminder.sh` and `bare-flag-repair.sh` sit on `PreToolUse` instead. It filters for a command containing `gh pr create` rather than narrowing at the matcher, the same shape those two take for testing the command string over the tool name. On a match it greps `tool_response.stdout` for the pull request URL `gh pr create` prints on success, which is what tells a creation apart from a failed or refused call. It then appends a line to `.canon/tmp/pr/log/log.md` and hands back an `additionalContext` reminder naming the channel obligation `role-worker` states.

The hook cannot know whether a session sent the announcement, only that a pull request now exists to announce, so the log is a denominator for the next wave's miss rate rather than a record of the send itself.

The log resolves off `CLAUDE_PROJECT_DIR`, and that value is the session's own worktree rather than the main root, so a naive read would write a wave's denominator into a folder that dies the moment the worktree it was built in gets reclaimed. The hook strips a trailing `.claude/worktrees/*` segment before writing, the way `tasks-index.sh` and `memory-index.sh` derive their main root off a path suffix.

## The unattended agent guard

`unattended-agent-guard.sh` is toolkit-only and carries a `canon-no-seed:` marker rather than shipping through `tooling/claude/seeds/.claude/hooks/`, holding the seeded copy back until the local hook is proven. It registers on `PreToolUse` for `Agent|Task`, the second name covering an installed build that still emits the tool's pre-rename name, and reads `tool_name` off the payload the way every guarded hook here does.

It denies every `Agent` call from an unattended session rather than coordinating the write, since nothing in this tree serializes a session against its own fork, and a background worker that forks an agent to build a plan can otherwise keep writing the same files by hand while the fork is still running. The payload's own `tool_input.subagent_type` and `tool_input.isolation` fields stay unread. The hook therefore cannot separate a safe `isolation: worktree` fork from a risky same-directory one, and the blanket denial is deliberate rather than an oversight.

The deny condition is `CLAUDE_CODE_SESSION_ATTENDED` read as exactly `0`, the one value measurements have confirmed. It reads `0` in a background session, and unset in an interactive session on the desktop app's Code tab, `CLAUDE_CODE_ENTRYPOINT=claude-desktop`. No interactive terminal session has been measured.

A session where the variable holds anything other than `0`, unset or unmeasured included, is one the hook cannot classify, and it lets the call through silently rather than blocking a session the reading never covered or reporting a pass it has no basis for. A terminal interactive session reading `0` would collide with that silence, since nothing else distinguishes it from a background session, and closing that gap needs the unmeasured reading rather than a guess.

`src/hooks-guard.test.ts` covers the denial with `CLAUDE_CODE_SESSION_ATTENDED=0` and the tool matcher on both `Agent` and `Task`, and covers the classification boundary with the variable unset and with a non-zero value, each expected to pass through silent. Because the hook reads an environment variable rather than payload alone, the shared `run` helper takes an `env` override that deletes or sets a key on the spawned process rather than inheriting whatever the test runner happens to carry. The hook exists only in `.claude/hooks/`, so the directory walk has no seed copy to reach, and the classification-boundary block runs once directly against that path rather than looping over both trees.
