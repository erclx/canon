---
title: Install command
description: Which install command session-worktree Step 6 names when a Node worktree has no dependencies, read off the lockfile beside the manifest in a fixed order
---

# Name the install command

Part of Step 6 of `session-worktree`. The session reads this file when the Node check reports dependencies not installed, to fill `<install>` in that line.

Take `<install>` from the lockfile beside the manifest, checked in this order, first match wins:

| Lockfile                  | Install command |
| ------------------------- | --------------- |
| `bun.lock` or `bun.lockb` | `bun install`   |
| `pnpm-lock.yaml`          | `pnpm install`  |
| `yarn.lock`               | `yarn install`  |
| `package-lock.json`       | `npm install`   |
| none of the above         | `bun install`   |

The order matters only when more than one lockfile sits beside the manifest, such as a project mid-migration between package managers. It is fixed rather than derived from anything about the project, so a reader hitting that rare case checks which manager the project actually uses rather than trusting the row the table picked first.
