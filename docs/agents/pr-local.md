---
title: The pull request local preview
description: How canon pr local finds the server a worktree is running, why a server in another worktree is never reported, the refusal reasons it names, and how a close workflow removes the link with --remove
---

# The pull request local preview

`canon pr local` reports the `localhost` address of the dev server the current
worktree is running. `git-pr` calls it ahead of the evidence comparison and
passes the address through `canon pr evidence --local`, so a reviewer on the
same machine gets the running branch to click into beside the screenshots and
the checklist. A workflow on the pull request's `closed` event calls it again
with `--remove`, which replaces the line with a note.

```bash
canon pr local --json
canon pr local 1341 --remove --json
```

## How it finds the server

The verb reads every TCP socket in `LISTEN` with the process that owns it. It
keeps a socket when that process's working directory sits inside the
worktree's toplevel, including a subfolder, since some tools change into one
before they listen. It then requests `/` on each kept port and reports the
lowest one serving an HTML page.

The HTML test is there because a working tree often holds more than one
listener. A test runner's own server, or a dev server's reload socket, answers
HTTP too, and a reviewer opening either gets a bare 404 rather than the branch.

Sockets are read from `/proc/net/tcp` and `/proc/net/tcp6` wherever they exist,
matched against each process's `fd` table, and through `lsof` on a machine
without them. Linux reads `/proc` even with `lsof` installed, since `lsof` 4.95
drops a process whose truncated name holds an unmatched `(`, which is what
Next's `next-server (vX.Y.Z)` title is cut down to. A machine with neither
refuses as `no-listener-reader`.

The port is never derived from the worktree. A port helper needs a per-stack
base port the toolkit cannot know, and a server started by hand or by an
earlier session would not match it anyway.

## Why another worktree's server is never reported

A server running in a different worktree shows a different branch, and a link
to it on this pull request would show a reviewer the wrong code.

- A sibling linked worktree sits outside this one's toplevel, so its process
  never matches.
- The main checkout's server, read from a linked worktree, sits outside the
  linked worktree's toplevel for the same reason.
- A linked worktree's server, read from the main checkout, sits inside the main
  toplevel. The verb excludes everything under `.claude/worktrees/` for that
  case alone.

## What the record carries

`reason` on the record is what a caller branches on, not the exit code:

| Reason               | What it means                                                         |
| -------------------- | --------------------------------------------------------------------- |
| `ok`                 | A server answered. `url` carries the address and `port` the port.     |
| `no-server`          | Nothing inside this worktree served an HTML page.                     |
| `no-listener-reader` | Neither `lsof` nor `/proc` is available, so no socket could be read.  |
| `removed`            | `--remove` replaced the local line on the evidence comment.           |
| `no-comment`         | `--remove` found no comment carrying the evidence marker.             |
| `no-line`            | `--remove` found the comment but no local line on it.                 |
| `gh-missing`         | `--remove` needs `gh` and it is not on the path.                      |
| `gh-failed`          | `--remove` could not read the comments or could not edit the comment. |

The exit is 0 on `ok` and on every `--remove` outcome that finished, including
the two no-ops, and 1 on every refusal. A caller on an older binary gets an
unknown-subcommand error instead of a record, which `git-pr` reads as a skip.

## Removing the link at close

The link goes dead once the branch's server stops, and nothing on the pull
request says so. `--remove` runs on the pull request's `closed` event, merged or
abandoned, from a workflow seeded into every target:

```yaml
on:
  pull_request:
    types: [closed]
```

It reads the comment carrying the `pr-evidence` marker, replaces the
`**Local preview:**` line with the `--note` text, and edits the comment itself
through `gh api`. The verb writes here rather than handing a body back, because
its caller is a workflow with no session to post one. Every other byte of the
comment stays as it was, which keeps the marker, the checklist delimiters, and
any ticked box intact. A second run finds no line and reports `no-line`.

A fork pull request gets a read-only token, so the workflow skips the edit with
a notice rather than failing the close.

## What this does not cover

The link can still go dead while the pull request is open, such as when the
session holding the server retires. Only the close is covered, and a re-render
after a push carries the line forward whether the server still answers or not.

The hosted `**Preview:**` line from `canon pr preview` stays on the comment
after close, even though its deployments are deleted then. `canon docs
pr-preview` covers that path.
