---
name: design-taste
description: Carries the layer model that decides which design decision settles first, the rules that keep a surface coherent across sections, and the catalog of defaults a model reaches for when nothing states a direction. Use when drafting or judging an interface, a page, or any rendered surface, when output reads generic or templated, when redesigning something that already exists, or when asked to "make this look designed", "why does this look like AI made it", "give it taste", "what layer is this decision at", or "grey-box this first". Do NOT use for accessibility, forms, or state coverage, which the `ui` governance rules carry, for the shape of the project's design document, which `design.md` governs, to run the candidate loop, which is `draft-and-pick`, or to trace a reference's values, which is `sketch-design`.
---

# Design taste

A model with no stated direction draws the population average of what it has seen. That is why unguided design output reads as templated while satisfying every rule of craft it was given, and it is why adding more craft rules does not fix it. This skill carries the direction: where a decision sits, what settles before it, and which defaults to reach past.

Load this before drafting rather than after. A revision pass recovers a color and never recovers the composition the draft already settled.

Skip it for work that does not change how something looks, feels, moves, or is interacted with.

## The defaults you are reaching past

This is what the population average looks like. Each one is what gets drawn when nothing states otherwise, and each is recognizable on sight:

- Three equal cards in a row under a heading.
- A centered headline over a dark gradient wash, with two buttons under it.
- A violet-to-blue gradient used as the accent.
- Numbered labels above sections: `001 / Capabilities`, `Phase 02`, `Step 1`.
- A scroll cue at the bottom of the first screen.
- A colored dot before every navigation item, row or badge.
- A glow standing in for elevation, on a pure black or pure white ground.
- A product screenshot built out of styled rectangles.
- Placeholder that announces itself: `Acme`, a stock person name, 99.9%, one portrait used twice.
- Verbs chosen for warmth rather than for meaning, of the `elevate` and `unleash` family.

Reaching past a default means choosing something else on purpose, not avoiding the word. A brief that genuinely calls for one of these gets it, and the difference is that somebody decided.

`${CLAUDE_SKILL_DIR}/references/tells.md` holds the full catalog, of which these ten are the most common. Read it on the trigger stated below rather than now.

## Declare the read

State one line before authoring any candidate, page, or component, and put it in the output rather than holding it privately. Where the surface already exists, name the mode first, since the mode decides how much of the read is yours to set:

> Reading this as: `<kind>` for `<audience>`, `<the constraint that overrides taste>`, working at `<layer>`.

Two worked examples:

> Reading this as: an application surface for an operator who already knows the domain, density beats first impression, working at composition.

> Reading this as: a marketing page for a stranger who has never run the tool, every claim must be a thing the tool did, working at content.

The read fixes the kind, which decides which rules apply, and names the layer, which decides what may vary. A round that cannot state its read has not decided what it is doing.

Put the read to the operator through the structured question surface where it genuinely forks, per `005-behavior`. Where context settles it, declare and proceed rather than asking.

## The layers, and the order they settle

A lower layer constrains every layer above it. Two consequences follow, they run in opposite directions, and collapsing them is the mistake worth avoiding.

Settling a higher layer over a broken lower one changes nothing, which is why a palette round against a broken composition is wasted. Judging a lower layer through a finished higher one is nearly impossible, which is why grey-boxing works.

The model is Jesse James Garrett's five planes from _The Elements of User Experience_ (2000), subdivided to the granularity a drafting round works at.

| Order | Layer       | The question it answers                                                    |
| ----- | ----------- | -------------------------------------------------------------------------- |
| 1     | Content     | What is actually here, and what does it say                                |
| 2     | Composition | Which sections exist, in what order, carrying what relative weight         |
| 3     | Layout      | How a section divides its space: grid, columns, alignment, container width |
| 4     | Space       | Rhythm and proximity, meaning what groups with what                        |
| 5     | Typography  | Scale, weight, measure, casing, pairing                                    |
| 6     | Surface     | Elevation, border, radius, fill, depth                                     |
| 7     | Palette     | Ground, accent, saturation, contrast                                       |
| 8     | Imagery     | What a picture carries, and where it sits                                  |
| 9     | Motion      | What moves, why, and how far                                               |

### What follows from the order

- Work at the lowest layer the complaint reaches. A complaint is voiced at the layer a person can name and usually lives lower. "It feels gloomy" reads as palette and is frequently composition, since a page with one section shape reads flat whatever color it is.
- A round varies one layer and says which. Varying three answers nothing, because the pick cannot say which difference decided it.
- Never settle a higher layer before the one below it. Imagery and palette are the one pair that settle together, since a real photograph sets a ground rather than accepting one.
- Content leads the order and is frequently absent when drafting starts. Draft against real copy where it exists, stand in for it where it does not, and treat the composition as unsettled until real copy has run through it.
- Name the layer the complaint sits at, then check the layers below are settled. Where one is not, that is the round, and say so rather than drafting the requested one.

## Grey-box when judging layers 1 to 4

Judging content, composition, layout or space through a finished surface is the failure the ordering exists to prevent. Remove the higher layers from view instead:

- Draw every element as a flat neutral block with no fill variation, no accent color, no imagery, no motion.
- Keep real text at real length. Placeholder text hides whether the composition survives the copy it will carry, so greek only what does not exist yet and never what does.
- Mark a region with no content yet as FPO at its true size, so nobody reads a placeholder as a decision.
- Return to the finished surface once the layer under judgment is settled. A grey-box is a stage, not a deliverable.

Say when a set is grey-boxed and why. An operator meeting an unannounced grey page reads it as unfinished work rather than as the question being asked.

## Lock what must not vary across a surface

Coherence is a property of the whole and every one of these is broken one section at a time:

- **One accent.** Chosen once, used everywhere. A warm-grey surface does not grow a blue action in its seventh section.
- **One radius system.** Mixed radii are allowed only under a stated rule applied everywhere, such as pill actions over square containers.
- **One theme.** No inverted section dropped between its neighbors. A reader must not feel they walked into a different product mid-scroll.
- **One copy register.** Technical, editorial and promotional voices do not mix in one composition unless the brand states that they do.
- **One light source.** Every shadow on the surface falls the same way, and a shadow is tinted toward the ground rather than pure black.

## Working on something that already exists

Name the mode before reading anything, since misclassifying it is the largest source of bad redesign work:

- **Greenfield:** nothing rendered yet, or a full replacement is agreed.
- **Preserve:** modernize without breaking the brand. Extract what exists before proposing anything.
- **Overhaul:** new visual language over existing content and structure.

Apply the cheapest lever that satisfies the brief, in this order: typography, then space and rhythm, then color recalibration, then motion, then recomposing key sections, then replacing a block outright.

Never change these without saying so and getting agreement, because each one breaks something outside the surface: URL and route slugs, primary navigation labels, form field names and their order, the logo, and legal or consent copy.

## Setting up the scales

Read `${CLAUDE_SKILL_DIR}/references/systems.md` when establishing or revising what a surface draws from, being the space scale, the type scale, and the relationships a palette holds. Every other reference here is read against a draft. That one is read before there is one, so a project reaches for it at the start and on a system revision rather than on an ordinary round.

It states no values. A value belongs to the project's own design document.

## The rest of the catalog

Read `${CLAUDE_SKILL_DIR}/references/tells.md` before handing over anything a model drafted, and whenever output satisfies every rule here and still reads generic. The ten above are the common cases. It holds the rest, plus the countable composition limits, the first-screen budget, and the record of which external items were adopted, which declined, and why.

Skip it on a small change to a surface with a settled direction. The catalog is a diagnostic and costs a read on every invocation that does not need one.

## When it reads almost right

Read `${CLAUDE_SKILL_DIR}/references/craft.md` when a layout is correct and still looks off. It covers optical rather than mathematical alignment, alignment across side-by-side items, hierarchy built from weight rather than size, and the small failures that survive every structural rule.

## Rules that differ by kind

Read `${CLAUDE_SKILL_DIR}/references/kinds.md` once the read names a kind. A read naming a kind it does not cover gets the body's rules and a stated absence, never invented guidance.

## Naming a pattern

Read `${CLAUDE_SKILL_DIR}/references/vocabulary.md` when a shape needs a name, whether to ask for it, to compare two arms, or to record a pick.

## Before handing anything over

Run `${CLAUDE_SKILL_DIR}/references/preflight.md` against the output. It is the last filter and every box traces to a rule stated here or in a reference. An item that cannot be honestly ticked is unfinished work rather than a judgment call.

## What this delegates

- Focus, keyboard, ARIA, alt text, and every accessibility floor: the `ui` governance rules, which fire on the same paths this skill does and are the single source
- States, empty and loading coverage, destructive confirmation, truncation: the same rules
- Rendered copy casing, button labels, error message shape: the same rules
- The candidate loop, the arm set, the render, and the pick: `draft-and-pick`
- Tracing a reference's color, type and spacing values: `sketch-design`
- The shape of the project's design document and its token tables: `${CLAUDE_SKILL_DIR}/../../standards/design.md`
- Spatial layout and interaction intent of one surface: `${CLAUDE_SKILL_DIR}/../../standards/wireframes.md`
- Reading source for roughness: `ux-audit`. Measuring what a running interface costs to paint: `ux-measure`
- Prose on the surface being designed: the `write-human` skill
