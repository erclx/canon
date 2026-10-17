---
title: Machine plugins
description: The curated third-party plugin list the retired setup-plugins skill carried, kept as a record of what was picked and why
---

# Machine plugins

A record rather than a procedure. `setup-plugins` shipped a curated list of community and official Claude Code plugins and installed them user-scoped. The skill retired with the setup merge because it provisions a machine rather than a project, which no project-scoped chain can carry.

The install is one command per plugin and needs no skill around it.

```bash
claude plugin marketplace add <source>
claude plugin install <name> --scope user
```

The catalog has no other home, since it is content rather than procedure and no command reads it. Nothing loads this entry at install time, and a person setting up a new machine is its only reader.

## Decisions

### What was picked

Four plugins made the list, with `frontend-design` and `security-guidance` as the recommended pair.

| Plugin              | Category  | Marketplace source       | Why                                                                  |
| ------------------- | --------- | ------------------------ | -------------------------------------------------------------------- |
| `frontend-design`   | design    | `anthropics/claude-code` | Steers UI generation toward intentional typography, hierarchy, color |
| `security-guidance` | security  | `anthropics/claude-code` | Security-aware authoring guidance during code generation             |
| `code-review`       | review    | `anthropics/claude-code` | Multi-agent pull request review across compliance, bugs, and history |
| `superpowers`       | debugging | `obra/superpowers`       | Methodology skills: systematic-debugging, root-cause-tracing         |

The pair was recommended because design and security are the common gaps on a fresh machine. The other two were offered as additions rather than defaults.

`impeccable` sat in a second table because it distributes outside the plugin CLI. It installs through `npx impeccable skills install` into `.claude/` per project rather than per machine, since its skill invokes scripts by project-relative path. It is the one row whose install is not the two commands above.

## Gotchas

### What the list does not settle

`code-review` was picked because it runs on a pull request, where a local review skill beside it ran on a local diff. Claude Code now ships a `/code-review` command of its own, so that row is the likeliest to be overtaken, and no read has tested it against the harness.

- Every row is last verified against the tree `setup-plugins` was written in rather than the current one
- One note outlasts the rows. A plugin that over-triggers is answered by setting `skillOverrides` in settings to `name-only`, `user-invocable-only`, or `off`, rather than by uninstalling it.
