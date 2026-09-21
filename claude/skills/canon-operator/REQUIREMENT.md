---
name: canon-operator
description: Why the toolkit has one front door, what orienting on live catalogs prevents, and where it hands off
---

# Canon operator requirement

## Gap

Without this skill, using the toolkit means knowing which skill to pick, and the user who most needs it is the one who cannot. A plain-language intent has no obvious owner among a dozen setup and sync skills, so the session guesses a command instead of resolving one, and a wrong guess installs into a project rather than reporting a mismatch.

Two failures come from acting on memory. A session that names a stack, rule, or snippet from what it remembers rather than from the live catalog runs against an entry that has been renamed or removed. And a session that edits a managed file by hand produces a change the next sync overwrites, which reads as the toolkit undoing work rather than as the edit having been made in the wrong place.

The third failure is duplication. A front door that answers everything itself reimplements first-time detection and seed diffing inline, badly, beside the skills that already do both. The value of a router is that it stops at the handoff.

A fourth failure sits between the router and what it runs. This skill executes the install and sync commands whose effect on an existing file is invisible from the command line, and the reference stating that effect per surface is named in the boundary below, which Claude Code never loads. The router therefore overwrites a customized golden config with the answer sitting one skill away and unread.

The fifth failure is writing without re-checking. A domain sync brought a stricter standard into a target and left ten of its eleven context entries non-compliant in the same moment, and the run reported success because reporting the command was where its work ended. A person found the breakage afterwards by running an audit by hand. The audit that would have caught it is built and reachable from nothing the router offers, so one session held both the defect and its detector and connected neither to the other.

The last failure is a section no route reaches. `## Route` maps an intent or a diagnostic finding to one lifecycle phase, so audit offers sitting below that table with no row naming them are unreachable by a correct reading. Two runs asked what the toolkit could measure and both took the scaffold handoff, the row the table declares. A route in settles half of it, since a project carrying a context folder and no installed domain fires the scaffold row and two audit conditions at once, and a body ranking neither leaves the choice to whichever the session read last.

## Must

- Orient on the toolkit's own docs and the live catalogs before acting
- Map the stated intent to one lifecycle phase, then either run the simplest command that satisfies it or hand off
- Resolve every stack, rule, snippet, and standard name from a catalog at runtime
- Run the CLI non-interactively and report the command run, what changed, and the full path of anything written
- Read the overwrite contract from the body before any install or sync, and name each surface it lists as overwritten before running one
- Read the reverse walk beside the forward sections, so a folder the toolkit stopped shipping reaches the user
- Name an unmigrated domain's root and install path for the user to move themselves, since no skill covers the move
- Route a measurement intent to the audit offers from the route table itself, rather than leaving the section reachable only by reading past the table
- Rank a lifecycle row against the audit offers where the route table itself states it, so a session acting on the lifecycle row reads the ranking without opening the section being ranked
- Offer every audit whose surface the target carries, and offer none whose surface it lacks
- Hand off an audit that is a skill rather than a command, since the execute contract governs a CLI run and says nothing about a skill's own guards
- Re-check the target after any operation that wrote, and report what those writes changed against the state read before acting

## Must not

- Edit a managed file by hand instead of running the CLI that owns it
- Reimplement a flow another skill owns
- Hardcode a catalog name
- Move, delete, or name a command against a folder in `unclaimed`. The toolkit stopped claiming the path and only the user knows whether the project owns what sits there
- Run an audit the user did not pick, which turns a front door into a full sweep
- Refuse to finish an operation over an audit finding, since every audit reports judgments beside facts and a router that stops on one is a router a target works around
- Auto-trigger. It is a door the user opens, and a router that fires on its own routes requests nobody made.

## Guards

- An intent matching a deep flow hands off rather than running a shallow version of it, since a partial scaffold is harder to recover from than none
- An ignore-only fix on an unmeasured tooling report stops, names which cause applies, and names the command answering that cause. Unmeasured has several causes and they do not share a remedy, so one suggested command is wrong for at least one of them. No cause asks the user to supply a stack name, and none reads the zero counts under an unmeasured report as a clean target.
- A re-check with no earlier report to compare against says the write ran without a baseline, rather than describing the target from scratch
- A report missing a field this skill reads names the CLI version as the cause and reports that section as unread. Neither an absent key nor a hand-rolled substitute for it may be reported as a finding, since the first reads as a clean target and the second reaches a verdict only the field's attribution can make

## Out of scope

- First-time scaffold of a fresh project: `target-setup`
- Seed and preamble drift in installed files: `seed-sync`
- Governance rule install and index bootstrap: `target-setup`, on its `gov` and `indexes` phases
- What a given sync overwrites once it runs: `canon-cli`

That last contract carries no row for the governance install this skill routes to, so the overwrite `Must` above reads nothing at one of its own destinations. The row belongs to the skill owning the table. This file records the silence rather than answering it, since a rule written here for a silent contract teaches a session that silence means safe.
