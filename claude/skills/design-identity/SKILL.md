---
name: design-identity
description: Drafts a project's logo mark through design-pick's render-and-pick loop, then composes the picked mark into an icon sequence and a 1200x630 social card. Use when asked to "make a logo", "design a logo mark", "create a favicon", "build the icon set", "generate a social card", "make an og:image", or "draft the logo and social card together". Do NOT use to mutate an existing logo file directly, which is a plain edit, or to record the mark's construction rules in DESIGN.md, which is out of scope.
metadata:
  family: generate
---

# Design identity

One identity rendered twice: the same mark sized down to an icon sequence and composed with type into the social card sized up. Drafting both from one pick keeps the mark and its card composition from settling on shapes that do not match.

## Guards

- If `canon` is not on PATH, stop: `❌ canon CLI not found.`
- Draft no candidate for a mark the operator has not asked to make. This skill fires on a direct request, never on the model's own read that a project could use one.

## Step 1: read signal

Read these in parallel, skipping any that do not exist:

- `canon/DESIGN.md`: the `## Overview` paragraph and the role intents under `## Colors` and `## Typography`, read as `## Personality` and `## Color` in an older record
- The stylesheet `canon/DESIGN.md`'s lead names: the color and type values behind those roles
- `canon/REQUIREMENTS.md`: the `## Personality` paragraph, when `canon/DESIGN.md` carries none
- `CLAUDE.md`: the project's stated voice, when neither file above carries a personality signal

No signal from any of these is not a stop. Draft against a neutral default, and mark each guessed color and type value with a `/* ? verify */` comment beside its declaration in the `.mark` and `.card` markup, since the design document carries no value to tag.

## Step 2: detect the icon size sequence

Check the project's HTML entry points (`index.html`, `public/index.html`, `src/index.html`) for a `<link rel="icon">` or `<link rel="apple-touch-icon">` tag carrying a `sizes` attribute, and any `manifest.json` or `site.webmanifest` for an `icons` array. Take the union of every size found.

Fall back to the stated default when nothing is detected, since no `tooling/` stack scaffolds a `public/` folder, a favicon reference, or an `og:image` meta tag:

- `16x16`, `32x32`, `48x48`
- `180x180`
- `192x192`, `512x512`

This default set is raster-only, and Step 6 writes the vector source at `favicon.svg` on either branch. Announce which of the two decided the sequence.

## Step 3: detect the write folder

A root-only check misses a site kept in a subfolder, and a Next project keeps its favicon under the App Router with no `public/` at all. Both would fall through to the root while the announcement reads as detected, so walk one level down and know that convention.

Read both, from the project root:

```bash
find . -maxdepth 3 \( -name node_modules -o -name .git -o -name dist -o -name .astro \) -prune -o -type d \( -name public -o -name static \) -print | sort
find . -maxdepth 4 \( -name node_modules -o -name .git \) -prune -o -type d -path '*/src/app' -print | sort
```

Take the first tier that answers:

1. A root `public/` or `static/`.
2. A `public/` or `static/` one level down, such as `web/public/`. Of several, take the shallowest, then the one whose parent holds the project's framework config.
3. A `src/app/` folder, at the root or one level down, which is the Next App Router convention. Take the folder itself, not a `public/` beside it.
4. A stack-declared asset folder, where the project's own config names one.
5. The project root, which is the fallback rather than a detection.

Announce which tier decided, naming the tier rather than the path alone, so the operator can move the files where the project's convention differs. On tier 5 say the detection found nothing and the root is a fallback.

## Step 4: name the decision and the arms

Follow `${CLAUDE_SKILL_DIR}/../design-pick/SKILL.md` Step 1, with the decision fixed rather than derived: "the project's logo mark and its composition into the social card." Vary the mark's shape or style across arms, keeping the card's type and layout fixed, per that skill's one-property rule.

- Draft each arm inside the 1200x630 card frame, mark and type together, and add it with `frameboard frame add <page>/arm-<id> --width 1200 --height 630`, so one pick settles shape and composition
- Arm 0 is the current mark when the Step 3 folder already holds a logo file (`favicon.svg`, `favicon.ico`, `logo.svg`, or similar). Arms start at 1 otherwise.
- Structure every arm as a `.mark` element, the inline SVG alone, nested inside a `.card` element, the full composition, so Step 6 can address either

## Step 5: draft, render, pick, and loop

Follow `${CLAUDE_SKILL_DIR}/../design-pick/SKILL.md` Steps 2 through 5 against the arms from Step 4: draft the arms as frames on a Frameboard page, render and hand off, take the pick, and loop on it.

The final icon and card renders below are not arms, so they stay off the board. Call the folder they render from `<dest>`, being `.canon/tmp/<slug>/` under the slug `design-pick` Step 1 derived, which is where this project puts every temporary write.

## Step 6: finalize the mark and the icons

This step and Step 7 replace `design-pick`'s own Step 6 items 1 and 2, since the pick here produces several final files rather than one applied surface. Its archive capture, its page delete, and its server stop still run, after Step 7.

1. Extract the picked arm's `.mark` markup as the final vector source. Write it to `<write-folder>/favicon.svg`.
2. Under `<dest>/render/`, write one `icon-<w>x<h>.html` page per Step 2 size, carrying the picked `.mark` markup in an element with the shared class `.render`.
3. Declare each `.render` element at `<w>/2` by `<h>/2`, since `canon capture` screenshots at a fixed 2x scale and the PNG then lands on the target size.
4. Declare no font on them. Each holds the mark alone, and `canon capture` skips the font check on an element with no text, where `system-ui` would be refused.
5. Render the batch:

   ```bash
   canon capture <dest>/render --selector .render --out <write-folder>
   ```

6. Report each written file's path and the dimensions `canon capture` printed, confirming each equals its Step 2 target rather than half of it.

The card leaves this batch and takes Step 7 instead. An icon is the mark alone and a scratch page renders it faithfully, where the card composes the mark with the project's own type and color, which a scratch page can only copy.

## Step 7: write the card as a route and capture it through the server

A card captured from a page this run deletes leaves a PNG and nothing that produced it, so renaming the project means another pick loop to move one string. Write the composition into a route the project keeps, and capture it through a running server so it reads the real stylesheet, tokens, and fonts.

This is Astro-shaped for now, because Astro is the one web stack whose config gives a route a structural build exclusion. A project already holding the card route scaffold takes the route path, and everything else takes the page path. Say which one decided, since the two leave the project different things.

### The route path

Read `${CLAUDE_SKILL_DIR}/references/card-route.md` on reaching this path, for the scaffold check, the message to give when it is missing, and the write, serve, and capture sequence. A project with no scaffold skips it.

### The page path

Where the project holds no route to write into, write `og-image.html` into `<dest>/render/` with its `.render` wrapper sized 600x315, then capture that one page:

```bash
canon capture <dest>/render/og-image.html --selector .render --out <write-folder>
```

It takes its own call because Step 6's batch is already captured by the time this step picks a path. Say that the card shipped as a PNG with no source, and that the project gains one when it grows a route to hold the composition.

### Closing the scratch folder and the board

Delete `<dest>` once both captures land, then close the board through `design-pick` Step 6 items 3 to 8, which archive every arm and delete the pages the run added. The route is not a leftover variant, since it holds the arm the operator picked.

A project whose card was generated before this route existed keeps its PNG. Say so rather than regenerating it, since the pick loop spends attention on a file nobody complained about, and the next real edit picks up the route.

## Response format

```plaintext
📝 Wrote <write-folder>/favicon.svg
📝 Wrote <write-folder>/icon-16x16.png (16x16)
📝 Wrote card-src/pages/og-card.astro (route path only)
📝 Wrote <write-folder>/og-image.png (1200x630)

Write folder: <tier that decided>. Move the files if this project's own convention differs.
Card source: <the route, captured through the card server|a scratch page, since this project holds no card route>.
```

## What this delegates

Cite these rather than restating them.

- `design-pick` owns Steps 1 through 5 of the render-and-pick loop, cited above
- `canon:design-record` carries a picked direction into `canon/DESIGN.md`. This skill only reads it.
- `canon capture` owns the render mechanics, its font refusal, its fixed 2x scale, and its reported dimensions. It reads an `http(s)://` source, where `--out` names the PNG.
- The `astro` tooling stack owns the card route's scaffold, its second config, and the exclusion check, read with `canon tooling reference astro`. This skill writes into the route and never reshapes it.
