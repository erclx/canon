---
title: Ready reference
description: Folder layout, ordinal naming, the overview frontmatter, the thin-plan contract, and the archive lifecycle for a finished-file handoff
---

# Ready reference

Applies to a ready folder at `.canon/ready/<nn>-<slug>/`. A warm session that has already written a skill, a rule, or another finished file uses it to hand the exact text to the worker that ships it, since a plan only describes a change and a cold worker reading a description writes the file again from scratch. The folder holds the finished files themselves, laid out at their destination paths, so the worker's job is to copy rather than to author.

The folder is gitignored, and backed wherever a records remote is configured: `canon records push` and `canon records pull` protect it against the machine being lost there, refuse with `no-remote` where it is not, and protect nothing against a folder deleted before anyone has pushed. That is why the archive step below is a move rather than a cleanup.

## Scope

Governs a ready folder under `.canon/ready/<nn>-<slug>/`: folder layout, ordinal naming, the overview's frontmatter, what the mirrored tree holds, the thin-plan contract that ships it, and the lifecycle from the live folder to the archive.

Does not govern:

- The thin plan itself, its filename, its sections, and its suggested-and-answer contract: `plan.md`
- The task file that reaches a ready folder through a plan, and the origin line pointing back at it: `tasks.md`
- Voice, rhythm, and sentence construction: the `write-human` skill
- Headings, punctuation, word choice, and file references: `markdown.md`
- Whether a change earns a ready folder over a plan a worker builds from scratch, which belongs to the warm session deciding how to hand off its own work

## What a working ready folder looks like

A ready folder works when a worker that has never seen the warm session's conversation can copy from it alone:

- Which destination path does each file land at, and does the folder hold nothing else?
- What is the worker still responsible for that the files themselves do not carry, such as a docs sync, a sandbox scenario, or a test?
- What branch type does the change take?
- Is every path the folder mirrors also declared in the thin plan's `**Files to touch:**`?

A ready folder failing these is non-conforming even when it satisfies every shape rule below.

## Folder name

- Name the folder `<nn>-<slug>`, a two-digit zero-padded ordinal followed by a kebab-case slug matching the plan's own slug.
- The ordinal marks a folder per handoff, opened once by the warm session that writes it. It runs on its own sequence, separate from groundwork and intake's shared one, since a ready folder is not a measurement track.
- With no folder holding an entry yet, the first one opened takes `01`. Read the highest existing `.canon/ready/<nn>-*/` folder, including the archive, and take the next integer.
- Never renumber an existing folder. The ordinal is the order it opened, and the pull request that shipped it cites the folder by that name.

## 00-overview.md

Every ready folder carries `00-overview.md` at its root, beside the mirrored tree. It orients the worker and states what the files themselves cannot.

- `title` (required): the change in sentence case
- `description` (required): one line naming what the handoff carries
- `type` (required): the branch type the plan should take, one of the types `branch.md` fixes
- `destinations` (required): the list of destination paths the folder mirrors, matching the thin plan's `**Files to touch:**` exactly

```yaml
---
title: <Change in sentence case>
description: <one line naming what the handoff carries>
type: <feat | fix | chore | ...>
destinations:
  - <path/to/file>
---
```

Below the frontmatter, state in prose what the worker still owns beyond copying the files: a docs sync, a sandbox scenario update, a test the files do not include, or "nothing further" where the files are the whole of the change.

## The mirrored tree

- Every other file in the folder sits at the same relative path its destination has in the project, so `standards/ready.md` inside the destination tree sits at `<nn>-<slug>/standards/ready.md` inside the ready folder.
- Carry no file the destination tree would not carry. A ready folder is a source for `git mv`-shaped copies, not a scratch pad for the warm session's own notes. Anything else belongs in the plan or in the pull request body.
- Write each file exactly as it should land. The worker copies verbatim and edits only what the gate or the overview's own list requires, so a placeholder or a half-finished passage ships as written.

## The thin-plan contract

- A ready folder ships through an ordinary task row and a plan at `.canon/plans/feature-<slug>.md`, per `plan.md`. No new plan shape exists for it.
- Name the ready folder in the plan's `**Constraints:**`, stating that the folder's files are the verbatim source for the paths the plan's `**Files to touch:**` lists.
- List every destination path in `**Files to touch:**`, matching `00-overview.md`'s `destinations` field. A path the plan omits is invisible to `plan-reach`'s collision check, so a mismatch between the two lists is a defect in the plan rather than a variant the standard permits.
- Keep the plan itself thin. Its `**Files to touch:**` entries may point at the ready folder's own copy for the reason behind each file rather than restating it, since the overview and the files already carry the detail a plan would otherwise duplicate.

## Lifecycle

- Write the ready folder in the same session that writes the files it carries. A folder assembled later from memory is a plan with extra steps, not a handoff.
- Move the folder to `.canon/ready/archive/<nn>-<slug>/` by hand when the task that shipped it archives. No board verb currently automates this move. `canon tasks archive` moves the task and its plan and leaves the ready folder where it is.
- Never delete a ready folder. The archived copy sits beside the merged pull request as the exact text that shipped, the way an archived plan sits beside the reasoning that produced it.

## Anti-patterns

- **The folder with an undeclared destination.** A file the plan's `**Files to touch:**` does not list passes the collision check unseen, and a second track can write the same path without either side finding out.
- **The rewritten copy.** A worker that reads the folder's files as inspiration and writes its own version loses the exact text the handoff exists to carry.
- **The folder as scratch.** Notes, alternates, or draft passages left in the folder beside the real files leave the worker guessing which is the source.
- **The folder left live after shipping.** A ready folder nobody moves to the archive reads as unshipped work to the next session that lists the live folder.

## Template

```markdown
.canon/ready/<nn>-<slug>/
├── 00-overview.md
└── <path/to/file> # mirrors the destination tree, one entry per file
```

```yaml
---
title: <Change in sentence case>
description: <one line naming what the handoff carries>
type: <feat | fix | chore | ...>
destinations:
  - <path/to/file>
---
```
