---
title: Skill requirements
description: The REQUIREMENT.md sibling, what loads it, and the admission test universal coverage retired
---

# Skill requirements

## Overview

Every skill folder carries `REQUIREMENT.md` beside `SKILL.md`, stating the gaps that skill exists to close so a proposed change has something to be argued against. The unit is the skill rather than the family, since one file for the `git-*` family would state a boundary no single body could be checked against.

## Layout

### What loads the file

The file is authoring context for whoever maintains the skill, and it reaches no target session.

- Claude Code loads `SKILL.md` as the entry and never reads the sibling
- `src/sync/check.ts` leaves `claude/skills/` out of the synced sources, because skills load live from the plugin directory rather than being copied
- `governance/rules/claude/skill.md` fires on both filenames and carries the consult-first bullet

### Reading coverage

Two commands report which skills carry the file. Read coverage from either rather than from a count written here, which goes stale the moment a skill is added.

- `canon claude skills list --json` carries `requirement` per entry across the shipped corpus
- `canon claude skills audit` measures presence across both corpora and fails on an absence

The two resolve their root differently. The listing reads the shipped corpus rather than the cwd, so a dev-linked `canon` reports `main` from any worktree, which makes it useless for verifying a branch.

The audit reads the directory it is pointed at, defaulting to the cwd. The merge gate runs it under `--requirements-only` on every push, the enforcement the rule went without while the standard required the file.

## Decisions

### Universal coverage

Coverage is universal across both corpora. Every skill carries a `REQUIREMENT.md`, or its absence is a gap in the authoring rather than a verdict that the body is its own specification. `canon/context/claude-internal/skills.md` carries the same rule for the internal half.

`claude/skills/create-skill/references/skill.md` admits every skill rather than testing each one's scope, since compressed orientation is useful over a body that is procedural by design. The standard sets no length threshold, because the file's job is orientation rather than a filter.

- A skill still without one is a gap rather than an exemption, so no roster is written here
- Where a branch in flight is changing what a skill is for, its requirement ships with that branch, since one authored earlier would describe the shape the skill is leaving

### What the file may be asked to do

A boundary stated here reaches the author and never the session. A pointer that has to fire at run time belongs in a description or a body, and the requirement keeps the argument behind it.

`canon-cli` is where the gap showed. It is the only pure-reference skill, and its moment sits inside another skill's run. Three sibling requirement files named it while no body did, so a session running a destructive sync reached it only by typing the question.

- The repair put an inline pointer in the body running the overwriting command
- The requirement records the pointer so a second mention is not written into a requirement believing it routes something
- `canon-cli` later gained a moment of its own, since its body names `canon docs agents` and `canon docs` for a verb-catalog or reference-doc question

## Gotchas

### The consult-first rule reaches one direction

A change to `SKILL.md` tests against the requirement, and no rule states the reverse. A branch editing a `## Must` line can leave the body carrying a reason its requirement no longer states.

The emitted-path sweep found that shape in `youtube-transcripts`, where a plan listed the requirement line and the body line implementing it as two independent sites. A `## Must` line and the body line implementing it move in one change.

### Pointers into a silent contract

A pointer resolving to a contract with no row for the command is the failure one step further on. The contract carried none for the governance install, which the install router routed to, so the read its `## Must` requires came back empty.

That requirement records the silence in `## Out of scope` rather than answering it. A rule written on the reading side for a silent contract teaches a session that silence means safe, and the row belongs to the skill owning the table.

### Two failures on the writing side

A check for acknowledgement on the other side reaches neither class, because the destination already named the inbound skill and so read as answered.

- **Contradicting a guard.** A route added to the retired `setup-gov` for a language with no shipped stack told a session to install `base`, which its `## Gap handling` stops on.
- **Naming the wrong object.** An install wanting only `.claude/` was routed to the retired `setup-indexes`, nine lines above a scan that prunes `.claude` outright.

A pointer therefore reads the destination's guards and the object its steps operate on before it is written, and defers to both by name rather than restating a behavior for them.
