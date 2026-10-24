---
title: Adopted and declined
description: Where each design-taste rule comes from, being a quoted authority, the community catalog of model-output tells, or a house threshold, plus what was declined and why
---

# Adopted and declined

Every rule in this skill traces to one of three origins. A reader arguing against a rule finds its origin here, and a session extending the skill adds a row rather than re-deriving one.

- **An authority.** A typographer, a usability lab, a platform guideline, or the CSS reference states the rule, and the row quotes the passage relied on.
- **The catalog.** Community prompt skills recorded what models draw when nothing states a direction. A tell from them is an observation of model output, not established practice.
- **A house choice.** The toolkit chose the threshold so a tell can be counted, and no source stands behind the number.

A rule a quoted passage only partly backs names the part it backs, and the rest sits in the catalog or the house class.

## Contents

- [The layer model](#the-layer-model)
- [Craft rules an authority states](#craft-rules-an-authority-states)
- [Systems rules an authority states](#systems-rules-an-authority-states)
- [Tells an authority states](#tells-an-authority-states)
- [The catalog](#the-catalog)
- [House choices](#house-choices)
- [Declined from the catalogs](#declined-from-the-catalogs)
- [Declined from the systems reference](#declined-from-the-systems-reference)
- [Carried as a caution](#carried-as-a-caution)

## The layer model

The body's layer order subdivides the five planes of Jesse James Garrett's [The Elements of User Experience](http://www.jjg.net/elements/). Its second chapter states the dependency the order rests on, that "Each plane is dependent on the planes below it."

The same passage gives the constraint running the other way, that "the choices available to us on each plane are constrained by the decisions we make about issues on the planes below it". The nine layers and the grey-box stage are the skill's own subdivision of those planes.

## Craft rules an authority states

Rows for `craft.md`, grouped by its sections.

### Type detail

Each rule below is stated by the type reference or the CSS property that implements it.

| Rule                | Source                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Measure             | [Practical Typography](https://practicaltypography.com/line-length.html): "Aim for an average line length of 45–90 characters, including spaces."             |
| Figures in columns  | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric): `tabular-nums` sets figures "the same size, allowing them to be easily aligned" |
| Small caps tracked  | [Practical Typography](https://practicaltypography.com/letterspacing.html): "always add 5–12% extra letterspacing to text in all caps or small caps"          |
| Large type tighter  | The same page: typographers "will often remove letterspacing from lowercase text used at larger sizes"                                                        |
| Orphans             | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap): `balance` suits "a short number of lines, such as headings, captions, and blockquotes"     |
| Hanging punctuation | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/hanging-punctuation): "An opening bracket or quote at the start of the first formatted line" hangs     |

Casing is the `interface-casing` rule's, which `craft.md` points at rather than restating.

### Optical size, hierarchy, and unfinished work

The rows below back one bullet each. The error row backs the fix half of its bullet alone.

| Rule                  | Source                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Optical size          | [Wikipedia, Overshoot](https://en.wikipedia.org/wiki/Overshoot_%28typography%29): round letters overshoot "to achieve an optical effect of being the same size" |
| Hierarchy from weight | [Practical Typography](https://practicaltypography.com/headings.html): with a bold heading, "you can also try reducing the point size"                          |
| Where the reader is   | [NN/g](https://www.nngroup.com/articles/navigation-you-are-here/): "Navigation should not only show where you can go but also where you are now."               |
| Error opens on a fix  | [NN/g](https://www.nngroup.com/articles/error-message-guidelines/): "offer some potential remedies"                                                             |

That an apology should not lead the error is the catalog's observation, since the NN/g page allows one on a total failure.

### Craft rules from the catalog

The remaining `craft.md` rules are catalog observations of model output. They are optical centering, bottom-heavy padding, alignment across siblings, color and space carrying hierarchy, the shouting heading, every depth and texture rule, the dead link, the reused portrait, and the copy that reads unfinished.

## Systems rules an authority states

Rows for `systems.md`. The counts it states sit under house choices below.

| Rule                         | Source                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Between groups beats within  | [NN/g](https://www.nngroup.com/articles/gestalt-proximity/): "Items close together are likely to be perceived as part of the same group"                      |
| One gap everywhere fails     | The same page: a tight label reads as one group "compared to a larger margin before the next label-field pair"                                                |
| Adjacent steps differ        | [Practical Typography](https://practicaltypography.com/headings.html): "Use the smallest increment necessary to make a visible difference."                   |
| Fewer steps than feel enough | The same page: "Limit yourself to three levels of headings. Two is better."                                                                                   |
| Weights beside sizes         | The bold heading passage under craft above                                                                                                                    |
| Dark mode re-derived         | [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/dark-mode): dark colors "aren't necessarily inversions of their light counterparts" |

### Systems rules from the catalog

Geometric spacing steps, space responding to the viewport, body size anchoring the scale, and line height moving opposite to size are catalog observations. Practical Typography gives a line spacing range for body text alone, so it does not back the last.

Every palette rule but the dark mode row is catalog as well, being accent by rarity, one neutral temperature, the separation of surfaces from content, a semantic color kept off the accent, and the saturation budget.

## Tells an authority states

Two tells and one application UI rule rest on a source rather than on the catalog.

| Rule                              | Source                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unstyled platform control         | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme): it adapts "The default colors of form controls"              |
| Transparency with no checkerboard | [Wikipedia](https://en.wikipedia.org/wiki/Transparency_%28graphic%29): an editor "shows transparency by a special pattern, e.g. a checkerboard pattern" |
| Shortcut beside its command       | [NN/g](https://www.nngroup.com/articles/ui-copy/): shortcuts sit "to the far right of the menu" and "alongside the command text in tool tips"           |

## The catalog

Every other tell in `tells.md`, and the ten defaults in the body, came from community prompt skills that recorded what models draw unguided. None of them is a design authority. Each tell is an observation of model output, falsifiable against a render, rather than established practice.

- **[Taste-Skill](https://github.com/leonxlnx/taste-skill)** and its fork **[claude-taste-skill](https://github.com/nxpatterns/claude-taste-skill)** supplied the composition, content, surface, and motion tells
- **[UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)** was first read through a vendor listing and later from its repository. Its ranking puts accessibility first, and its lookup corpus was declined.
- **[frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design)**, Anthropic's skill, supplied the five clusters current AI design falls into, restated in `tells.md`
- **[Impeccable](https://github.com/pbakaus/impeccable)** supplied what a visual direction may lend an application screen and the category self-check, restated in `kinds.md`. Its themed browser surfaces lie behind the platform control tell.

No sentence from any of them is copied. Each idea is restated and cited here.

### Adopted with no change

The three equal cards, the centered hero over a wash, enumerated eyebrows, scroll cues, decorative status dots, atmospheric strips, the fake screenshot built from boxes, filler verbs, and placeholder that reads as placeholder. Each names a shape, each carries a replacement, and none depends on a stack.

### Adopted with the stack removed

Source items naming an icon set, a component library, a font by name, or an animation package were rewritten to state what the rule is about. "Do not use Inter" became one family doing every job, since the defensible claim is about pairing and role separation rather than about one typeface.

## House choices

Each threshold below is the toolkit's, chosen so a tell can be counted rather than judged.

| Threshold                     | Source                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| About eight spacing values    | House choice: past it, a count tells a scale from arithmetic on a finished surface             |
| Five to seven type steps      | House choice: fewer forces size to carry every level, and more holds steps nobody tells apart  |
| Two or three section tiers    | House choice: enough tiers for rhythm, few enough that each section takes one                  |
| One marquee                   | House choice: a second sliding strip is where the device reads as filler                       |
| Two consecutive splits        | House choice: a third alternation is where the pattern reads as filler                         |
| Four first-screen text items  | House choice: a label, a headline, a supporting line, and the actions, so a fifth is countable |
| One layout family, five items | House choice: a repeated shape and a long run become counts a reviewer can check               |

The uppercase label count belongs to the `interface-casing` rule, whose own ledger records it as a house choice.

### The focus ring's weight

One more lock is the toolkit's own choice.

| Threshold       | Source                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| One ring weight | House choice: a ring varying by component reads as several products. The `ui-craft` skill owns the floor |

## Declined from the catalogs

Each item below is real advice placed in the wrong surface, or a rule that decides nothing.

### Values and dials

**Banned fonts by name.** A font ban is a value ban, and a value belongs to the project's own design document rather than to a skill that loads everywhere. A project that wants a typeface ruled out rules it out there.

**Numeric intensity dials.** Every external source carries a 1-to-10 scale for variance, motion and density. A session picks a middle value and reports compliance, which decides nothing and leaves no trace a later reader could check. The declared read carries the same information in a sentence somebody can argue with.

### Rules owned elsewhere

**The em dash ban as a design rule.** One source bans the character on a page as a visual tell. The markdown standard already bans it for prose reasons and `canon markdown audit` gates that from package data, so restating it here would put a second copy of an enforced rule behind an unenforced pointer.

**The official-package map.** A table routing a brief to Fluent, Material, Carbon, Polaris, Primer or a government design system. It is real advice and it is a stack decision a project takes once, so it belongs in that project's own records rather than in a skill that loads on every design round.

### Scope and tooling

**Scoping out application UI.** The largest source covers landing pages, portfolios and redesigns, and excludes dashboards, data tables and multi-step product UI. Those exclusions are most of what software projects actually build, so the kinds reference carries application UI as a first-class kind.

**A design detector hook.** Impeccable runs one after UI edits. A detector belongs beside an automated review probe once the tells are grounded, not inside a skill that carries guidance.

## Declined from the systems reference

Each failed the test in `REQUIREMENT.md`. Recorded so they are not argued again.

- **Control sizing and proportion.** An unguided model produces reasonable controls without instruction, so it fails the first question.
- **Specific ratios for a type scale**, such as a named musical interval. Falsifiable and arbitrary, and a project picking a different ratio is not wrong.
- **Named palettes or banned hues.** A value ban, which belongs to the project's design document. Every external catalog of this kind ends up here, which is why theirs cannot be imported.
- **A minimum contrast figure.** A threshold with a number, which the accessibility rules own.
- **Imagery as a system.** There is no scale to establish. What a model gets wrong about images is using fake ones, which `tells.md` covers, so the layer stays thin on purpose.

## Carried as a caution

**Greeking.** Placeholder text is correct while judging space and wrong once an arm is judged on content, since real copy length is what breaks a composition. State which of the two a set is doing.
