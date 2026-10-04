---
name: draft-slides
description: Why the skill draws a deck as HTML in the project's tokens inside its own folder, why the CLI owns the conversion, and why one render is read back before the deck is called done
---

# Draft slides requirement

## Gap

Without this skill, a deck request turns into hand-built output. The session writes a deck into whatever path occurs to it, so a second deck overwrites the first and nothing lists either. It writes pptxgenjs code or hex colors per deck, so the deck takes neither the project's design nor any other deck's, and it invents attributes the converter does not read, so a section, a chart, or an entrance silently goes missing. Every slide comes out as a title over bullets, which is the shape that needs no decision and reads as a document rather than a deck.

A first render shipped unread hands the audience the overlap, the overflow, and every element the converter fell back to a picture for, since markup that looks correct says nothing about the file it produces.

## Must

- Read the existing decks and the slide format from the CLI before drawing, and pick a deck name no listed deck carries unless the request names one
- Write each deck into its own folder under the slides record folder, one HTML file per slide in filename order
- Draw with the project's custom properties so the deck takes the project's design
- Vary the composition across the deck rather than repeating one shape
- Size content to fit the slide frame, keeping titles short and lines tight
- Shell out to the render command for the deck itself
- Read every fallback and refusal the render reports, run one QA pass over the rendered images, and fix what both report

## Must not

- Hardcode a deck name, an attribute, or a chart type, which goes stale the moment the CLI changes
- Reimplement the conversion, the master, or the packaging, which the CLI owns
- Write a deck into the shared layouts folder, which is never listed as a deck
- Invent token values when the project has no token stylesheet
- Write centered body text or content that overflows a slide
- Loop on aesthetics past a single fix pass

## Guards

- No token stylesheet: draw the deck anyway and say it renders unstyled.
- Image conversion tools missing: skip the image pass and say so. Do not fail the render over a verification step.

## Out of scope

- Converting HTML to PowerPoint, which the CLI owns end to end
- The project's palette and faces, which live in its token stylesheet rather than in the slides
- Writing the content the deck is about, which the caller brings
- Drafting a deck as a canvas page, which waits on a measurement of that authoring surface
- Recording a demo, which `draft-screencast` owns
