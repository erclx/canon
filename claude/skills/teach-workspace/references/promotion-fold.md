---
title: Fold promoted pages
description: How teach-workspace's fold mode lands each page a teach promotion handoff carries from a branch, deletes the handoff, and reports what it landed or left unfolded
---

# Fold promoted pages

The fold mode of `teach-workspace`, run from a branch in a worktree. The session reads this file when the invocation asks to fold confirmed promotions in.

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`, falling back to `latest` on an empty result, and read `.canon/tmp/handoff/teach-promotion/<slug>.md` at the main worktree root. `teach-workspace` writes it, one H2 per destination naming the path, with a source line under the heading and the page body in a fenced block below that. Read the body out of the fence rather than off the heading level, since a reference page carries headings of its own and only the fence separates them from the next destination. Stop when the file is absent, reporting `❌ No promotion handoff at .canon/tmp/handoff/teach-promotion/<slug>.md. Run the promotion step from the workspace first.`

Each block is a page an operator already confirmed a destination for, so this step lands it rather than judging it again. Write to the destination the heading names, at `pwd` rather than at the main root, since every destination here is a tracked file that commits with the branch:

- A wiki page and a public doc arrive as a whole file. Write it as the block gives it, and stop with the block unfolded when the destination path already holds a file, since overwriting a page someone else wrote is not a fold.
- A context entry is merged into rather than created. Fold the body into the sections it belongs under, and never add an entry the catalog does not already carry.

Then delete the handoff file so a later run does not fold it twice, and regenerate the index of any folder that carries one.

Output one line per page landed:

`✅ Promoted: <destination path>`

Add a line naming the handoff when one was consumed:

`🧹 Folded: .canon/tmp/handoff/teach-promotion/<slug>.md`

Report a block left unfolded rather than dropping it:

`⚠ Skipped: <destination path> already exists. Merge by hand.`
