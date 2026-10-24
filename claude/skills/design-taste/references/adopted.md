---
title: Adopted and declined
description: Where each design-taste rule comes from, being a quoted authority, the community catalog of model-output tells, or a house threshold, where the per-bullet rows for the body and the rule references sit, and what was declined and why
---

# Adopted and declined

Every rule in this skill traces to one of three origins. A reader arguing against a rule finds its origin through this record, and a session extending the skill adds a row rather than re-deriving one.

- **An authority.** A typographer, a usability lab, a platform guideline, or the CSS reference states the rule, and the row quotes the passage relied on.
- **The catalog.** Community prompt skills recorded what models draw when nothing states a direction. A tell from them is an observation of model output, not established practice.
- **A house choice.** The toolkit chose the threshold so a tell can be counted, and no source stands behind the number.

A rule a quoted passage only partly backs names the part it backs, and the rest sits in the catalog or the house class.

## Contents

- [Where the rows sit](#where-the-rows-sit)
- [The layer model](#the-layer-model)
- [The catalog](#the-catalog)
- [Declined from the catalogs](#declined-from-the-catalogs)
- [Declined from the systems reference](#declined-from-the-systems-reference)
- [Carried as a caution](#carried-as-a-caution)

## Where the rows sit

Each bullet in the skill body's concern groups and in `craft.md`, `kinds.md`, `systems.md`, and `tells.md` has its own source row in a ledger outside the plugin, one ledger per file and one row per bullet under the H2 the bullet sits under.

- The toolkit's skill audit fails a ledgered file whose bullets and rows disagree in count under any heading, and a target never carries the rows
- The body's `## What this delegates` takes no rows, since it routes rather than directs
- `preflight.md` takes no ledger, since its boxes restate the rules the four ledgered references source
- `vocabulary.md` takes none either, since it defines terms rather than directing
- This record keeps the layer model behind the body's order, and what was read and declined

## The layer model

The body's layer order subdivides the five planes of Jesse James Garrett's [The Elements of User Experience](http://www.jjg.net/elements/). Its second chapter states the dependency the order rests on, that "Each plane is dependent on the planes below it."

The same passage gives the constraint running the other way, that "the choices available to us on each plane are constrained by the decisions we make about issues on the planes below it". The nine layers and the grey-box stage are the skill's own subdivision of those planes.

## The catalog

Most tells in `tells.md`, and the ten defaults in the body, came from community prompt skills that recorded what models draw unguided. None of them is a design authority. Each tell is an observation of model output, falsifiable against a render, rather than established practice.

- **[Taste-Skill](https://github.com/leonxlnx/taste-skill)** and its fork **[claude-taste-skill](https://github.com/nxpatterns/claude-taste-skill)** supplied the composition, content, surface, and motion tells
- **[UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)** was first read through a vendor listing and later from its repository. Its ranking puts accessibility first, and its lookup corpus was declined.
- **[frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design)**, Anthropic's skill, supplied the five clusters current AI design falls into, restated in `tells.md`
- **[Impeccable](https://github.com/pbakaus/impeccable)** supplied what a visual direction may lend an application screen and the category self-check, restated in `kinds.md`. Its themed browser surfaces lie behind the platform control tell.

No sentence from any of them is copied. Each idea is restated and cited in the ledger row for its bullet.

Most Taste-Skill tells came from its v2 experimental skill, which its author later moved to [taste-skill-classics](https://github.com/Leonxlnx/taste-skill-classics), and the rows link it there.

### Adopted with no change

The three equal cards, the centered hero over a wash, enumerated eyebrows, scroll cues, decorative status dots, atmospheric strips, the fake screenshot built from boxes, filler verbs, and placeholder that reads as placeholder. Each names a shape, each carries a replacement, and none depends on a stack.

### Adopted with the stack removed

Source items naming an icon set, a component library, a font by name, or an animation package were rewritten to state what the rule is about. "Do not use Inter" became one family doing every job, since the defensible claim is about pairing and role separation rather than about one typeface.

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
