---
title: Machine plugins
description: The curated third-party plugin list the retired setup-plugins skill carried, kept as a record of what was picked and why
---

# Machine plugins

A record rather than a procedure. `setup-plugins` shipped a curated list of
community and official Claude Code plugins and installed them user-scoped, and
the skill retired with the setup merge because it provisions a machine rather
than a project, which is the one thing no project-scoped chain can carry. The
install itself is one command per plugin and needs no skill around it:

```bash
claude plugin marketplace add <source>
claude plugin install <name> --scope user
```

The catalog has no other home, since it is content rather than procedure and no
command reads it. Nothing loads this entry at install time, and a person setting
up a new machine is its only reader.

## What was picked

| Plugin              | Category  | Marketplace source       | Why                                                                  |
| ------------------- | --------- | ------------------------ | -------------------------------------------------------------------- |
| `frontend-design`   | design    | `anthropics/claude-code` | Steers UI generation toward intentional typography, hierarchy, color |
| `security-guidance` | security  | `anthropics/claude-code` | Security-aware authoring guidance during code generation             |
| `code-review`       | review    | `anthropics/claude-code` | Multi-agent pull request review across compliance, bugs, and history |
| `superpowers`       | debugging | `obra/superpowers`       | Methodology skills: systematic-debugging, root-cause-tracing         |

`frontend-design` and `security-guidance` were the recommended pair, on the
reading that design and security are the common gaps on a fresh machine. The
other two were offered as additions rather than defaults.

`impeccable` sat in a second table because it distributes outside the plugin CLI,
installing through `npx impeccable skills install` into `.claude/` per project
rather than per machine, since its skill invokes scripts by project-relative
path. That is the one row whose install is not the two commands above.

## What the list does not settle

`code-review` overlapped `review-branch` when it was picked, on the reading that
the two run in different places, the plugin on a pull request and the skill on a
local diff. Claude Code now ships a `/code-review` command of its own, which
makes that row the most likely of the four to be overtaken, and no read has
tested it against what the harness carries. Every row is last verified against
the tree `setup-plugins` was written in rather than the current one.

One note outlasts the rows above it, because it holds whatever the catalog says:
a plugin that over-triggers is answered by setting `skillOverrides` in settings
to `name-only`, `user-invocable-only`, or `off`, rather than by uninstalling it.
