---
name: draft-identity
description: Drafts a project's logo mark through draft-and-pick's render-and-pick loop, then composes the picked mark into an icon sequence and a 1200x630 social card. Use when asked to "make a logo", "design a logo mark", "create a favicon", "build the icon set", "generate a social card", "make an og:image", or "draft the logo and social card together". Do NOT use to mutate an existing logo file directly, which is a plain edit, or to record the mark's construction rules in DESIGN.md, which is out of scope.
---

# Draft identity

One identity rendered twice: the same mark sized down to an icon sequence and composed with type into the social card sized up. Drafting both from one pick keeps the mark and its card composition from settling on shapes that do not match.

## Guards

- If `canon` is not on PATH, stop: `❌ canon CLI not found.`
- Draft no candidate for a mark the operator has not asked to make. This skill fires on a direct request, never on the model's own read that a project could use one.

## Step 1: read signal

Read these in parallel, skipping any that do not exist:

- `canon/DESIGN.md`: the `## Personality`, `## Color`, and `## Typography` sections, the same three cells `design-extract` Step 2 sources from
- `canon/REQUIREMENTS.md`: the `## Personality` paragraph, when `canon/DESIGN.md` carries none
- `CLAUDE.md`: the project's stated voice, when neither file above carries a personality signal

No signal from any of the three is not a stop. Draft against a neutral default and tag the color and type choices `? verify` per `${CLAUDE_SKILL_DIR}/../../standards/design.md`'s uncertainty tag.

## Step 2: detect the icon size sequence

Check the project's HTML entry points (`index.html`, `public/index.html`, `src/index.html`) for a `<link rel="icon">` or `<link rel="apple-touch-icon">` tag carrying a `sizes` attribute, and any `manifest.json` or `site.webmanifest` for an `icons` array. Take the union of every size found.

Fall back to the stated default when nothing is detected, since no `tooling/` stack scaffolds a `public/` folder, a favicon reference, or an `og:image` meta tag:

- `16x16`, `32x32`, `48x48`
- `180x180`
- `192x192`, `512x512`

This default set is raster-only. Step 6 already writes the vector source at `favicon.svg` regardless of which branch decided the sequence, so a project willing to reference an SVG favicon directly is covered either way.

Announce which of the two decided the sequence.

## Step 3: detect the write folder

Check for `public/`, `static/`, or a stack-declared asset folder, taking the first that exists. Fall back to the project root when none is detected, mirroring `design-extract`'s own source-versus-greenfield split. Announce the folder so the operator can move the files if the project's own convention differs.

## Step 4: name the decision and the arms

Follow `${CLAUDE_SKILL_DIR}/../draft-and-pick/SKILL.md` Step 1, with the decision fixed rather than derived: "the project's logo mark and its composition into the social card." Vary the mark's shape or style across arms, keeping the card's type and layout fixed, per that skill's one-property rule. Draft each arm already inside the full 1200x630 card frame, mark and type together, so the pick settles the shape and the composition in one choice. Arm 0 is the current mark when the folder from Step 3 already holds a logo file (`favicon.svg`, `favicon.ico`, `logo.svg`, or similar). Arms start at 1 otherwise.

Structure every arm as a `.mark` element, the inline SVG alone, nested inside a `.card` element, the full composition, so Step 6 can address either without re-deriving them.

## Step 5: draft, render, pick, and loop

Follow `${CLAUDE_SKILL_DIR}/../draft-and-pick/SKILL.md` Steps 2 through 5 against the arms from Step 4: author the page, render and hand off, take the pick, and loop on it.

## Step 6: finalize

This step replaces `draft-and-pick`'s own Step 6, since the pick here produces several final files rather than one applied surface.

1. Extract the picked arm's `.mark` markup as the final vector source. Write it to `<write-folder>/favicon.svg`.
2. Under `<dest>/render/`, write one page per Step 2 size plus one for the card. Give every page's captured element the shared class `.render`, so one capture call renders the whole batch regardless of the size spread. `canon capture` opens every page at a fixed 2x device scale factor and screenshots the element at that scale, so declare each `.render` element at half its target dimension, `<w>/2` by `<h>/2`, to land the captured PNG on the literal target size rather than double it. Declare a machine-resolved font stack (`system-ui` behind a generic fallback) on each, since `canon capture` refuses a page naming no font at all.
   - `icon-<w>x<h>.html`: the picked `.mark` markup, its `.render` wrapper sized `<w>/2` by `<h>/2`
   - `og-image.html`: the picked `.card` markup, its `.render` wrapper sized 600x315 to capture at the native 1200x630
3. Render the batch:

   ```bash
   canon capture <dest>/render --selector .render --out <write-folder>
   ```

4. Report each written file's path and the dimensions `canon capture` printed for it, confirming each equals its Step 2 target rather than half of it.
5. Delete `<dest>`, per `draft-and-pick`'s own scratch-folder rule.

## Response format

```plaintext
📝 Wrote <write-folder>/favicon.svg
📝 Wrote <write-folder>/icon-16x16.png (16x16)
📝 Wrote <write-folder>/og-image.png (1200x630)

Write folder: <detected <path>|defaulted to project root>. Move the files if this project's own convention differs.
```

## What this delegates

Cite these rather than restating them.

- `draft-and-pick` owns Steps 1 through 5 of the render-and-pick loop, cited above
- `design-extract` owns building `canon/DESIGN.md`. This skill only reads it.
- `canon capture` owns the render mechanics, its font refusal, and its reported dimensions
