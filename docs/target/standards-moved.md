---
title: Target standards moved
description: Which skill owns each standard the retired standards verb used to serve, for a project that still calls it
category: Agent surface
---

# Target standards moved

`canon standards <name>` is gone, and with it the name map that sent an old call to a new home. A rule, skill, or `CLAUDE.md` of your own that still runs it now gets commander's too-many-arguments error and no content, so search the project for the call and replace it. The surrounding step is in [target migrations](migrations.md). <!-- canon-allow-reference: says the verb is gone -->

Each standard now lives at `references/<name>.md` in the skill that owns it. Load that skill and read the reference it names:

| Skill             | Standards                                                     |
| ----------------- | ------------------------------------------------------------- |
| `task-board`      | `board`, `tasks`, `tasks-decline`                             |
| `context-fold`    | `context`                                                     |
| `canvas-board`    | `canvas`, `design`                                            |
| `docs-sync`       | `docs`, `readme`                                              |
| `draft-figure`    | `figures`, `mermaid`                                          |
| `create-rule`     | `rule`                                                        |
| `create-skill`    | `skill`, `skill-paths`, `skill-practice`, `skill-requirement` |
| `git-branch`      | `branch`, `slug`                                              |
| `git-commit`      | `commit`, `versioning`                                        |
| `git-pr`          | `pr`, `publish`                                               |
| `markdown-craft`  | `markdown`                                                    |
| `teach-workspace` | `glossary`, `teach`                                           |
| `plan-groundwork` | `groundwork`, `groundwork-spikes`                             |
| `plan-intake`     | `intake`                                                      |
| `plan-feature`    | `plan`, `plan-lifecycle`                                      |
| `draft-ready`     | `ready`                                                       |
| `draft-doc`       | `requirements`, `wiki`                                        |
| `session-map`     | `session`                                                     |

One name moved under a new filename. `standard`, the shape of a standard itself, became `skill-reference.md` in `create-skill`, since the toolkit no longer ships a standards folder to hold one.
