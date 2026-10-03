---
title: Mermaid reference
description: Direction and layout, node and edge budgets, accessibility fields, label punctuation, and render verification for a Mermaid diagram
paths:
  - '**/*.md'
rule:
  - 'Apply this rule only when the edit drafts or revises a Mermaid fence. Skip it on a markdown edit carrying no diagram.'
  - 'Read it before drafting the fence. Do not work the layout or the budgets from memory.'
  - 'Which diagram a document carries and what question it answers is a separate topic. The diagrams standard routes it.'
---

# Mermaid reference

Applies to every Mermaid fence, wherever it is written. A fence sits inside a document some other standard shapes, so this file reaches the drawing and stops at the fence markers.

## Scope

Governs the Mermaid attribute wherever a fence is written, naming no path because an attribute standard governs a drawing rather than a document type: direction and layout, node and edge budgets, the accessibility fields, how punctuation reaches a label, and how a rendered diagram is verified. It carries no template, since a fence has no document shape of its own and sits inside one another standard sets.

Does not govern:

- Which diagram a document carries, what question it answers, its frontmatter, and the explanation prose beneath it: `diagrams.md`
- Language, word choice, punctuation, and formatting in the prose around a fence: `markdown.md`
- Voice, rhythm, and sentence construction in that prose: the `write-human` skill
- The mechanism behind any component a diagram draws: `context.md`

## What a working diagram looks like

A diagram works when a reviewer holding the rendered image, and nothing else, answers yes four times:

- Did the declared direction hold?
- Is every row of siblings free of a sequential reading the system does not have?
- Is every convergence free of a crossing edge bundle?
- Is it taller than wide, outside a sequence diagram?

A diagram failing these is non-conforming even when it satisfies every shape rule below. The rules are the means. These four questions are the test.

## Layout

- Declare `flowchart TB` by default. Mermaid ignores a subgraph's direction whenever that subgraph links outward, and an architecture diagram links across its subgraphs as the normal case, so top-bottom is a declaration rather than a guarantee.
- Restructure a diagram that renders diagonal or left-to-right. Repeating the direction keyword does not fix it.
- Render a context, component, or pipeline diagram taller than wide. A `sequenceDiagram` is wide by construction and is exempt.
- Do not let independent nodes render in a row. A row of siblings reads as a sequential chain and asserts a pipeline the system does not have.
- Do not converge many edges on one node from one side. A crossing bundle is unreadable whatever it encodes.
- Keep node labels short. Three or four words max. Detail goes in the paragraph below the diagram.
- Use `<br/>` for a second short line on a node when the label is two ideas, never for a sentence.
- Subgraphs are for grouping unrelated lanes such as offline versus online or browser versus server. Do not subgraph a single linear flow.

## Budgets

- Hold a diagram to roughly 5 to 10 nodes. Split it past 15.
- Watch edge count harder than node count. It binds first, and a diagram whose edges outnumber its nodes is already too dense to read.
- Treat a diagram that cannot be described in one sentence as two diagrams.
- Warn rather than refuse on a budget, and name the split that would fix it. These numbers come from published Mermaid practice rather than from a measurement against a corpus, so a hard refusal on them will be wrong sometimes and unarguable when it is.

## Labels

- Apply the punctuation bans in `markdown.md` to node and subgraph labels. A label is not prose, so a check scoped to prose does not reach it, and reading the labels before shipping is the only gate they have.
- Treat the prose around a fence and the text inside it as two surfaces. The paragraphs are prose and follow `markdown.md` and the `write-human` skill. The fenced block is not, which is why a check scoped to prose is the wrong thing to rely on for what sits inside it.

## Accessibility

- Give every diagram `accTitle` and `accDescr`. `accTitle` names what the diagram answers. `accDescr` states the structure in one sentence for a reader who cannot see the render.

## Verification

- Judge a diagram from its rendered image, not from its source. Direction, sibling rows, and edge bundles are visible only in the output.
- Render to PNG. An SVG export reads back as markup with no recoverable spatial meaning.
- Apply the four questions above as a reviewer, against the same render the author judged.
- State which verification was skipped when no renderer is available. A diagram written without a render is still shippable, and one reported as verified without a render is not.
