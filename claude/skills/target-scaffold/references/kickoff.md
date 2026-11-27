---
title: Kickoff note reference
description: The six parts of the note a planning session leaves a newly scaffolded project, what stays out of it, and its template
---

# Kickoff note reference

The shape `target-scaffold` writes when a planning session scaffolds a project. One skill writes it and the new project's first session reads it once, so it lives beside that skill.

## Scope

Governs the six parts, the exclusions, and the opening prompts of the kickoff note at `.canon/tmp/kickoff/next-session.md` in a newly scaffolded project.

Does not govern:

- A handoff within one repository across a compaction: `../session-compact/references/handoff-note.md`
- The plan the note points at: `../plan-feature/references/plan.md`
- A task row the first session files from the note: `../task-create/references/tasks.md`
- Voice, rhythm, and sentence construction: the `write-human` skill
- Punctuation, formatting, and word choice: `../markdown-craft/references/markdown.md`

## Success criterion

A first session reading only this note and the files it names can answer four questions without asking the operator.

- Where does the plan or record behind this project live?
- What has setup already done, and what did it leave undone?
- Which session comes first, and which come after it?
- Which rows does the orchestrator file first, and from which part of the plan?

## The test every line passes

Does the new project lack this, and does the planning session hold it? A line failing either half comes out.

The new project's tree, its config, and its setup report survive on disk, so the note names the state they leave rather than copying them. The plan survives where it lives, so the note points at it rather than restating it.

## The six parts

### Where the plan lives

The absolute path of the plan, the groundwork record, or the design record the project came from, and one line naming what it is. The path may sit outside the repository, such as a planning repository or a personal vault. Name the section to read first when the record is long.

### The requirements record

Whether `canon/REQUIREMENTS.md` still holds the seed or already carries the problem, goals, and non-goals. When it holds the seed, name the part of the plan that fills it, so the first session writes it from the source rather than from memory.

### What setup did

Take the stack, the target, and the phases from the report `target-setup` closed on. Name what it skipped or failed and any step it left to the operator, since those are what the first session acts on. A clean phase needs no line.

### The next sessions

A numbered list of the sessions that come next, in order. Each item names the session's role and the one outcome that ends it.

- Put the requirements session first whenever the record still holds the seed, since every later session reads it
- Name a design session only when the project has a rendered surface
- End the list at the first feature, which the feature loop takes from there

### The first rows

The rows the orchestrator files on the new board once the operator agrees, each as a title and the plan section it comes from. These are candidates for the first rows, never rows themselves, since a row needs an origin the new board can cite and a filing the operator approves.

### The opening prompts

One fenced `plaintext` block per next session, in the order of that list. Each opening prompt starts by telling the session to read this note at its path, then names the skill or task the session runs. The first opening prompt is the one `target-scaffold` prints.

## What stays out

- The plan's decisions, its alternatives, or its reasoning. A second account drifts from the plan it copies.
- Private content copied from a record outside the repository. Cite the path and leave the content where it is.
- The tree, the file list, and the setup log, which the project already holds.
- A task file, a board row, or a line written under `.canon/tasks/`

## Where it lives

The note is gitignored scratch and stays that way. It may cite a path outside the repository or a private record, so it is never moved into a tracked file, committed, or pasted into a pull request. Once the first rows are filed and the first feature starts, the note has done its work and nothing reads it again.

## Template

````markdown
# Kickoff for <project>

Throwaway scratch from the planning session that scaffolded this project. The record below holds the detail.

## Where the plan lives

`<absolute path to the plan or record>`, <what it is>. Read <section> first.

## The requirements record

`canon/REQUIREMENTS.md` <holds the seed | is filled>. <Fill it from <section> of the plan.>

## What setup did

- Stack `<stack>` at `<target>`, setup phases <phases>
- <Skipped, failed, or left to the operator, one line each>

## The next sessions

1. <Role>: <the outcome that ends it>
2. <Role>: <the outcome that ends it>

## The first rows

- <Row title>, from <plan section>

## The opening prompts

### 1. <Role>

```plaintext
Read .canon/tmp/kickoff/next-session.md first. Then <skill or task, with its arguments>.
```
````
