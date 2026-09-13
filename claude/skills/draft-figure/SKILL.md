---
name: draft-figure
description: Drafts one hand-drawn figure for a document, deciding whether the subject is Mermaid-shaped or needs freehand SVG, then draws it. Renders the Mermaid path through Mermaid's own hand-drawn look, reads the render back, and fixes what it exposes. Wraps either path in the figure standard's caption, color, and accessibility rules. Use when asked to "draw a figure", "add a hand-drawn diagram", "draft a figure for this doc", or "draw this relationship as a figure". Do NOT use for the toolkit's own `.canon/diagrams/` architecture surface, which is `draft-diagram`, or for a UI wireframe, which is `draft-wireframes`.
---

# Draft figure

Decide whether a requested figure reduces to a graph Mermaid can draw, or needs freehand SVG, then draw it and verify what a reader will actually see.

## Guards

- If no subject is given, stop: `❌ No subject given. Name the relationship, boundary, path, or before-and-after this figure should show.`
- If no destination document is given, stop: `❌ No destination given. Name the file this figure belongs in.`

## Step 1: read sources

Read these in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/figures.md`: when a figure earns its place, the render-first policy, wrapping and captioning, and the color and accessibility rules
- `${CLAUDE_SKILL_DIR}/../../standards/mermaid.md`: direction and layout, node and edge budgets, the accessibility fields, and how a render is verified, for the Mermaid path
- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: banned words and formatting for the caption prose
- The `write-human` skill: voice and rhythm for the caption prose

## Step 2: does it earn its place

Apply the standard's bar: a relationship, a boundary, a path, or a before-and-after that prose or a list cannot carry as well. Stop when it does not: `❌ <subject> reads fine as prose. A figure adds nothing here.`

## Step 3: decide the render path

- **Graph-shaped**, meaning the relationship, boundary, or path is already what a flowchart or sequence diagram expresses: draw it through Step 4.
- **Not graph-shaped**, meaning the subject is a spatial or physical arrangement no flowchart reduces to: draw it through Step 5.

State which path was picked and why in one sentence. The standard states this as a render-first policy rather than a ban on any tool-exported drawing, so a graph-shaped subject always routes through Mermaid even though that is itself an external renderer.

## Step 4: the Mermaid path

- Draft the fence against `mermaid.md`: direction, node and edge budgets, `accTitle`/`accDescr`, and quoted labels.
- Render it with the hand-drawn look and the figure font stack, writing scratch files under `.canon/tmp/figures/`:

```bash
mkdir -p .canon/tmp/figures
cat <<'EOF' >.canon/tmp/figures/<slug>.json
{"look": "handDrawn", "themeVariables": {"fontFamily": "Virgil, Excalifont, cursive"}}
EOF
bunx -y @mermaid-js/mermaid-cli -i .canon/tmp/figures/<slug>.mmd -o .canon/tmp/figures/<slug>.svg -c .canon/tmp/figures/<slug>.json
bunx -y @mermaid-js/mermaid-cli -i .canon/tmp/figures/<slug>.mmd -o .canon/tmp/figures/<slug>.png -c .canon/tmp/figures/<slug>.json
```

Render both formats in one pass: the SVG is what ships inside the `<figure>`, and the PNG is what Step 6 reads back, since an SVG's markup carries no recoverable spatial meaning the way `draft-diagram` Step 5 already states for the architecture surface.

Use `bunx` when bun is available, falling back to `npx -y @mermaid-js/mermaid-cli ...` otherwise.

- Rewrite every stroke, fill, and text color the renderer wrote as a literal hex value into the custom property the host stylesheet defines, per the standard's color rule. Mermaid's own theme has no notion of a custom property, so this is a source edit made to the rendered SVG, not a config option.
- Check whether the project ran `canon design css --figures`. The figure and figcaption styling ships unconditionally either way, but that flag alone embeds the Virgil and Excalifont font files. Without it, the figure falls back to the browser's own generic `cursive` face rather than the intended hand-drawn font, and Step 7's output names that gap when the flag was not passed.

## Step 5: the freehand path

- Author the SVG by hand: plain shapes and lines authored directly in the markup.
- Follow the standard's `## Color and accessibility` section for every fill, stroke, and accessible name.

There is no external render to verify a freehand drawing against. The check here is the stroke-and-fill audit above and a read of the markup against what the subject means to show, done once rather than looped.

## Step 6: wrap, caption, and verify

- Wrap the drawing in a `<figure>` element with a `<figcaption>` naming what to take from the figure, never what it shows. Let it run wider than the surrounding prose column.
- On the Mermaid path, read the rendered PNG back and judge it against what the figure means to say, the same check `draft-diagram` Steps 5 and 6 run for the architecture surface. Fix the mermaid source and re-render on a defect. Stop after two correction passes. When a defect survives, keep the figure and name the defect in the output rather than reporting a false verification.
- On either path, confirm the figure still reads once every color and font it depends on is stripped to its fallback, per the standard's own working-figure bar.
- When the render fails for any reason, no browser engine, no network, no package manager, continue to Step 7 and name the skipped check. A missing renderer degrades the loop rather than failing it.

## Step 7: confirm and write

Show the destination path, the decided render path, and the full `<figure>` markup before writing. Confirm with the user, since the graph-shaped decision and the render verdict are judgment calls with no diff to preview either against.

Write the figure into the destination document at the location the user named. Renders under `.canon/tmp/figures/` are verification artifacts, and the scratch PNG and JSON config are deleted after Step 6 confirms, since only the SVG ships.

## Output

### Preview

**Destination:** `<path>`
**Render path:** `<mermaid | freehand>`, `<one-sentence reason>`

```html
<drafted figure markup></drafted>
```

### After confirmation

```plaintext
✅ Drafted figure in <path>
Verified render. <defect or skipped check, one line, omitted when clean>
<Font not embedded: run `canon design css --figures` to ship Virgil and Excalifont. Omitted when the project already ran it.>
```
