---
title: Main-root write routing
description: Which tools the isolation refusal covers, the route each kind of main-root write takes, the fallback when a heredoc is refused, and the index cost a shell write carries
---

Shared session scratch, being `.canon/plans/`, `.canon/review/`, and `.canon/tasks/`, lives at the main worktree root. Resolve that root with the first `worktree` entry of `git worktree list --porcelain`, falling back to `pwd` outside a git repository.

## The refusal

- The refusal is tool-scoped rather than path-scoped. `Edit` and `Write` are refused for every main-root path, `Read` resolves there normally, and `Bash` writes there.
- A background session that entered no worktree meets the identical refusal, since the guard gates on isolation rather than on sitting inside a linked worktree.
- The refusal points at a worktree copy, a second gitignored file no later session reads, so never take the redirect
- The redirected write reports success, which is how a file gets lost with nothing saying so

## Route by what the write does to the file

Each kind of write takes one route, and none of them is a stream editor.

| Write                | Route                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Whole-file create    | One plain `Bash` command carrying a heredoc                                                                    |
| Change inside a file | A `canon` verb resolving the main root in-process, such as `canon tasks outcome` or `canon tasks pull-request` |
| Delete or move       | One plain `rm` or `mv` per call rather than chained                                                            |

Three habits keep those routes from being refused or silently wrong.

- Send `mkdir -p` for a missing folder as its own command first, since a `&&` compound is refused for complexity
- Where no verb covers an edit, read the whole file and write it back whole through the heredoc route
- Never reach for a stream editor, which rewrites the line it anchored to and exits zero on a non-match

### When the heredoc is refused

A heredoc can be refused on a body quoting shell syntax. The fallback depends on whether the session has a worktree to write into.

- Inside a linked worktree, `Write` the file there and copy it out with a two-argument `cp` to the main-root path. The copy carries no syntax to inspect.
- A background session that entered no worktree sends a short file as one `printf '%s\n'` command carrying each line as an argument
- When the file is too long for that, report the refusal rather than taking the redirect

## The index cost

A shell write skips every `PostToolUse` hook, since those match `Write|Edit|MultiEdit` and never fire on `Bash`. No hook indexes `.canon/plans/` or `.canon/review/`, so the cost lands on the generated `index.md` under `.canon/tasks/` alone.

Regenerate positionally after a shell write there, by an explicit `canon indexes regen` call. Skip it when the verb that made the write already calls it, as `canon tasks archive` does.
