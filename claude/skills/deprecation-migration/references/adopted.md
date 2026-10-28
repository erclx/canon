---
title: Adopted and declined
description: Which external sources on deprecation and migration this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record, and a later session extending the skill adds to it rather than re-arguing an item settled here.

A source a bullet rests on is linked once, in that bullet's row of the toolkit's per-bullet ledger at `governance/ledger/skills/deprecation-migration/`, which ships outside the plugin. This file names those sources without the link and keeps the catalog-level adopted and declined record, linking only a source no row cites.

## Adopted from the default shelf

### Deprecation

Software Engineering at Google, chapter 15 supplies four positions the body states.

- **Two types.** Advisory and compulsory, the second carrying a removal date. The body allows compulsory only once a replacement ships, which the chapter implies and the four questions make explicit.
- **Actionable, relevant warnings.** A warning names what the caller does, and surfaces where the caller uses the old surface.
- **An owner.** The chapter observes that unowned deprecation work makes no progress. Adopted as the fourth decision question and the rule against an ownerless advisory deprecation left open.
- **Finding consumers before removal.** The chapter's static analysis over one repository becomes the zero-consumers check across caller kinds, since a target's callers often live outside it.

### Migrating callers yourself

Software Engineering at Google, chapter 1, under "Policies That Don't Scale", has infrastructure teams move their internal users to new versions themselves, or update in place in a backward-compatible way.

Adopted as the group on migrating callers yourself, with the backward-compatible path kept for callers the owner cannot edit.

## Adopted for the decision and the bridges

Addy Osmani's `agent-skills`, pinned at addyosmani/agent-skills@2686b620, `skills/deprecation-and-migration/SKILL.md`, supplies the decision and the bridge patterns.

### The decision

Its five-question deprecation decision is cut to four. The unique-value and maintenance-cost questions merge into one about what keeping the surface costs, and the per-consumer migration-cost question drops, since the Churn Rule puts that cost on the owner.

- The owner question from the book takes the freed place
- The rule never to deprecate without a replacement is the third decision question
- The strangler and adapter patterns are stated as when each fits rather than as worked code tied to one stack

### Migration, zombie code, and red flags

The migration shape and the excuse rows carry across stacks once reworded for any surface rather than a service or a column.

- Expand, migrate, contract, lifted out of its schema section and stated for any surface as three separate changes
- Zombie code, narrowed to code that is unowned, uncalled, and still built, and settled by the zero-consumers check rather than a list of staleness signals
- The excuse row on a search that found nothing, from its red flag against removing code without verifying zero active consumers
- The excuse row on adding the new one and dropping the old one now, generalized from its rationalization about a column added and dropped in one migration

## Declined

Each item below was read and left out, with the reason it changes nothing a session does here.

### The schema section and its mechanisms

**Its database schema section.** The column rename worked example, the tested down path, batched backfills, and concurrent index builds. A project's persistence rule owns schema changes, so only the expand, migrate, contract shape was lifted, generalized beyond schemas.

**Feature flag migration.** Declined because it is one way to run a strangler, and naming a flag mechanism ties the body to a runtime a target may not have.

### Numbers that fit one project

**The traffic percentages in its strangler phases.** They describe a service behind a router, and most surfaces a session retires, such as a function, a flag, or a file, have callers rather than traffic.

**The thresholds in its zombie signs and rebuttals.** No commits in six months, and comparing costs over two or three years. Declined for the reason the body states no deprecation window, since a number fits one project's cadence and not another's.

### Defaults and framing

**"Default to advisory" as a standing default with no exit.** Advisory is kept as the starting state and leaving it open is declined, since an advisory deprecation with no date and no owner is the stalled case the body exists to prevent.

**"Code is a liability" and design-time deprecation planning as sections.** Framing a session already accepts by loading the skill. The cost question carries the first, and designing a new surface for removal belongs to the skill shaping that surface.

### Ceremony

**The celebration step and the deprecation notice template.** Declined because neither changes what a session does, and the template's example names a package runner and a migration script tied to one stack.
