---
title: Skill map on request
description: When to reach for the plugin skills that serve a request rather than a moment in a project's life
category: Workflow
---

# Skill map on request

These two groups hold the skills no single moment in a project's life calls for, so they sit apart from the moment-ordered groups in the [skill map](skill-map.md). The two pages together are the corpus the coverage claim is measured against, and a skill takes one row across both.

## Generate an artifact on demand

| Skill                     | When to use                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `canon:create-rule`       | For a project-specific governance rule the toolkit does not ship                                                            |
| `canon:create-skill`      | For a new `SKILL.md`                                                                                                        |
| `canon:draft-doc`         | For a brand-new `docs/` page, context entry, wiki reference page, or `README.md`, drafted against the standard for its kind |
| `canon:draft-ready`       | For finished files a worker should copy, written as a ready folder with its overview, thin plan, and task                   |
| `canon:draft-figure`      | For a hand-drawn figure or an architecture view inside an existing doc, drafted in Mermaid or freehand SVG                  |
| `canon:ci-workflow`       | For a GitHub Actions workflow file                                                                                          |
| `canon:draft-slides`      | For a deck, drawn as HTML slides in its own folder and rendered to editable PowerPoint                                      |
| `canon:draft-screencast`  | For a recording script with beats and defaults already seeded                                                               |
| `canon:record-screencast` | For recording a screencast draft, then composing the take into a finished mp4 when the draft asks for a wrap                |
| `canon:draft-identity`    | For a project's logo mark and its social card, drafted through `draft-and-pick`'s pick loop                                 |

## Answer a question at any point

| Skill                       | When to use                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canon:canon-cli`           | Before running an unfamiliar verb, a sync, or an install, to learn which command to run, which reference doc covers it, or what it overwrites, merges, or leaves alone |
| `canon:youtube-transcripts` | When a video transcript is wanted in the repo as context                                                                                                               |
| `canon:read-frames`         | To read a recorded demo back frame by frame and report what each one shows, with no verdict on whether the recording looks right                                       |
| `canon:teach-workspace`     | To learn a subject across sessions, in a workspace that holds the progress                                                                                             |
| `canon:markdown-craft`      | Before a substantial markdown edit, for the format and structure rules and the audit that follows                                                                      |
| `canon:write-human`         | Before drafting or revising prose, for voice, rhythm, and density                                                                                                      |
| `canon:restate-plainly`     | When an answer or a document has to be read again in plain words                                                                                                       |

Every row answers a question rather than marking a point in a project's life, so filing one under a phase on the [skill map](skill-map.md) would send a reader to the wrong group.

A learning workspace produces two halves and only one of them leaves. A lesson is worked through once and stays in the workspace, and a reference page or a glossary carries no learner, so it belongs wherever the project already keeps prose on that subject. Asking `canon:teach-workspace` to promote sorts each durable page by who owns its subject, sending an Anthropic-owned subject to the wiki, an internal one to the matching context entry, and everything else, subject-neutral material included, to the public docs. It proposes and waits, because a promoted page is public prose that needs a line naming who owns the subject, and it writes nothing to a destination: each page the operator confirms goes to a handoff file that `canon:context-fold` folds in from a branch. A project with no wiki folder gets a refusal naming `canon wiki init` rather than a folder it never asked for.
