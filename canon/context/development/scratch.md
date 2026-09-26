---
title: Session scratch
description: Why shared scratch lives at the main worktree root, what worktree isolation refuses, the two write routes a linked worktree has, the hooks a shell write bypasses, and which .canon/tmp/ writers state a root
---

# Session scratch

## Where shared scratch lives

`.canon/plans/`, `.canon/review/`, `.canon/memory/`, and `.canon/tasks/` are gitignored and live at the main worktree root. A linked worktree resolves them there rather than writing its own copy. How each folder archives, and how the set is backed off the disk, sits in `canon/context/development/records.md`.

`.claude/.tmp/` carries its own `.gitignore` entry and manifest array member, so the scratch rule's fallback spelling is covered wherever it is written, worktree or main root alike. It stays an ignore entry rather than a second scratch root, since only whether git sees the folder changed. `canon/context/context-model.md` carries the entry as a temporary carve-out, retired once `canon migrate records` has moved every project off the fallback it covers. <!-- canon-keep-record-root -->

## What worktree isolation refuses

A linked worktree reads the shared folders through one tool and writes them through another. `Edit` and `Write` refuse every main-root path with a message naming session isolation and directing the session to the worktree copy, while `Read` resolves normally and `Bash` writes without complaint, so the boundary is tool-scoped rather than filesystem-scoped. That holds across all four folders and a live task file.

### The four `Bash` triggers

The same isolation refuses a `Bash` command it cannot statically verify stays inside the worktree, on four triggers. None depends on where the target sits, so a session reading the main-root case as the cause earns the refusal a second time.

- Complexity. Joining `mkdir -p` and a heredoc write with `&&` is refused whole even though each half runs alone, and a shell loop reading several files goes the same way, so issue one plain command per call whatever it reads or writes.
- Heredoc content. A body quoting a command substitution, or a quoted `||`, is refused on its content while a body of plain prose goes out. A `cat <<'EOF' > file` against a main-root path has also been refused on one line of plain prose, so the shape can fire as well.
- A token inside a path. The guard reads the command string itself, so a path segment spelling a shell builtin is taken for that builtin, and a read-only listing or a plain file read under such a folder is refused. Reach for a form that avoids the token, such as a `find` with a path pattern.
- A repeated tool name. A command naming `git` twice is refused, counted after shell parsing, so splitting the token across two quoted strings does not lower it.

A single-line `printf '%s\n' "line one" "line two" > file` carrying a refused heredoc's content writes without complaint, wherever the file is short enough to spell as arguments. The repeated-name trigger has no such way around it: `git branch -m worktree-<name> <type>/<name>` hits it whenever `<name>` carries that token, which is `session-worktree` Step 5 for every branch under a git topic, so a session meeting it stops and reports the miscount.

The same token reaches a script handed to an interpreter inline, so a Python heredoc naming a skill with `git` in its name is refused, as is a `canon` call fed a command substitution. Writing the script to a file under the worktree's `.canon/tmp/<slug>/` and running it by path passes, since the guard then reads the interpreter call alone. Measured 2026-09-25.

## The two write routes

`session-worktree` states these routes to a session, in its `references/main-root-writes.md`, and `605-worktrees` points there. This section keeps the reasons behind them.

Two write kinds take two routes. Creating a whole file is a heredoc through `Bash`, which is why a plan, a review report, and a memory entry need no code behind them. A body the verification refuses falls back to `Write` into the worktree followed by a two-argument `cp` out to the main root, which carries no syntax to inspect and needs no verb.

Changing a line inside a file that already exists has no shell route, because the stream editors that would do it are banned for rewriting the line they anchored to and for exiting zero on a non-match, so it runs through a `canon` verb resolving the main root in-process. Relocating the four scratch folders was the other candidate, and it addresses nothing, since the refusal is tool-scoped rather than filesystem-scoped, while costing a breaking rename for every installed target.

`canon tasks pull-request` and `canon tasks outcome` cover the two edits the board takes, and `mainWorktreeRoot()` in `src/worktree.ts` is the resolver all of them share. A skill with a structured edit no verb covers reads the file and writes it back whole instead. `git-pr` routes its own `Pull request:` line through the verb rather than writing it directly, since a linked worktree's own write there is the refused path and the number is what the archive gate depends on.

A setting would lift the refusal outright rather than route around it. `worktree.bgIsolation` takes `worktree` or `none`, defaults to `worktree`, sits per repository, and the refusal message names it directly.

Resolution runs `CLAUDE_BG_ISOLATION` first, then a value stamped into the job record at spawn, then `.claude/settings.json`, and the spawn value comes out `none` when the spawning context is an interactive REPL, which is why a session working in place never meets the refusal a session it dispatches does. The routes decline the key anyway, since it carries no path carve-out: `none` frees every concurrent background session to write the shared checkout rather than only the write this section covers.

### What a shell write bypasses

A shell write costs the index hook, which matters wherever a folder's `index.md` is generated. The `PostToolUse` triggers match `Write|Edit|MultiEdit`, so nothing fires on `Bash`, and `task-board` and `memory-capture` each regenerate positionally after a shell write rather than leaving the index a row short.

The bypass reaches five hooks: `PostToolUse` on `Edit|Write|MultiEdit` runs `standards-audit.sh`, `tasks-index.sh`, `memory-index.sh`, and `path-form.sh`, and `PreToolUse` on `Write|Edit` runs `scratch-guard.sh`.

A plan write is a no-op for every one of the five: `standards-audit.sh` exits on `*.canon/plans/*` by an explicit skip, `tasks-index.sh` and `memory-index.sh` each match their own folder alone, `path-form.sh` answers only a path carrying a worktree segment, and `scratch-guard.sh` fires only on a `tmp`, `Temp`, or `var/folders` segment. `.canon/review/` clears the same five for the same reasons, so the cost lands on `.canon/tasks/` and `.canon/memory/` alone, where the two index hooks are real writers.

## Which `.canon/tmp/` writers state a root

`604-scratch.md` states the mixed default alone and names no writer, since a shipped rule citing a path under this repository's own `canon/context/` resolves nowhere in a target, per `598-authoring-layout.md`. The census lives here instead. Read the current writer set with `git grep -l '.canon/tmp/' claude/skills .claude/skills` before trusting the split below.

Most writers hold throwaway working state a single run creates, consumes through a local verb or a `gh` call, and removes or leaves for the next run to overwrite, such as `git-pr`'s pull request body, `review-address`'s reply body, and `draft-diagram`'s verification renders. None of those needs a root, since nothing outside the run that wrote it ever opens the file.

Six write material a later run or a different worktree reads back, and each states the main root. `memory-capture` states it for `.canon/tmp/handoff/memory-routing/<slug>.md`, and `memory-review`'s append to that file relies on the location capture put it at rather than restating the root. `ui-checklist`'s checklist, `teach-workspace`'s promotion handoff, `draft-screencast`'s draft, and `role-orchestrator`'s poll baseline under `.canon/tmp/pr/poll` each state their own root directly.

`draft-and-pick`'s `.canon/tmp/<slug>/candidates.html` reads like a seventh, since an operator drives the pick across more than one turn, but nothing outside the same skill run opens the scratch folder: `canon capture` and `canon serve` are its only readers there. The skill's close step batch-captures the final arms out to `.canon/picks/<slug>/` at the main root before it deletes the scratch folder, so the folder stays worktree-local.

`review-pr`'s `.canon/tmp/pr/review/body-<number>-<short-sha>.md` is the exception on the other side: material a later pass reads back through the Step 2 oid comparison, with no root stated anywhere in the body. A dispatched re-review runs in its own worktree, so the second pass writes a folder the first pass never touched, which the filename scheme cannot stop without the root fixed. Its Step 4 takes the same main-root heredoc route the six use.

### A handoff shared across worktrees

A `.canon/tmp/<topic>/<slug>.md` handoff shared across worktrees, the pattern `memory-capture` and `teach-workspace` use, carries no producer subfolder of its own. Its consumer removes the consumed `<slug>.md` alone, then `rmdir`s the topic folder guarded with `2>/dev/null || true`, which is a no-op wherever a sibling branch's own pending file still sits in it. A plain `rm -rf` on the topic folder would delete that sibling's in-flight handoff, since the folder is shared across every worktree writing to the same main root.
