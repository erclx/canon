---
title: Command scanners
description: The shared cut the memory guard and review post scan make over a Bash command, the heredoc opener test, the memory guard, and the review post scan
---

# Command scanners

`memory-guard.sh` and `review-post-scan.sh` each read a `Bash` command string and need to know which text is a command and which is only mentioned. Both answer it with one `awk` pass that cuts the command, so the shape and its gaps are stated once here and the two hook sections carry only what differs.

## Decisions

### The opener test

A heredoc body is dropped from the cut, and the pass finds one by testing for `<<` followed by a tag. Three other spellings carry the same two characters and open nothing, so the test reads them first.

- A here-string, `<<<`, is consumed as three characters first, since otherwise `cat <<< word` looked like a heredoc with the tag `word` and every later line was dropped, a review post included
- A shift inside `((` is text. The pass copies from `((` to its matching `))` by counting parentheses, so `$((1<<2))` and `$(( (1<<2) + 3 ))` open nothing.
- A shift in a command whose word is `let` is text, since `let x=1<<2` has no parentheses to count
- A digit before `<<` is not a shift, so `cat 0<<EOF` is a file descriptor before a real heredoc and still opens one

The two passes carry the edit separately. They share the opener test and the tag skip and differ in output shape, since the review scan emits one command per line and the memory guard emits the text with quoted spans folded. `src/hooks/guard.test.ts` covers each shape against both hook trees and the memory guard.

### The memory guard

`memory-guard.sh` is the check behind `autoMemoryEnabled: false`, which `canon/context/development/hooks/settings.md` records. The setting removes the harness's memory instruction, and the hook refuses a write that reaches the folder anyway. It denies with a reason on stderr and exit 2, as `unattended-agent-guard.sh` does.

- It registers on `PreToolUse` for `Write|Edit|MultiEdit`, widening the matcher `scratch-guard.sh` shares, and for `Bash` beside `dev-command-reminder.sh`
- The match is the folder's shape, `.claude/projects/<one segment>/memory`, also under the directory `CLAUDE_CONFIG_DIR` names
- A bare `memory` segment stays writable, since `canon records push` has a `memory` kind and any repository path may hold one
- The hook carries a `canon-no-seed:` marker and ships through no seed
- `src/hooks/guard.test.ts` covers it with an acting case and one `describe` for the boundaries

### How the memory guard reads a command

The `Bash` arm denies any command naming the folder where a path can sit, rather than one carrying a write operator, since a list of write verbs is never complete and reading the folder through `Bash` has no use once the feature is off. The operator cleans the folder with a `!` command.

A command that only mentions the folder is not a write to it, so an `awk` pass first drops heredoc bodies, comments, and quoted spans holding whitespace, and the shape is matched on what is left. A write target carries no whitespace.

- A heredoc, `-m` message, or `body=` field quoting the folder passes, while a bare or whitespace-free quoted token still denies, a `grep` included
- A span or heredoc body handed to a shell, `python`, `node`, `perl`, `ruby`, or `eval` is code and is kept, behind a wrapper such as `sudo` or `xargs` too
- The pass is copied from the seeded `review-post-scan.sh`, which this unseeded hook cannot source
- A `Bash` command arrives unexpanded, so the match accepts `~`, `$HOME`, `${HOME}`, and an absolute spelling

### The memory guard hot path

`Bash` is the highest-frequency tool, so the hook lifts the one `command` or `file_path` value out of the raw payload with a shell regex and tests it for a `projects/` and `memory` pair before `jq` or `awk` starts.

- The test reads the field and never the whole payload, because every real `PreToolUse` payload carries `transcript_path` under `~/.claude/projects/`, which matches the pair on its own
- The decode is one `jq -r`, which keeps a multi-line command matched without the `@tsv` trap `canon/context/development/hooks/overview.md` records
- The boundary tests build every payload with a `transcript_path`, and one case runs against a `jq` that fails when spawned

Three gaps are accepted, since the guard is the backstop and none is worth a shell parser.

- A write built from a variable (`d=~/.claude/projects; echo x > "$d/.../memory/a.md"`) gets past a string test
- A substitution inside double quotes passes as quoted text
- `autoMemoryDirectory` can move the folder anywhere, and the hook does not read settings to follow it

### The review post scan

`review-post-scan.sh` registers on `PreToolUse` for `Bash` and denies a `gh api` post or edit of a review or pull request comment whose body file fails `canon labels scan --body-file`. It is seeded, since a leaked record path is a target's problem as much as ours, and it calls the `canon` on `PATH`.

- It filters on the command string rather than the matcher, as `dev-command-reminder.sh` does, so a `Bash` call that is not a `gh api` post leaves on a single `case` match
- A command that only mentions a post is not one, and a heredoc writing a review body that quotes the command is the route `review-pr` prescribes
- The hook therefore cuts the command into the commands it runs and reads further only one starting with `gh api`, after any leading assignments or `command`

### What the review scan covers

It covers `pulls/<n>/reviews`, `pulls/<n>/reviews/<id>`, `issues/<n>/comments`, and `issues/comments/<id>`. Review replies and follow-up summaries reach the same thread, and no workflow re-reads an issue comment once posted, so the hook is the only check those get.

- Inline comments at `pulls/<n>/comments` are left out because no shipped skill posts one
- A pull request create or edit is left out, since the pull request skill scans its own title and body and the phase label gate re-reads every edit
- The method is the explicit `-X` or `--method` wherever it sits in the command, and with none named `gh` sends a `POST` once any field flag is present, so the hook reads that as a write
- A call carrying no fields is a read and passes silent

### Review scan verdicts

The hook gates on the scan's exit code and reads no record field, so a check added to the scan reaches review posts with no second change. It passes no `--title`, which makes the scan read the text as a review rather than a pull request body graded against the closed section list.

The body must be a file named by `-F body=@<file>`, resolved against the payload's `cwd`, since a session in a linked worktree writes the body relative to itself. Three shapes the hook cannot read are refused rather than let through.

- An inline `-f body=` or `-F body=` value and a `@-` stdin body have no file to scan
- A file that does not exist yet, which a heredoc and a post in one call produces, is blocked with a reason telling the session to write the body in an earlier call
- A body supplied through `--input` is outside what the hook reads and passes

A scan exit of 2 blocks with the scan's warning lines on stderr, and any other non-zero exit blocks too, so a refusal is never read as a pass. A blocking `PreToolUse` hook reaches the session through stderr alone.

With `canon` absent from `PATH` the call goes through and `additionalContext` says the scan did not run, since blocking would take a target's posting away over a missing binary.

### Why a hook and not a verb

A `canon pr review-post` verb that scans and posts would keep the parse in TypeScript, but a session can still call `gh api` directly, the slip three review passes made. The hook fires on the tool call whatever the session remembered. The cost is parsing a command string, so it reads the one shape every shipped skill uses.

`src/hooks/guard.test.ts` carries the acting case per tree with a stub `canon` exiting 2, and a verdicts block covering these cases.

- A clean body, a read of the same endpoint, a post naming no method, and a method placed after the endpoint
- A comment post, a pull request create, an inline body, a body not yet written, and a relative path
- `canon` absent, a post chained after another command, and a heredoc and a post in one call
- Four commands that only mention a post

## Gotchas

### Accepted gaps

The cut has four known edges, each rare or fail-safe.

- A nested subshell written `((cmd); cmd2)` stays whole, since bash tries it as arithmetic first, so a `gh api` inside it is not read as a command start
- The array and substring forms `$[1<<2]`, `a[1<<2]=x`, and `${s:1<<2}` still open a false heredoc, and each needs its own bracket tracking for input nobody has measured
- The opposite error is fail-safe, since `cat <<\EOF` yields an empty tag, its body is read as commands, and a quoted post inside it is denied rather than passed
- A substitution inside double quotes is read as quoted text, as both hook sections state for their own verdict
