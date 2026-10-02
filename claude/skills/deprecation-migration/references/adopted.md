---
title: Adopted and declined
description: Which external sources on deprecation and migration this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record. A later session extending the skill adds to it rather than re-arguing an item already settled here.

## Adopted

### From the default shelf

**Deprecation.** [Software Engineering at Google, chapter 15](https://abseil.io/resources/swe-book/html/ch15.html). Adopted from it:

- Advisory and compulsory deprecation as the two types, with compulsory carrying a removal date. The body allows compulsory only once a replacement has shipped, which the chapter implies and the four questions make explicit.
- Warnings that are actionable and relevant: a warning names what the caller does, and surfaces where the caller uses the old surface.
- Deprecation as a process with an owner, since the chapter observes that unowned deprecation work makes no progress. Adopted as the fourth decision question and the rule against an advisory deprecation left open with no owner.
- Finding consumers before removal, which the chapter does with static analysis across one repository. Generalized into the zero-consumers check across caller kinds, since a target project rarely has a whole-company code index and its callers often live outside the repository.

**The Churn Rule.** [Software Engineering at Google, chapter 1](https://abseil.io/resources/swe-book/html/ch01.html), under "Policies That Don't Scale": infrastructure teams move their internal users to new versions themselves, or update in place in a backward-compatible way. Adopted as the group on migrating callers yourself, with the backward-compatible path kept for callers the owner cannot edit.

### The decision and the bridges

**Deprecation and migration.** Addy Osmani's `agent-skills`, pinned at addyosmani/agent-skills@2686b620, [`skills/deprecation-and-migration/SKILL.md`](https://github.com/addyosmani/agent-skills/blob/2686b620/skills/deprecation-and-migration/SKILL.md). Adopted from it:

- The five-question deprecation decision, cut to four. Its unique-value and maintenance-cost questions merge into one question about what keeping the surface costs. Its per-consumer migration-cost question drops, since the Churn Rule puts that cost on the owner rather than weighing it per caller. The owner question from the book takes the freed place.
- The rule never to deprecate without a replacement, as the third decision question.
- The strangler and adapter patterns, stated as when each fits rather than as worked code tied to one stack.
- Expand, migrate, contract, lifted out of its schema section and stated for any surface as three separate changes.
- Zombie code, narrowed to code that is unowned, uncalled, and still built, and settled by the same zero-consumers check rather than a list of staleness signals.
- The rationalizations and red flags that carry across stacks, reworded as reasons this toolkit's sessions have given, with rows added for the search that found one spelling and for a fallback kept with no removal condition.

## Declined

**Its database schema section.** The column rename worked example, the tested down path, batched backfills, and concurrent index builds. Declined because a project's persistence rule owns schema changes, and restating them here puts two owners on one rule. Only the expand, migrate, contract shape was lifted, generalized beyond schemas.

**Feature flag migration.** Declined because it is one way to run a strangler, and naming a flag mechanism ties the body to a runtime a target may not have.

**The traffic percentages in its strangler phases.** Declined because they describe a service behind a router, and most surfaces a session retires, such as a function, a flag, or a file, have callers rather than traffic.

**"Default to advisory" as a standing default with no exit.** Kept advisory as the starting state, and declined leaving it open, since an advisory deprecation with no date and no owner is the stalled case the body exists to prevent.

**The thresholds in its zombie signs and rebuttals.** No commits in six months, and comparing costs over two or three years. Declined for the same reason the body states no deprecation window: a number fits one project's cadence and not another's.

**"Code is a liability" and design-time deprecation planning as sections.** Declined as framing a session already accepts by loading the skill. The cost question carries the first, and designing a new surface for removal belongs to the skill shaping that surface.

**The celebration step and the deprecation notice template.** Declined because neither changes what a session does, and the template's example names a package runner and a migration script tied to one stack.
