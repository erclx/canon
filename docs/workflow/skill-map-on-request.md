---
title: Skill map on request
description: When to reach for the plugin skills that serve a request rather than a moment in a project's life
category: Workflow
---

# Skill map on request

These skills serve a request rather than a moment. With the [skill map](skill-map.md) they cover every plugin skill once.

## Generate an artifact on demand

| Skill                     | When to use                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `canon:create-rule`       | A project rule the toolkit does not ship                                           |
| `canon:create-skill`      | A new `SKILL.md`                                                                   |
| `canon:write-doc`         | A new `docs/` page, context entry, or `README.md`                                  |
| `canon:draft-doc`         | Never on purpose. A pointer naming `write-doc` <!-- canon-keep-retired -->         |
| `canon:plan-ready`        | Finished files a worker should copy                                                |
| `canon:draft-ready`       | Never on purpose. A pointer naming `plan-ready` <!-- canon-keep-retired -->        |
| `canon:draw-figure`       | A figure or architecture view inside a doc                                         |
| `canon:draft-figure`      | Never on purpose. A pointer naming `draw-figure` <!-- canon-keep-retired -->       |
| `canon:ci-workflow`       | A GitHub Actions workflow file                                                     |
| `canon:make-deck`         | A deck rendered to editable PowerPoint                                             |
| `canon:draft-slides`      | Never on purpose. A pointer naming `make-deck` <!-- canon-keep-retired -->         |
| `canon:script-screencast` | A recording script with beats seeded                                               |
| `canon:draft-screencast`  | Never on purpose. A pointer naming `script-screencast` <!-- canon-keep-retired --> |
| `canon:record-screencast` | Recording a screencast draft into a finished mp4                                   |
| `canon:design-identity`   | A logo mark and social card                                                        |
| `canon:draft-identity`    | Never on purpose. A pointer naming `design-identity` <!-- canon-keep-retired -->   |

## Answer a question at any point

| Skill                       | When to use                                           |
| --------------------------- | ----------------------------------------------------- |
| `canon:canon-cli`           | To pick a `canon` verb, or learn which can lose edits |
| `canon:youtube-transcripts` | A video transcript wanted as context                  |
| `canon:read-frames`         | To read a recorded demo back frame by frame           |
| `canon:teach-workspace`     | To learn a subject across sessions                    |
| `canon:teach-craft`         | To teach a subject so it sticks                       |
| `canon:markdown-craft`      | Before a substantial markdown edit                    |
| `canon:write-human`         | Before drafting or revising prose                     |

Ask `canon:teach-workspace` to promote a learning workspace's reference pages and glossaries. It proposes a destination per page and waits. An Anthropic-owned subject goes to the wiki, an internal one to the matching context entry, and the rest to the public docs. A project with no wiki folder gets a refusal naming the folder to create.
