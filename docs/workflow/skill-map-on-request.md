---
title: Skill map on request
description: When to reach for the plugin skills that serve a request rather than a moment in a project's life
category: Workflow
---

# Skill map on request

These skills serve a request rather than a moment. With the [skill map](skill-map.md) they cover every plugin skill once.

## Generate an artifact on demand

| Skill                     | When to use                                       |
| ------------------------- | ------------------------------------------------- |
| `canon:create-rule`       | A project rule the toolkit does not ship          |
| `canon:create-skill`      | A new `SKILL.md`                                  |
| `canon:draft-doc`         | A new `docs/` page, context entry, or `README.md` |
| `canon:draft-ready`       | Finished files a worker should copy               |
| `canon:draft-figure`      | A figure or architecture view inside a doc        |
| `canon:ci-workflow`       | A GitHub Actions workflow file                    |
| `canon:draft-slides`      | A deck rendered to editable PowerPoint            |
| `canon:draft-screencast`  | A recording script with beats seeded              |
| `canon:record-screencast` | Recording a screencast draft into a finished mp4  |
| `canon:draft-identity`    | A logo mark and social card                       |

## Answer a question at any point

| Skill                       | When to use                                           |
| --------------------------- | ----------------------------------------------------- |
| `canon:canon-cli`           | To pick a `canon` verb, or learn which can lose edits |
| `canon:youtube-transcripts` | A video transcript wanted as context                  |
| `canon:read-frames`         | To read a recorded demo back frame by frame           |
| `canon:teach-workspace`     | To learn a subject across sessions                    |
| `canon:markdown-craft`      | Before a substantial markdown edit                    |
| `canon:write-human`         | Before drafting or revising prose                     |

Ask `canon:teach-workspace` to promote a learning workspace's reference pages and glossaries. It proposes a destination per page and waits. An Anthropic-owned subject goes to the wiki, an internal one to the matching context entry, and the rest to the public docs. A project with no wiki folder gets a refusal naming `canon wiki init`.
