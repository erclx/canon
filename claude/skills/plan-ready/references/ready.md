---
title: Ready reference
description: Folder layout, ordinal naming, the overview frontmatter, the thin-plan contract, and the archive lifecycle for a finished-file handoff
---

# Ready reference

Applies to a ready folder at `.canon/ready/<nn>-<slug>/`. A warm session that has already written a finished file uses it to hand the exact text to the worker that ships it, since a cold worker reading a plan's description writes the file again from scratch.

The folder holds the finished files at their destination paths, so the worker copies rather than authors. It is gitignored, which is why the archive step below is a move rather than a cleanup.

- Where a records remote is configured, `canon records push` and `canon records pull` protect it against the machine being lost
- Where none is, they refuse with `no-remote`
- Neither protects a folder deleted before anyone has pushed

## Contents

- [Scope](#scope)
- [What a working ready folder looks like](#what-a-working-ready-folder-looks-like)
- [Folder name](#folder-name)
- [00-overview.md](#00-overviewmd) <!-- canon-allow-reference: a heading anchor, not a pull request number -->
- [The mirrored tree](#the-mirrored-tree)
- [The thin-plan contract](#the-thin-plan-contract)
- [Lifecycle](#lifecycle)
- [Anti-patterns](#anti-patterns)
- [Template](#template)

## Scope

The `plan-ready` skill owns the procedure, and this standard owns the shape. It governs a ready folder under `.canon/ready/<nn>-<slug>/`, being its layout, ordinal naming, the overview's frontmatter, what the mirrored tree holds, the thin-plan contract that ships it, and the lifecycle from the live folder to the archive.

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
- Is every path the folder mirrors also declared in the thin plan's `## Files to touch`?

A ready folder failing these is non-conforming even when it satisfies every shape rule below.

## Folder name

- Name the folder `<nn>-<slug>`, a two-digit zero-padded ordinal followed by a kebab-case slug matching the plan's own slug.
- The ordinal marks a folder per handoff, opened once by the warm session that writes it
- It runs on its own sequence, separate from groundwork and intake's shared one, since a ready folder is not a measurement track
- The first folder opened takes `01`. After that, read the highest existing `.canon/ready/<nn>-*/` folder, including the archive, and take the next integer.
- Never renumber an existing folder. The ordinal is the order it opened, and the pull request that shipped it cites the folder by that name.

## 00-overview.md

Every ready folder carries `00-overview.md` at its root, beside the mirrored tree. It orients the worker and states what the files themselves cannot.

- `title` (required): the change in sentence case
- `description` (required): one line naming what the handoff carries
- `type` (required): the branch type the plan should take, one of the types `branch.md` fixes
- `destinations` (required): the list of destination paths the folder mirrors, matching the thin plan's `## Files to touch` exactly

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

The overview body and the thin plan both hold to the six structure criteria under `### Structure` in `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md`. The mirrored files are exempt, since each lands as its destination's own standard fixes.

## The mirrored tree

Every other file in the folder sits at the same relative path its destination has in the project.

- For example, `standards/ready.md` in the destination tree sits at `<nn>-<slug>/standards/ready.md` in the ready folder <!-- canon-allow-reference: a target tree -->
- Carry no file the destination tree would not carry. The folder is a source for `git mv`-shaped copies, never a scratch pad, and anything else goes in the plan or the pull request body.
- Write each file exactly as it should land. The worker copies verbatim and edits only what the gate or the overview's list requires, so a placeholder ships as written.

## The thin-plan contract

- A ready folder ships through an ordinary task row and a plan at `.canon/plans/feature-<slug>.md`, per `plan.md`. No new plan shape exists for it.
- Name the ready folder in the plan's `## Constraints`, stating that the folder's files are the verbatim source for the paths the plan's `## Files to touch` lists.
- List every destination path in `## Files to touch`, matching `00-overview.md`'s `destinations` field
- A path the plan omits is invisible to `plan-reach`'s collision check, so a mismatch between the two lists is a defect in the plan, not a variant
- Keep the plan thin. Its `## Files to touch` entries may point at the folder's copy for the reason behind each file, since the overview and the files carry that detail.

## Lifecycle

- Write the ready folder in the same session that writes the files it carries. A folder assembled later from memory is a plan with extra steps, not a handoff.
- Leave the move to `canon tasks archive`, which carries the folder to `.canon/ready/archive/<nn>-<slug>/` with its plan when the shipping task archives, retargeting its `Ready:` line
- A plan another live task still cites keeps its folder
- Never delete a ready folder. The archived copy sits beside the merged pull request as the exact text that shipped, the way an archived plan sits beside the reasoning that produced it.

## Anti-patterns

- **The folder with an undeclared destination.** A file the plan's `## Files to touch` omits passes the collision check unseen, so a second track can write the same path with neither side finding out.
- **The rewritten copy.** A worker that reads the folder's files as inspiration and writes its own version loses the exact text the handoff exists to carry.
- **The folder as scratch.** Notes, alternates, or draft passages left in the folder beside the real files leave the worker guessing which is the source.
- **The folder left live after shipping.** An unmoved folder reads as unshipped work to the next session listing it. The verb skips one whose task has no `Ready:` line and whose plan cites no folder.

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
