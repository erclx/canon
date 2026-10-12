---
title: Command scanners
description: The shared cut the memory guard and review post scan make over a Bash command, the heredoc opener test and what it leaves as a gap, the memory guard, and the review post scan
---

# Command scanners

`memory-guard.sh` and `review-post-scan.sh` each read a `Bash` command string and need to know which text is a command and which is only mentioned. Both answer it with one `awk` pass that cuts the command, so the shape and its gaps are stated once here and the two hook sections below carry only what differs.

## The opener test

A heredoc body is dropped from the cut, and the pass finds one by testing for `<<` followed by a tag. Three other spellings carry the same two characters and open nothing, so the test reads them first.

- A here-string, `<<<`, is consumed as three characters before the heredoc test. Without that, the second `<` of `cat <<< word` looked like a heredoc opener with the tag `word`, and every line after it was dropped until a line equal to that tag, which never came. A review post later in the same command was dropped with them.
- A shift inside `((` is text. The pass copies from an opening `((` to its matching `))` by counting parentheses, so `$((1<<2))`, `$((a<<n))`, and `$(( (1<<2) + 3 ))` stay whole in the command that holds them and open nothing.
- A shift in a command whose word is `let` is text, since `let x=1<<2` has no parentheses to count.

A digit before `<<` is not a shift. `cat 0<<EOF` is a file descriptor before a real heredoc and still opens one.

The two passes carry the edit separately. They share the opener test and the tag skip and differ in output shape, since the review scan emits one command per line and the memory guard emits the text with quoted spans folded. `src/hooks/guard.test.ts` covers each shape against both hook trees and against the memory guard.

## Accepted gaps

The cut now keeps a nested subshell written `((cmd); cmd2)` whole, which bash itself tries as arithmetic first, so a `gh api` inside it is not read as the start of a command. The case is rare and the ambiguity is bash's own.

The array and substring forms `$[1<<2]`, `a[1<<2]=x`, and `${s:1<<2}` still open a false heredoc. Each needs its own bracket tracking for input nobody has measured, so none is chased.

The opposite error stays and is fail-safe. `cat <<\EOF` yields an empty tag, so its body is read as commands and a quoted post inside it is denied rather than passed. A substitution inside double quotes is read as quoted text, which both hook sections below state again for their own verdict.

## The memory guard

`memory-guard.sh` is the check behind `autoMemoryEnabled: false`, which `canon/context/development/hooks/settings.md` records. The setting removes the harness's memory instruction, and the hook refuses a write that reaches the folder anyway. It registers on `PreToolUse` for `Write|Edit|MultiEdit`, widening the matcher `scratch-guard.sh` shares, and for `Bash` beside `dev-command-reminder.sh`. It denies with a reason on stderr and exit 2, as `unattended-agent-guard.sh` does.

The match is the folder's shape, `.claude/projects/<one segment>/memory`, also under the directory `CLAUDE_CONFIG_DIR` names. A bare `memory` segment stays writable, since `canon records push` has a `memory` kind and any repository path may hold one.

The `Bash` arm denies any command naming the folder where a path can sit, rather than one carrying a write operator. A list of write verbs is never complete, and reading the folder through `Bash` has no use once the feature is off. A command that only mentions the folder is not a write to it, so an `awk` pass first drops heredoc bodies, comments, and quoted spans holding whitespace, and the shape is matched on what is left. A write target carries no whitespace, so a heredoc, `-m` message, or `body=` field quoting the folder passes, while a bare or whitespace-free quoted token still denies, a `grep` included. A span or heredoc body handed to a shell, `python`, `node`, `perl`, `ruby`, or `eval` is code and is kept, behind a wrapper such as `sudo` or `xargs` too. The pass is copied from the seeded `review-post-scan.sh`, which this unseeded hook cannot source. The operator cleans the folder with a `!` command. A `Bash` command arrives unexpanded, so the match accepts `~`, `$HOME`, `${HOME}`, and an absolute spelling.

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
