---
name: sketch-design
description: Runs a reference-and-pick loop against operator-supplied images and URLs, then writes the picked reference's traced color, type, and spacing values to a handoff file `design-extract` reads. Use when asked to "sketch a design direction", "compare these reference sites", "pick a look before we build DESIGN.md", "show me a few design directions", or as the first move on `design-extract`'s greenfield path when nothing has been rendered yet. Do NOT use when a value is already anchored to running code or a stylesheet, which is `design-extract`'s source path, or to draft the design system document itself, which stays `design-extract`'s job.
---

# Sketch design

`design-extract`'s greenfield path proposes color, type, and spacing from a personality paragraph alone, with no render behind any value. This skill puts operator-supplied references in front of a render instead, so the values `design-extract` fills are traced to a picked reference rather than invented from prose.

## Guards

- If `canon` is not on PATH, stop: `❌ canon CLI not found.`
- Draft no comparison for a reference set the operator has not supplied. This skill fires on a direct request or on `design-extract` pointing at it, never on the model's own read that a project could use one.

## Step 1: gather the references and render what needs it

Ask the operator, in this step's own prompt, for the references to compare: a path to an image already on disk for each one already rendered somewhere, and a full URL for each live page to render. Take at least two.

Follow `${CLAUDE_SKILL_DIR}/../draft-and-pick/SKILL.md` Step 1 items 2 through 5 to name the decision and derive `<dest>`, with the decision fixed rather than derived: "which of these references the project's design should draw from." Arm 0 is the current state when `canon/DESIGN.md` already carries filled Color, Typography, or Spacing cells. Arms start at 1 otherwise, since a greenfield project asking for this loop has nothing shipped yet to anchor a baseline arm against.

Render every URL reference before drafting, one call per reference since each targets its own file:

```bash
canon capture <url> --selector body --out <dest>/refs/arm-<id>.png
```

`--selector body` is the right choice here, unlike inside `draft-and-pick`'s own arms: the page belongs to someone else, so nothing on it is a wrapper this skill can name, and a full-page render is what a reference comparison needs. An operator-supplied image needs no render. Reference it directly from `<dest>/refs/` by copying it there under the same `arm-<id>` naming, so every arm resolves through one path shape regardless of source.

`canon capture <url>` reaches a target only once a release ships the URL-source capability. Report a refusal naming an unrecognized source as that gap rather than a broken reference, and name upgrading the installed `canon` as the repair.

## Step 2: author the candidate set as one page

Follow `${CLAUDE_SKILL_DIR}/../draft-and-pick/SKILL.md` Step 2, with one substitution: each arm is an `<img>` of the file `<dest>/refs/arm-<id>.png` produced in Step 1, not markup drafted from scratch. Wrap each in the shared class that skill's Step 2 fixes, label it with its id and its cost, and inline everything else the page needs, per that step's rules.

## Step 3: render, hand off, and take the pick

Follow `${CLAUDE_SKILL_DIR}/../draft-and-pick/SKILL.md` Steps 3 and 4 unchanged: render the combined page, hand over the address, and put the choice to the operator through the structured question surface.

## Step 4: loop, when the operator asks for a change

The arms here are fixed references rather than drafted markup, so nothing about a picked arm's own content can be revised. A loop here narrows the set instead: drop an arm the operator rules out, or add a new reference by returning to Step 1 for it alone. Return to Step 2 with the adjusted set and repeat Step 3. Stop when the operator says the pick is right, the same rule `draft-and-pick` Step 5 states, never when the set stops changing.

## Step 5: trace and write the handoff

1. Ask the operator to state, in their own words, why the picked reference won. Carry that sentence forward as written rather than paraphrasing it.
2. Read the picked arm's render at `<dest>/refs/arm-<id>.png` and trace its color, type, and spacing by looking, the same reading a person does against a screenshot. Name a role only where the reference actually shows it. Leave one out rather than guessing.
3. Write `.canon/review/evidence/<slug>/design-handoff.md`, resolved against the main worktree root rather than the linked worktree this run may be building in, since shared session scratch always resolves there. One field per line, grouped under the section names `${CLAUDE_SKILL_DIR}/../../standards/design.md` fixes, so `design-extract` reads it mechanically:

   ```markdown
   # Design handoff

   Picked: arm-<id> (<label>)
   Reason: <the operator's own sentence from item 1>

   ## Color

   - <role>: <hex>

   ## Typography

   - <role>: <family>, <size>

   ## Spacing

   - base unit: <value>

   ## Borders

   - <role>: <radius>, <width>
   ```

   Write only the sections and roles the trace actually names. A role or a whole section with nothing traced is left out rather than written empty, since `design-extract` Step 2 treats an absent line as untraced and an empty one as a claim about the source.

4. Batch-capture the final round's arm files, the same directory-batch convention `draft-and-pick` Step 6 uses: `canon capture <dest>/arms --selector <wrapper-class> --out .canon/review/evidence/<slug>/`, naming Step 2's chosen class, so every arm considered, not only the winner, survives past the pick as a revert record.
5. Delete `<dest>` and everything in it, now that the handoff and the arms both sit at the durable path above. Report the path as still standing when the delete is refused, rather than closing on a report the tree contradicts.

## Response format

```plaintext
📝 Wrote .canon/review/evidence/<slug>/design-handoff.md
📝 Wrote .canon/review/evidence/<slug>/arm-<id>.png (and every other arm considered)

Picked arm-<id>: <label>. Run /canon:design-extract to fill canon/DESIGN.md from the trace.
```

## What this delegates

Cite these rather than restating them. A step reimplemented here rots against the skill that owns it.

- `draft-and-pick` owns the candidate page, the render and hand-off, the structured pick, and the archival capture convention, cited above
- `design-extract` reads the handoff file this skill writes and fills `canon/DESIGN.md` from it. This skill never writes that file itself.
- `canon capture` owns the render mechanics, including the URL source and its font refusal
