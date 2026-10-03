---
title: Mermaid path
description: The hand-drawn render config, the SVG and PNG pair, the hex rewrite, the scoped overflow fallback, the label check, and the PNG read-back with its two-pass stop, read by draft-figure once a figure routes through Mermaid
---

# Mermaid path

`draft-figure` reads this file when Step 3 routes a figure through Mermaid, whether the subject is graph-shaped or an architecture view the architecture set already shaped.

## Draft the fence

- Draft the fence against `${CLAUDE_SKILL_DIR}/../../standards/mermaid.md` for direction, node and edge budgets, `accTitle` and `accDescr`, and quoted labels. Do not work the layout or the budgets from memory.
- Read every node and subgraph label against the banned characters `${CLAUDE_SKILL_DIR}/../../standards/markdown.md` lists. The audit hook skips every line inside a fence, so a label carrying a banned character passes silently while the same character in the caption is caught. Reading the labels is the only gate they have. A colon works as a replacement inside a label.

## Render

Render with the hand-drawn look and the figure font stack, writing scratch files under `.canon/tmp/figures/`:

```bash
mkdir -p .canon/tmp/figures
cat <<'EOF' >.canon/tmp/figures/<slug>.json
{"look": "handDrawn", "themeVariables": {"fontFamily": "Virgil, Excalifont, cursive"}}
EOF
bunx -y @mermaid-js/mermaid-cli -i .canon/tmp/figures/<slug>.mmd -o .canon/tmp/figures/<slug>.svg -c .canon/tmp/figures/<slug>.json
bunx -y @mermaid-js/mermaid-cli -i .canon/tmp/figures/<slug>.mmd -o .canon/tmp/figures/<slug>.png -c .canon/tmp/figures/<slug>.json
```

Render both formats in one pass. The SVG is what ships inside the `<figure>`, and the PNG is what the read-back below judges, since an SVG's markup carries no recoverable spatial meaning.

Use `bunx` when bun is available, falling back to `npx -y @mermaid-js/mermaid-cli ...` otherwise.

Before the first render in a project, say what is about to block:

```plaintext
Rendering to verify layout. The first run downloads the Mermaid CLI and takes about 15 seconds.
```

## Rewrite the colors

Rewrite every stroke, fill, and text color the renderer wrote as a literal hex value into the custom property the host stylesheet defines, per the color rule in `${CLAUDE_SKILL_DIR}/../../standards/figures.md`. Mermaid's own theme has no notion of a custom property, so this is a source edit made to the rendered SVG, not a config option.

## Clipped titles

- Expect a group title or a long label to clip once the destination shows it in the hand font, since the renderer sized its box in a fallback face.
- When the in-page check shows a clipped title, add a `<style>` inside the SVG, scoped to that SVG's own id, that sets `overflow: visible` on the clipped label's `foreignObject` and centers the label within it, so the wider text spills past both edges evenly. The style hides the mismatch for a title and does nothing for a node label crowding its box, which takes a shorter label instead.

## Fonts

Check whether the project ran `canon design css --figures`. The figure and figcaption styling ships unconditionally either way, but that flag alone embeds the Virgil and Excalifont font files. Without it, the figure falls back to the browser's own generic `cursive` face rather than the intended hand-drawn font, and the output names that gap when the flag was not passed.

## Read the render back

- Read the rendered PNG and judge it against what the figure means to say, applying the verification properties in `mermaid.md`. A source satisfying every rule there can still render as a picture asserting something false, so the image is what gets judged.
- Fix the Mermaid source and re-render on a defect. Stop after two correction passes. When a defect survives, keep the figure and name the defect in the output rather than reporting a false verification.
- When the render fails for any reason, no browser engine, no network, no package manager, continue to the confirm step and name the skipped check. A missing renderer degrades the loop rather than failing it.
