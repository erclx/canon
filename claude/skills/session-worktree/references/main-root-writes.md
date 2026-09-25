---
title: Main-root write routing
description: Which tools the isolation refusal covers, the route each kind of main-root write takes, the fallback when a heredoc is refused, and the index cost a shell write carries
---

Shared session scratch, being `.canon/plans/`, `.canon/review/`, `.canon/memory/`, and `.canon/tasks/`, lives at the main worktree root. Resolve that root with the first `worktree` entry of `git worktree list --porcelain`, falling back to `pwd` outside a git repository.

## The refusal

- The refusal is tool-scoped rather than path-scoped. `Edit` and `Write` are refused for every main-root path, `Read` resolves there normally, and `Bash` writes there.
- A background session that entered no worktree at all meets the identical refusal writing to the main root, since the guard gates on isolation rather than on sitting inside a linked worktree.
- The refusal names session isolation and points at a worktree copy. That copy is a second gitignored file no later session reads, so never take the redirect. The redirected write reports success, which is how a file gets lost with nothing saying so.

## Route by what the write does to the file

- A whole-file create goes out as one plain `Bash` command carrying a heredoc. Send `mkdir -p` for a missing folder as its own command first, since a `&&` compound is refused for complexity.
- When the heredoc itself is refused, which can happen on a body quoting shell syntax, a session inside a linked worktree can `Write` the file there and copy it out with a two-argument `cp` to the main-root path. The copy carries no syntax to inspect.
- A background session that entered no worktree has nothing to `Write` into, so it sends a short file as one `printf '%s\n'` command carrying each line as an argument. When the file is too long for that, it reports the refusal rather than taking the redirect.
- A change inside a file that already exists goes through a `canon` verb that resolves the main root in-process, such as `canon tasks outcome` or `canon tasks pull-request`. Where no verb covers the edit, read the whole file and write it back whole through the heredoc route. Never reach for a stream editor, which rewrites the line it anchored to and exits zero on a non-match.
- A delete or a move runs as one plain `rm` or `mv` per call rather than chained.

## The index cost

A shell write skips every `PostToolUse` hook, since those match `Write|Edit|MultiEdit` and never fire on `Bash`. That costs nothing on `.canon/plans/` and `.canon/review/`, which no hook indexes, and costs the generated `index.md` on `.canon/tasks/` and `.canon/memory/`. Regenerate positionally after a shell write there, by an explicit `canon indexes regen` call, unless the verb that made the write already calls it, as `canon tasks archive` does.
