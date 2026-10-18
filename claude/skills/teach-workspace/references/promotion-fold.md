---
title: Fold promoted pages
description: How teach-workspace's fold mode lands each page a teach promotion handoff carries from a branch, deletes the handoff, and reports what it landed or left unfolded
---

# Fold promoted pages

The fold mode of `teach-workspace`, run from a branch in a worktree. The session reads this file when the invocation asks to fold confirmed promotions in.

## Read the handoff

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../git-branch/references/slug.md`, falling back to `latest` on an empty result, and read `.canon/tmp/handoff/teach-promotion/<slug>.md` at the main worktree root.

- `teach-workspace` writes it, one H2 per destination naming the path, a source line under the heading, and the page body fenced below that
- Read the body out of the fence rather than off the heading level, since a reference page carries headings of its own and only the fence separates them from the next destination
- Stop when the file is absent, reporting `❌ No promotion handoff at .canon/tmp/handoff/teach-promotion/<slug>.md. Run the promotion step from the workspace first.`

## Land each block

Each block is a page an operator already confirmed a destination for, so this step lands it rather than judging it again. Write to the destination the heading names at `pwd` rather than the main root, since every destination is a tracked file that commits with the branch.

- A wiki page and a public doc arrive as a whole file. Write it as the block gives it, and leave the block unfolded when the destination holds a file, since overwriting another's page is not a fold.
- A context entry is merged into rather than created. Fold the body into the sections it belongs under, and never add an entry the catalog does not already carry.

Then delete the handoff file so a later run does not fold it twice, and regenerate the index of any folder that carries one.

## Output

One line per page landed, one naming the handoff when one was consumed, and one per block left unfolded rather than dropped.

```plaintext
✅ Promoted: <destination path>
🧹 Folded: .canon/tmp/handoff/teach-promotion/<slug>.md
⚠ Skipped: <destination path> already exists. Merge by hand.
```
