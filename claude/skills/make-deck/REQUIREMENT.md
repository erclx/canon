---
name: make-deck
description: Why the skill draws a deck as HTML in the project's tokens inside its own folder, why the CLI owns the conversion, and why one render is read back before the deck is called done
---

# Make deck requirement

## Gap

Without this skill, a session writes a deck into whatever path occurs to it, so a second deck overwrites the first and nothing lists either. It writes pptxgenjs code or hex colors, so the deck ignores the project's design. Every slide comes out as a title over bullets, which reads as a document rather than a deck.

It invents attributes the converter does not read, so a section, a chart, or an entrance silently goes missing. A first render shipped unread hands the audience the overlap, the overflow, and every element the converter fell back to a picture for.

## Must

- The existing decks and the slide format are read from the CLI before drawing, and a new deck takes a name no listed deck carries unless the request names one
- Each deck lands in its own folder under the slides record folder, one HTML file per slide in filename order, drawn with the project's custom properties
- The composition varies across the deck, and content fits the slide frame with short titles and tight lines
- The render command produces the deck itself
- Every fallback and refusal the render reports is read, one QA pass runs over the rendered images, and what both report is fixed once

## Must not

- Hardcode a deck name, an attribute, or a chart type, or reimplement the conversion, the master, or the packaging the CLI owns
- Write a deck into the shared layouts folder, which is never listed as a deck
- Invent token values when the project has no token stylesheet, rather than saying the deck renders unstyled
- Write centered body text or content that overflows a slide
- Loop on aesthetics past a single fix pass, or fail the render when the image tools for the QA pass are missing

## Out of scope

- Converting HTML to PowerPoint, which the CLI owns end to end
- The project's palette and faces, which its token stylesheet owns
- Writing the content the deck is about, which the caller owns
- Drafting a deck as a canvas page, which no skill owns until that authoring surface is measured
- Recording a demo, which `script-screencast` owns
