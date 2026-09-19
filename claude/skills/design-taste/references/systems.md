---
title: Systems
description: The scales and relationships set once for a project rather than judged per draft, being space, type and palette
---

# Systems

Read this when establishing or revising the scales a surface draws from. Every other reference here is read against a draft. This one is read before there is a draft, which is why it sits apart from them.

Nothing below states a value. A value belongs to the project's own design document, and these are the relationships that decide whether the values work.

## Space

An unguided model reaches for whatever number looks right at each point, which produces a surface with thirty spacing values and no rhythm.

- **Every gap comes from one scale.** Count the distinct spacing values on a finished surface. More than about eight means there is no scale, only arithmetic.
- **The steps grow, they do not add.** A scale stepping 4, 8, 12, 16, 24, 32, 48, 64 gives usable distinctions at both ends. One stepping 10, 20, 30, 40 gives four values that all read the same at large sizes and none that work at small.
- **Space between groups exceeds space within them.** This is the one spacing rule carrying real meaning, since proximity is what tells a reader which things belong together. A surface with one gap everywhere has told the reader nothing, and it is the most common spacing failure in generated output.
- **Section rhythm is two or three tiers, not a value per section.** Pick the tiers, then assign each section to one.
- **Space responds to viewport, type mostly does not.** A layout that scales every value together arrives at a phone reading like a shrunken desktop.

## Type

- **One scale, with fewer steps than feels sufficient.** Five to seven covers a surface. A scale with twelve steps has several nobody can tell apart.
- **Adjacent steps are visibly different.** Two steps two pixels apart read as a mistake rather than as a level. If two steps are hard to distinguish side by side, one of them is not a step.
- **Body size anchors the scale and everything derives from it.** Picking a display size first and working down produces body text sized by whatever was left.
- **Line height moves opposite to size.** Large type wants it tighter, small type wants it looser, so one value across the scale is wrong at both ends.
- **The scale carries weights beside sizes.** A scale of sizes alone forces every hierarchy decision to be a size decision, which is the failure `craft.md` names.

## Palette

The layer a model is worst at, and the layer where rules are hardest to make falsifiable. Everything below is a relationship, since a rule naming a value is a value ban and values belong to the project.

- **An accent is defined by rarity, not by hue.** A color used on a third of the surface is a ground, whatever it was chosen as. If the accent appears more than a handful of times per screen, there is no accent.
- **Neutrals are one family at one temperature.** Warm grays beside cool grays read as a mistake rather than as a decision, and it is a mistake a model makes by pulling neutrals from different sources.
- **Adjacent surfaces separate by a little, content separates from ground by a lot.** Generated output routinely inverts this: cards that shout against the page, and text that does not.
- **A semantic color is not the accent.** Error, success and warning carry meaning. Borrowing the accent for one of them makes the accent mean something, and it stops being available for anything else.
- **Dark mode is re-derived, not inverted.** The relationships above are what carry across, and the values are settled again. A palette flipped by algorithm gets the relationships wrong in both directions.
- **Saturation has a budget across the surface, not per color.** Several colors each individually reasonable produce a surface that reads loud, which is why the rule is about the total rather than about any one value.

## Considered and declined

Each failed the test in `REQUIREMENT.md`. Recorded so they are not argued again.

- **Control sizing and proportion.** An unguided model produces reasonable controls without instruction, so it fails the first question.
- **Specific ratios for a type scale**, such as a named musical interval. Falsifiable and arbitrary, and a project picking a different ratio is not wrong.
- **Named palettes or banned hues.** A value ban, which belongs to the project's design document. This is where every external catalog of this kind ends up, and it is why theirs cannot be imported.
- **A minimum contrast figure.** A threshold with a number, which the accessibility rules own.
- **Imagery as a system.** There is no scale to establish. What a model gets wrong about images is using fake ones, which `tells.md` already covers, so the layer stays thin on purpose rather than by oversight.
