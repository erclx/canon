---
name: sketch-design
description: Why a greenfield design value needs a render behind it before it reaches DESIGN.md, and where the reference loop stops short of writing that file itself
---

# Sketch design requirement

## Gap

Without this skill, a session asked to match a look an operator has in mind either invents token values from a personality paragraph alone, which is what `design-extract`'s greenfield path already does and states plainly as a proposal rather than a fact, or builds a one-off render-and-pick comparison by hand for each request, restating `draft-and-pick`'s candidate page, hand-off, and pick mechanics from scratch with nothing comparing the copy to the shipped one. Neither path lets an operator point at a reference image or a live page and have the values that follow trace back to what was actually looked at and picked.

## Must

- Take at least two operator-supplied references, each a path to an image on disk or a URL to render, and gather them through this skill's own Step 1 prompt rather than a caller-supplied argument
- Render every URL reference before drafting, and report a capture refusal naming an unrecognized source as a version gap rather than a broken reference
- Follow `draft-and-pick`'s candidate page, render, hand-off, structured pick, and archival capture mechanics rather than restating them
- Trace the picked reference's color, type, and spacing by reading its render, and carry the operator's own stated reason for the pick forward as written
- Write the handoff one field per line, grouped under the section names `standards/design.md` already fixes for `canon/DESIGN.md`, so `design-extract` can read it mechanically
- Resolve the handoff file and the archival capture against the main worktree root, never against a linked worktree this run happens to be building in

## Must not

- Write to `canon/DESIGN.md`. Tracing values into the handoff is this skill's whole output. Filling the design document from them is `design-extract`'s Step 2, kept as the one place that file is written.
- Take the pick on the operator's behalf. That call is theirs on every arm that is defensible, the same boundary `draft-and-pick` states for itself.
- Restate `draft-and-pick`'s render, hand-off, pick, or loop mechanics, or `canon capture`'s render mechanics
- Assume this skill's own invocation frequency needs no check. `design-extract` Step 1 points to it as the first move on the greenfield path, and an operator can also type its name directly, so whether anything else reaches for it has an answer only after a review pass reads usage back, rather than at creation time.

## Guards

- `canon` not on PATH: stop, since the render loop and the capture calls both need it
- Fires on a direct request or on `design-extract`'s own pointer, never on the model's own read that a project could use a design direction

## Out of scope

- `design-extract` reads the handoff this skill writes and fills `canon/DESIGN.md` from it. That fill, and the seed template it starts from, stay entirely that skill's own.
- `draft-and-pick` owns the render, hand-off, pick, and loop mechanics this skill invokes rather than reimplements
- `canon capture` and `canon serve` own the render and the address mechanics
- Auditing an implemented UI against its tokens, which `ux-audit` owns
