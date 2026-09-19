---
title: Craft
description: The failures that survive every structural rule, where a layout is correct by measurement and still reads wrong to the eye
---

# Craft

Read this when a layout satisfies the ordering, the locks and the tells, and still looks amateur. Everything here is a property of the eye rather than of the markup, so no measurement catches any of it.

## Optical against mathematical

The eye and the arithmetic disagree, and the eye is the one being served.

- **Centering by the numbers is not centering.** A triangle inside a circle, an icon beside a label, a glyph inside a round button all sit visually left or low when centered by their bounding box. Nudge until it looks right, usually a pixel or two.
- **Equal vertical padding reads bottom-heavy.** A block with matching top and bottom padding looks like it is sinking. Give the bottom slightly more.
- **Optical size beats declared size.** A circle and a square at the same declared size do not read as the same size. The circle needs to be larger.
- **Type alignment follows the letterform, not the box.** A quotation mark, a bullet or an opening parenthesis at the start of a line should hang outside the text edge so the text itself lines up.

## Alignment across siblings

A row of cards is judged as a row, so every shared element has to land on the same line.

- Titles, values, descriptions and actions align across all items in a row. One card with a two-line title pushing everything below it down is the most common version of this failure.
- Pin actions to the bottom of each card so they form one horizontal line whatever the content above them does.
- Feature lists in comparison columns start at the same vertical position. Fix with a fixed-height header block rather than by hoping the copy matches.
- Equal-height cards forced by the layout engine are the wrong fix. Either allow variable heights deliberately or align the shared elements.

## Hierarchy without scale

Reaching for size is the first instinct and the weakest tool.

- A page carrying only regular and bold has two levels. Introducing the weights between them gives four, at no cost in space.
- Color, spacing and position all carry hierarchy. A heading set in a muted tone above tighter spacing reads as a level without being larger.
- An enormous heading over uniform body text is shouting rather than structuring, and it flattens every level under it.

## Type detail

- **Orphans.** A single word alone on the last line of a heading. Let the renderer balance short headings rather than forcing the break by hand.
- **Measure.** Body text running the full width of a wide container is unreadable however good the type is.
- **Figures in columns.** Numbers that change, in a table, a price or a timer, need tabular figures or the column jitters.
- **Tracking by size.** Large type wants tighter letter spacing, small uppercase labels want looser. Body text wants whatever the face was drawn with.
- **Casing.** Sentence case for headings and labels. Title case on every heading reads as a template.

## Depth and texture

- A shadow is tinted toward the surface it falls on. Pure black at low opacity reads as dirt.
- Flat with zero texture reads sterile at large sizes. A trace of noise or a soft gradient gives a large ground something to be.
- An even linear gradient across a whole section is the laziest depth available. Break it or drop it.
- Elements sitting flat beside each other with no overlap read as a diagram. Let something cross a boundary.

## Small things that read as unfinished

- A link or action that goes nowhere.
- Navigation with no indication of where the reader currently is.
- The same portrait used for several different people.
- Every item dated identically, which no real collection ever is.
- An exclamation mark in a success message. Confidence is quieter than that.
- An error opening on an apology rather than on what to do next.
