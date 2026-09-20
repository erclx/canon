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

A root-only check misses most projects. Measured across four repositories on 2026-09-20, one kept `public/` at the root and was found, two kept theirs at `web/public/`, and one kept its favicon under `web/src/app/` with no `public/` anywhere. So three of four received their files at the repository root while the announcement reported a detected folder. Walk one level down and know the Next convention rather than falling through to the root.

Read both, from the project root:

```bash
find . -maxdepth 3 \( -name node_modules -o -name .git -o -name dist -o -name .astro \) -prune -o -type d \( -name public -o -name static \) -print | sort
find . -maxdepth 4 \( -name node_modules -o -name .git \) -prune -o -type d -path '*/src/app' -print | sort
```

Take the first tier that answers:

1. A root `public/` or `static/`.
2. A `public/` or `static/` one level down, such as `web/public/`. Where the first read returns more than one, take the shallowest, and the one whose parent holds the project's own framework config where two sit at the same depth.
3. A `src/app/` folder, at the root or one level down, which is the Next App Router convention and where that framework's own favicon and card files sit. Take the folder itself, not a `public/` beside it.
4. A stack-declared asset folder, where the project's own config names one.
5. The project root, which is the fallback rather than a detection.

Announce which tier decided, naming the tier rather than the path alone. On tier 5 say the detection found nothing and the root is a fallback, since a folder reported without that word reads as a folder the project declared. Announce it either way so the operator can move the files where the project's own convention differs.

## Step 4: name the decision and the arms

Follow `${CLAUDE_SKILL_DIR}/../draft-and-pick/SKILL.md` Step 1, with the decision fixed rather than derived: "the project's logo mark and its composition into the social card." Vary the mark's shape or style across arms, keeping the card's type and layout fixed, per that skill's one-property rule. Draft each arm already inside the full 1200x630 card frame, mark and type together, so the pick settles the shape and the composition in one choice. Arm 0 is the current mark when the folder from Step 3 already holds a logo file (`favicon.svg`, `favicon.ico`, `logo.svg`, or similar). Arms start at 1 otherwise.

Structure every arm as a `.mark` element, the inline SVG alone, nested inside a `.card` element, the full composition, so Step 6 can address either without re-deriving them.

## Step 5: draft, render, pick, and loop

Follow `${CLAUDE_SKILL_DIR}/../draft-and-pick/SKILL.md` Steps 2 through 5 against the arms from Step 4: author the page, render and hand off, take the pick, and loop on it.

## Step 6: finalize the mark and the icons

This step and Step 7 replace `draft-and-pick`'s own Step 6, since the pick here produces several final files rather than one applied surface.

1. Extract the picked arm's `.mark` markup as the final vector source. Write it to `<write-folder>/favicon.svg`.
2. Under `<dest>/render/`, write one `icon-<w>x<h>.html` page per Step 2 size, carrying the picked `.mark` markup. Give every page's captured element the shared class `.render`, so one capture call renders the whole batch regardless of the size spread. `canon capture` opens every page at a fixed 2x device scale factor and screenshots the element at that scale, so declare each `.render` element at half its target dimension, `<w>/2` by `<h>/2`, to land the captured PNG on the literal target size rather than double it. Declare a machine-resolved font stack (`system-ui` behind a generic fallback) on each, since `canon capture` refuses a page naming no font at all.
3. Render the batch:

   ```bash
   canon capture <dest>/render --selector .render --out <write-folder>
   ```

4. Report each written file's path and the dimensions `canon capture` printed for it, confirming each equals its Step 2 target rather than half of it.

The card leaves this batch and takes Step 7 instead. An icon is the mark alone at a fixed size and a scratch page renders it faithfully, where the card is a composition of the mark with the project's own type and color and a scratch page can only carry typed copies of both.

## Step 7: write the card as a route and capture it through the server

A card captured from a page this run deletes leaves the project a PNG and nothing that produced it, so renaming the project means another pass through the pick loop with an operator in it to move one string. Write the composition into a route the project keeps, and capture that route through a running server so it reads the project's real stylesheet, tokens and fonts.

This is Astro-shaped in v1, and the narrowing is measured rather than a deferral. A project already holding the card route scaffold takes the route path. Everything else falls to the page path below. Say which one decided, since the two leave the project different things.

### The route path

1. Check that the project already holds the scaffold, being a `card.config.mjs` with a `card-src/pages/og-card.astro` beside it. Take the page path below where either is missing, and leave the install to the operator:

   ```plaintext
   No card route installed, so the card shipped as a PNG this run.
   `canon tooling sync astro . --write` installs the route, and it replaces every other
   golden config in the astro stack, so run it when you mean to sync the stack.
   ```

   Never run that sync to obtain the route. It copies the whole stack over the project's own framework, lint, typescript, and test configs, which is a cost nobody asking for a logo agreed to. Hand-writing the scaffold instead is the other wrong answer, since a copy written here drifts from the one the stack maintains.

   The scaffold is a second framework config pointing `srcDir` at a folder beside `src/`, the route inside that folder importing the project's global stylesheet and carrying a fixed `<meta>` marker, and a shell check failing a build that carries the marker. Of the route's three consumers, the published build is the only one a check reaches. Read the shape with `canon tooling reference astro`.

2. Write the picked arm's `.card` markup into the route's `.card` element, leaving the marker, the stylesheet import and the surrounding document alone. Keep the element at 600x315, half of the 1200x630 target, since the capture's 2x scale factor is fixed and a 1200x630 element captures at 2400x1260.

3. Start the card server in the background and read the port off its own output:

   ```bash
   bun run card:dev
   ```

   It serves under a strict port, so it refuses rather than walking to the next free one. Set `WORKTREE_PORT_OFFSET` by hand and start it again where something already holds that port.

4. Capture the route to the write folder, naming the destination PNG rather than a directory, which is what a URL source takes for `--out`:

   ```bash
   canon capture http://localhost:<port>/og-card --selector .card --out <write-folder>/og-image.png
   ```

5. Stop the server. Report the dimensions `canon capture` printed, confirming 1200x630.

A refusal naming a font here is the mechanism working rather than a failure to route around. It says the route asked for a family the machine cannot resolve, which is the same rewrap a published card would have shipped silently.

### The page path

Where the project holds no route to write into, write `og-image.html` into `<dest>/render/` with its `.render` wrapper sized 600x315, then capture that one page:

```bash
canon capture <dest>/render/og-image.html --selector .render --out <write-folder>
```

It takes its own call rather than riding Step 6's batch, since Step 6 runs before this step chooses a path and the batch is already captured by the time the choice is made. Say that the card shipped as a PNG with no source, and that the project gains one when it grows a route to hold the composition.

### Closing the scratch folder

Delete `<dest>` per `draft-and-pick`'s own scratch-folder rule. The route is not a leftover variant that rule forbids: a variant is one of several candidates none of which was chosen, and the route holds the arm the operator picked. The losing arms are what that rule is about, and they are already archived and deleted by the step it belongs to.

A project whose card was generated before this route existed keeps its PNG. Say so rather than regenerating it, since re-running the pick loop spends an operator's attention on a file nobody complained about, and the next real edit to the card picks up the route.

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

- `draft-and-pick` owns Steps 1 through 5 of the render-and-pick loop, cited above
- `design-extract` owns building `canon/DESIGN.md`. This skill only reads it.
- `canon capture` owns the render mechanics, its font refusal, its fixed 2x scale factor, and its reported dimensions. It already reads an `http(s)://` source, where `--out` names the destination PNG rather than a directory, so the route capture needs nothing added to it.
- The `astro` tooling stack owns the card route's scaffold, its second config, and the exclusion check, read with `canon tooling reference astro`. This skill writes into the route and never reshapes it.
