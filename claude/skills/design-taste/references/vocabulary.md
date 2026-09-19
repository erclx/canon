---
title: Design vocabulary
description: The layer, property, pattern and process terms this skill uses, so an operator and a session name the same thing the same way
---

# Design vocabulary

Terms used by `design-taste` and by the skills it is loaded alongside. It changes when a design round needs a name it cannot look up here.

This glossary departs from one rule in `glossary.md`: an entry does not name where the term first appears. The material is five short files a reader can scan, so a location per entry costs more than it returns.

Every other rule there holds, and the one deciding membership holds strictly. A term appears here once this skill's own material uses it, never ahead of that, and the section below records what was considered and left out.

## Layers

Ordered by when each settles, not alphabetically, since the order is the content. Everything below is alphabetical within its group.

- **Content**: what is actually present and what it says. Settles first, because every layer above it is arranging something.
- **Composition**: which sections a surface carries, in what order, at what relative weight. Avoid "structure", which names the same thing in the five-plane model and is used here only for that model.
- **Layout**: how one section divides its own space, meaning grid, columns, alignment and container width.
- **Space**: rhythm and proximity, deciding what reads as grouped with what. Avoid "spacing", which names the token scale rather than the decision.
- **Typography**: scale, weight, measure, casing and pairing.
- **Surface**: elevation, border, radius and fill. The same word commonly names a place content is published to, so say "the surface layer" wherever both readings are in reach.
- **Palette**: ground, accent, saturation and contrast. The values themselves live in the project's design document, never here.
- **Imagery**: what a picture carries and where it sits.
- **Motion**: what moves, why, and how far.

## Properties

- **Casing**: whether text is set upper, lower, title or sentence case, treated as a hierarchy decision rather than a typing one.
- **Density**: how much information a given area carries. High density is correct in an application surface and reads as clutter on a marketing one, which is why it belongs to the kind rather than to taste.
- **Hierarchy**: the order a reader takes things in, produced by weight, color, space and position together rather than by size alone.
- **Ground**: the surface a thing sits on, whether the page behind everything or the fill behind one element. Named apart from "background" because the relationship that matters is what sits against it.
- **Line height**: the vertical distance from one baseline to the next, set against size rather than fixed across a scale. Avoid "leading", which names the same thing.
- **Measure**: the length of a line of text, capped so the eye finds the next line.
- **Orphan**: a single word left alone on the last line of a heading or paragraph.
- **Scale**: the fixed set of sizes a surface draws from, for type or space.
- **Tabular figures**: numerals drawn to one shared width, so a column of changing numbers does not shift as it updates.
- **Tracking**: the letter spacing applied across a run of text, set by size rather than by taste.

## Patterns

Named compositions, carried so an operator can ask for one by name instead of describing it. A pattern earns an entry once this skill's own material names it, never ahead of that.

- **Chrome**: the persistent frame around content, being navigation, status and context, which is read constantly and looked at rarely.
- **Eyebrow**: the small wide-tracked label sitting above a heading, usually uppercase. The term matters because the budget is countable: no more than one per three sections.
- **Hairline**: a rule thin enough to separate without dividing, used where a border would read as a box.
- **Marquee**: a strip of content sliding horizontally on a loop, independent of the reader's scroll.
- **Scrollspy**: a persistent index marking which section the reader is currently in as they scroll.

## Process terms

How a draft is staged while unfinished.

- **FPO**: a placeholder held at the true final size and marked as a placeholder, from print production where it abbreviates "for position only". Marking it is the point, since an unmarked stand-in gets read as a decision.
- **Greeking**: standing text in for copy that does not exist yet, of which lorem ipsum is the common form. Correct while judging space and wrong once an arm is judged on content.
- **Grey-box**: drawing every element as a flat neutral block so the layers above the one under judgment are removed from view. Avoid "wireframe", which names a committed document governed by `${CLAUDE_SKILL_DIR}/../../standards/wireframes.md` rather than a drafting stage.

## Terms this vocabulary deliberately does not carry

- **Magic number**: an unexplained hardcoded value. The term already means that in code, so it is not redefined here as a design term.
- **Glyph**: a single rendered character. A typographic unit rather than a pattern, and nothing here needs the word.
