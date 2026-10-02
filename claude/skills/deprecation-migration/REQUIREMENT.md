---
name: deprecation-migration
description: Why a session retiring code needs stated rules for deciding to deprecate, migrating callers, and proving none remain before removal, and where that discipline stops short of additive interface change, file placement, and schema migrations
---

# Deprecation and migration requirement

## Gap

Without this skill, nothing in the toolkit tells a session how to retire a function, a flag, a file, or a command. No skill folder carries the topic, and the terms strangler and expand-then-contract appear in no skill, rule, or standard. The persistence rule covers only the destructive half of a schema change, and `api-design` stops at adding a new name beside an old one and removing the old one once no caller reads it, without saying how a session proves that or who moves the callers.

The toolkit retires its own surfaces often, and three observed cases show the failure the gap allows:

- A record folder moved from a flat sibling to a nested layout while one known consumer still sat on the old layout with no checkout reachable to migrate it. The expand step shipped and the contract step had no owner or date.
- A skill kept a fallback beside a new command "until a release retires it", a compatibility path with no stated removal condition.
- A sync engine reported entries a source had stopped shipping as retired, leaving each consumer to decide what to do with them, which is a deprecation announced without the owner migrating anyone.

Each excuse row in the body traces to one of these cases or to a source in the ledger.

## Must

- State the decision to deprecate as four questions, being what keeping it costs, who calls it, what replaces it, and who migrates the callers, and keep the surface when they do not add up
- Separate advisory from compulsory, and allow compulsory only once a replacement has shipped and a removal date is stated where a caller looks
- State the Churn Rule: the owner of a surface migrates its callers rather than announcing and waiting
- Require a zero-consumers check across every caller kind before removal, being imports, string references, configuration, documentation, and copies outside the repository, and require the report to name the kinds the search could not reach rather than reporting zero
- Name the adapter and the strangler as the two bridges, with when each fits
- State expand, migrate, and contract as three separate changes, never letting the contract step share a change with the expand step
- Treat zombie code as a decision between removal and ownership, settled by the same zero-consumers check
- Record the external sources adopted and declined with the reason for each
- Close with a table of the excuses a session gives for removing early or leaving a deprecation open, the red flags it can see mid-task, and a checklist each line of which answers yes or no against the change

## Must not

- Name a toolkit command, a toolkit-local path, or a project from the evidence, since the body ships to targets
- State a numeric deprecation window, since a number fits one project's release cadence and not another's
- Restate additive change or the One-Version Rule, which `api-design` owns
- Restate the persistence rule's schema bullets

## Guards

- Code introduced on the same branch that nothing has shipped against skips the skill
- A removal whose zero-consumers check left a caller kind unreached is reported with that kind named, never as clean

## Out of scope

- Database schema migrations and their down paths: the project's persistence rule
- Release versioning and changelog format, which a release process owns
- Whether a tooling sync removes a path a stack stopped shipping, which needs measuring before any rule is written
- Moving or renaming a file with no caller change: `codebase-layout`
- Adding a field, flag, or parameter beside an old one: `api-design`
- Whether the guidance changes what a session ships, which needs a measured with-and-without run rather than a rule here

## Measured

Not yet run. The seeded arm holds a deprecated helper with one caller by import and one by string reference, and asserts the session finds both before deleting and leaves the helper while either remains. The with-and-without run waits on the operator authorizing the spend.
