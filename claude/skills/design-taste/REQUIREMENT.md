---
name: design-taste
description: Why a design round needs a stated layer ordering and a taste catalog, and why neither half works without the other
---

# Design taste requirement

## Gap

Without this skill, a design round has no vocabulary to declare what it is varying and no standard of quality once it has. Both halves failed together and each is measured.

The failure was measured on a real page. Four `draft-and-pick` rounds ran against one landing page in a single working session, and three changed nothing the operator could see. Each varied a property at Surface, being palette, figure treatment, heading separation and underline reach, against a page whose defect sat at composition.

The instruction against that already existed. `draft-and-pick` Step 1 says to name the layer and Step 2 says a palette cannot be picked ahead of a composition. All four rounds skipped both, and nothing reported it. A session told to name a layer has no catalog to name from, so the rule had nothing behind it.

The second half is the output itself. A model with no stated direction draws the population average of its training data, which produces interfaces that satisfy every craft rule and still read templated.

Prose is already governed in two halves and design is governed in neither. The character bans ship as data a command reads, and the shapes no closed word set can match needed a skill of their own, because each is a pattern rather than a token. `standards/design.md` governs the shape of a project's design document and is silent on whether its values are any good.

Importing an external catalog wholesale fails on what those catalogs turn out to carry. The largest is 1,206 lines in one file, pinned to one framework, one styling library and one animation package, and it scopes itself out of dashboards, data tables and multi-step product UI. A second bans default fonts by name and prescribes a component library.

A session handed either one unfiltered adopts a stack the project does not use, or silently ignores the item. No later reader can tell which happened, which is why the adopted-and-declined record exists.

## Must

- Require a declared read in the output before any candidate is authored, naming the kind, the audience, the overriding constraint and the layer, since a layer named privately is a layer nobody can check
- Enumerate the layers in settle order, so an instruction to name one has a catalog behind it
- State that a round varies one layer, and that a complaint is worked at the lowest layer it reaches rather than the cheapest one to change
- Carry grey-boxing as the operational form of the ordering rule, since removing the higher layers from view is what makes a lower one judgeable
- Cite the correctness floor rather than restating it. `400-ui`, `410-a11y`, `420-forms` and `430-ux-completeness` already carry accessibility, keyboard, forms, states and rendered copy on the rendered paths, and a second copy here drifts with nothing comparing the two.
- Hold in the body what every design moment pays for, being the read, the layers, the ordering, grey-boxing and the locks, and defer everything a single moment needs.
- State what has to stay constant across a whole surface, since coherence is a property of the whole and each of those is broken one section at a time.
- Detect the mode before reading anything when a surface already exists, and name what cannot change silently, since a slug, a field name or an analytics event breaks something outside the surface.
- Carry a final filter the session runs against its own output, with every item tracing to a rule stated here, since an unenforced rule and an unchecked one fail the same way.
- Name the machine defaults as a catalog of shapes with replacements, held behind a stated trigger so a round that needs none pays no read
- Record which external patterns were adopted, which declined, and the measurement behind each, so a later session extends the position instead of re-deriving it
- Stay general-purpose across kinds, naming what a kind optimizes for rather than which packages to install
- Say when a read names a kind the references do not cover, rather than inventing guidance for it

## What earns a place

A rule belongs in this skill only when all four hold. Three of the four reject most design advice, which is the point: a criterion admitting everything is not a criterion.

1. **An unguided model gets it wrong.** The model already knows a control needs padding, so writing that down costs a read and buys nothing. It does not know to avoid three equal cards. Only the second kind earns a line.
2. **Nothing else owns it.** A `ui` rule, a standard, or a sibling skill owning the topic makes this a pointer rather than a rule.
3. **It is judgment rather than a threshold.** A contrast ratio has a number and belongs to the floor. Whether a palette reads cheap has no number and belongs here.
4. **One line states it, and something could violate that line.** "Use whitespace intentionally" fails, since nothing could break it. "No three consecutive image-and-text splits" passes, since it can be counted.

A rule failing any of the four is recorded as considered and declined rather than argued again, in the reference where it would have gone.

## Must not

- Name a framework, a styling library, an animation package, a component library or an icon set as a default. A rule that survives only inside one stack is not a taste rule.
- Ship a frozen corpus of palettes, font pairings or product examples. A copy becomes a file some sync reconciles forever, and a traced reference is current by construction where a frozen one is not.
- Restate the banned characters, which `markdown.md` states and `canon markdown audit` gates from package data
- Express intensity as a numeric scale. A session picks a middle value and reports compliance, which satisfies the rule and decides nothing.
- Claim the reported failure is closed. Nothing measures whether a round follows these rules, so this skill states them and the measurement is owed separately.
- Duplicate a rule a surface already states for itself, such as slide layout or terminal color, where pointing at that surface is the whole of the correct answer
- Be reached only by an author typing its name. `standards/skill.md` makes this a review criterion rather than a check, since nothing answers it before the skill has run. The intended non-author caller is the declared read in `draft-and-pick`'s output. A round producing no read, with this skill never loaded, is the evidence that the description's triggers are too weak.

## Guards

- A kind with no per-kind guidance gets the body's rules and a stated absence, never invented guidance
- A grey-boxed set is announced as grey-boxed, since an unannounced grey page reads as unfinished work rather than as the question being asked
- Accessibility and the state set outrank an aesthetic preference wherever the two collide, rather than being traded against it

## Out of scope

- Accessibility, keyboard interaction, ARIA and alt text, which `410-a11y` owns on every rendered path
- State coverage, empty and loading treatment, destructive confirmation and truncation, which `430-ux-completeness` owns
- Validation timing, error placement and save blocking, which `420-forms` owns
- Rendered copy casing, button labels and error wording, which `400-ui` owns
- The candidate loop, the arm set, the render and the pick, which `draft-and-pick` owns and which this skill is loaded alongside rather than inside
- Tracing a reference's color, type and spacing values, which is `sketch-design`
- The shape of the project's design document, its sections and its token tables, which `standards/design.md` governs
- Spatial layout and interaction intent of one named surface, which `standards/wireframes.md` governs
- Prose on the surface being designed, which `write-human` and `markdown.md` govern between them
- Measuring whether finished output followed these rules, which needs a check this skill does not carry and which no command reaches while a render is an image rather than a parse
