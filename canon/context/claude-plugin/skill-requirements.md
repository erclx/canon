---
title: Skill requirements
description: The REQUIREMENT.md sibling, what loads it, and the admission test universal coverage retired
---

# Skill requirements

Every skill folder carries `REQUIREMENT.md` beside `SKILL.md`, stating the gaps that skill exists to close so a proposed change has something to be argued against. It is authoring context for whoever maintains the skill. Claude Code loads `SKILL.md` as the entry and never reads the sibling, and `src/sync/check.ts` leaves `claude/skills/` out of the synced sources because skills load live from the plugin directory rather than being copied, so the file reaches no target session and costs no tokens there. `governance/rules/claude/570-skill.md` fires on both filenames and carries the consult-first bullet.

The consult-first bullet reaches one direction. A change to `SKILL.md` tests against the requirement, and no rule states the reverse, so a branch editing a `## Must` line can leave the body carrying a reason its requirement no longer states. The emitted-path sweep found that shape in `youtube-transcripts`, where a plan listed the requirement line and the body line implementing it as two independent sites. A `## Must` line and the body line implementing it move in one change.

The same loading fact bounds what the file may be asked to do. A boundary stated here reaches the author and never the session, so a pointer that has to fire at run time belongs in a description or a body, while the requirement keeps the argument behind it. `canon-cli` is where the gap showed. It is the only pure-reference skill in the corpus, its stated moment sits inside another skill's run, and three sibling requirement files named it while no body did, so a session running a destructive sync reached it only by typing the question. The repair put an inline pointer in `seed-sync` and `canon-operator`, each at the point it runs or prints an overwriting command, and the reference's own requirement now records the two so a third mention is not written into a requirement believing it routes something. A later branch gave `canon-cli` a second moment of its own, alongside the two inline pointers: its body now names `canon docs agents` and `canon docs` directly, for a verb-catalog or reference-doc question, so a session reaches it without first landing in `seed-sync` or `canon-operator`.

A pointer resolving to a contract with no row for the command is the failure one step past that one. The contract carries none for the governance install, which `canon-operator` routes to, so the read its `## Must` requires comes back empty at a destination the skill reaches. That requirement records the silence in `## Out of scope` rather than answering it, since a rule written on the reading side for a silent contract teaches a session that silence means safe, and the row belongs to the skill owning the table.

Two failure classes sit on the writing side of the same pointer, and a check for acknowledgement on the other side reaches neither. A route added to the since-retired `setup-gov` for a language the toolkit ships no stack for produced a Scope line telling a session to install `base`, while that skill's own `## Gap handling` and its requirement Guard both stop on exactly the unmatched case the route sends. The destination already named the inbound skill in `## Out of scope`, so the other side read as answered while the route contradicted a guard two sections below it.

The second class names the wrong object. Sending an install wanting the `.claude/` folder alone to the since-retired `setup-indexes` put that phrasing nine lines above a scan pruning `.claude` outright, so a correct route read as an instruction to index the one folder the skill excludes. A pointer therefore reads the destination's guards and the object its steps operate on before it is written, and defers to both by name rather than restating a behavior for them.

The unit is the skill rather than the family. A single file covering the whole `git-*` family or the ship chain would state a boundary no one body could be checked against, and the boundaries worth writing down are the ones between siblings.

Which skills carry the file is a fact two commands report. `canon claude skills list --json` carries `requirement` per entry across the shipped corpus, and `canon claude skills audit` measures presence across both corpora and fails on an absence. Read coverage from either rather than from a count written here, which goes stale the moment a skill is added.

The two resolve their root differently, and the difference decides which one answers a question. The listing reads the shipped corpus rather than the cwd, so a dev-linked `canon` reports `main` no matter which worktree runs it, which is what makes it useless for verifying a branch. The audit reads the directory it is pointed at, defaulting to the cwd, so it measures the tree in hand. The merge gate runs it under `--requirements-only` on every push, which is the enforcement the rule went without while the standard required the file.

## Universal coverage

Coverage is universal across both corpora: every skill carries a `REQUIREMENT.md`, or its absence is a gap in the authoring rather than a verdict that the body is already its own specification. `canon/context/claude-internal/skills.md` carries the same rule for the internal half.

`standards/skill.md` admits every skill rather than testing each one's scope, since compressed orientation is useful over a body that is procedural by design whatever that body's own clarity. The standard sets no length threshold: the file's job is orientation rather than a filter, so a skill's body length has no bearing on whether it carries one.

A skill still without one is a gap rather than an exemption, which is why no roster of them is written here. Where a branch in flight is changing what a skill is for, its requirement ships with that branch rather than ahead of it, since one authored earlier would describe the shape the skill is leaving. Coverage closes as those branches land, and the command above is what reports where it stands.
