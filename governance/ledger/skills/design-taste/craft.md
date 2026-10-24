---
title: Craft reference ledger
description: Sources for claude/skills/design-taste/references/craft.md, one row per bullet
---

# Craft reference ledger

The field is typography and visual design. The authorities are Practical Typography and MDN for type, and the Nielsen Norman Group for navigation and error messages.

Most rows here are catalog observations, being what a community prompt skill recorded models drawing unguided. A catalog row records model output and is never cited as an authority.

## Optical against mathematical

| Bullet                              | Source                                                                                                                                                                                                                                                 | Read       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Centering by the numbers            | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "Icons next to text, play buttons in circles, or text in buttons often need 1-2px optical adjustments to feel right" | 2026-10-24 |
| Equal vertical padding bottom-heavy | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "Top and bottom padding are always identical", and "bottom padding often needs to be slightly larger"                | 2026-10-24 |
| Optical size beats declared size    | [Wikipedia, Overshoot](https://en.wikipedia.org/wiki/Overshoot_%28typography%29): round letters overshoot "to achieve an optical effect of being the same size"                                                                                        | 2026-10-24 |
| Hang the opening mark               | [hanging-punctuation](https://developer.mozilla.org/en-US/docs/Web/CSS/hanging-punctuation): "An opening bracket or quote at the start of the first formatted line" hangs                                                                              | 2026-10-24 |

## Alignment across siblings

| Bullet                         | Source                                                                                                                                                                                                                                                                | Read       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Shared elements align in a row | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "align shared elements (titles, descriptions, prices, buttons) across all items. Misaligned baselines make the layout look broken." | 2026-10-24 |
| Pin actions to the bottom      | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "Pin buttons to the bottom of each card so they form a clean horizontal line regardless of content above"                           | 2026-10-24 |
| Feature lists start level      | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "the list of features should start at the same Y position across all columns", with "fixed-height title/price blocks"               | 2026-10-24 |
| Forced equal height is wrong   | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "Cards of equal height forced by flexbox. Allow variable heights or use masonry when content varies in length."                     | 2026-10-24 |

## Hierarchy without scale

| Bullet                          | Source                                                                                                                                                                                                                                                                                          | Read       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Weights between regular, bold   | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "Only Regular (400) and Bold (700) weights used. Introduce Medium (500) and SemiBold (600) for more subtle hierarchy."                                        | 2026-10-24 |
| Color, space, position carry    | [Practical Typography, Headings](https://practicaltypography.com/headings.html) backs the space half: "The best way to emphasize a heading is by putting space above and below". Color and position are a House choice: a level carried by size alone runs out of steps a reader can tell apart | 2026-10-24 |
| An enormous heading is shouting | [Practical Typography, Headings](https://practicaltypography.com/headings.html): "It's fine to make the point size bigger, but just a little."                                                                                                                                                  | 2026-10-24 |

## Type detail

| Bullet             | Source                                                                                                                                                                                                                                                | Read       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Orphans            | [text-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap): `balance` suits "a short number of lines, such as headings, captions, and blockquotes"                                                                                       | 2026-10-24 |
| Measure            | [Practical Typography, Line length](https://practicaltypography.com/line-length.html): "Aim for an average line length of 45–90 characters, including spaces."                                                                                        | 2026-10-24 |
| Figures in columns | [font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric): `tabular-nums` sets figures "the same size, allowing them to be easily aligned"                                                                        | 2026-10-24 |
| Tracking by size   | [Practical Typography, Letterspacing](https://practicaltypography.com/letterspacing.html): "always add 5–12% extra letterspacing to text in all caps or small caps", and typographers "remove letterspacing from lowercase text used at larger sizes" | 2026-10-24 |
| Casing             | [A to Z of GOV.UK style](https://www.gov.uk/guidance/style-guide/a-to-z-of-gov-uk-style): "Always use sentence case, even in page titles and service names", the source the `ui-craft` copy ledger records for the rule this bullet points at         | 2026-10-24 |

## Depth and texture

| Bullet                         | Source                                                                                                                                                                                                                        | Read       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Tint the shadow                | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "Tint shadows to match the background hue", rather than "pure black at low opacity"         | 2026-10-24 |
| Zero texture reads sterile     | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "Flat design with zero texture. Add subtle noise, grain, or micro-patterns to backgrounds." | 2026-10-24 |
| The even linear gradient       | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "Perfectly even gradients", in place of "standard linear 45-degree fades"                   | 2026-10-24 |
| Let something cross a boundary | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "No overlap or depth. Elements sit flat next to each other."                                | 2026-10-24 |

## Small things that read as unfinished

| Bullet                       | Source                                                                                                                                                                                                                                                                                                                      | Read       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A link that goes nowhere     | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "Dead links. Buttons that link to `#`."                                                                                                                                                   | 2026-10-24 |
| No current location          | [NN/g, Navigation: You Are Here](https://www.nngroup.com/articles/navigation-you-are-here/): "Navigation should not only show where you can go but also where you are now."                                                                                                                                                 | 2026-10-24 |
| One portrait for many people | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "Same avatar image for multiple users. Use unique assets for every distinct person."                                                                                                      | 2026-10-24 |
| Every item dated alike       | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "All blog post dates identical"                                                                                                                                                           | 2026-10-24 |
| An exclamation in success    | Catalog observation, [Redesign skill](https://github.com/nxpatterns/claude-taste-skill/blob/main/skills/redesign-skill/SKILL.md): "Exclamation marks in success messages. Remove them. Be confident, not loud."                                                                                                             | 2026-10-24 |
| An error opening on sorry    | [NN/g, Error-message guidelines](https://www.nngroup.com/articles/error-message-guidelines/) backs the fix half: "offer some potential remedies". The no-apology half is a catalog observation, [frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md): "Errors don't apologize" | 2026-10-24 |
