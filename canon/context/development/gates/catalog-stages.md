---
title: Catalog stages
description: The gate stages reading a catalog or a count, from sandbox coverage to the skill audits
---

# Catalog stages

## Decisions

### Sandbox coverage

`canon sandbox coverage` reports which scenarios declare expectations, and the Sandbox coverage stage gates on the same report, so a scenario added with no expectation fails a push rather than sitting undeclared.

The gate is `SANDBOX_UNDECLARED_CEILING` in `src/gate/measures.ts`, an absolute count of scenarios declaring nothing, pinned at what a clean run reports.

- A floor under the declared count would pass the case the stage exists for, since an unarmed scenario leaves the declared count where it was
- A ratio moves when a scenario is legitimately deleted, while the ceiling falls on deleting an unarmed one and stays on an armed one
- Raising the number is a deliberate edit, so the diff says which scenario and why, rather than a percentage drifting down with no commit responsible

`SANDBOX_ASSERTED_FLOOR` in the same file gates the `--skills` census on `asserted`. A floor is right here because a dropped skill-to-scenario pairing lowers `asserted` directly, including a rename that drops pairings without touching a scenario file while the ceiling stays green.

A coverage command that exits non-zero fails the stage under CI and warns on a contributor's machine. The scenario tree ships in the checkout, so a runner that cannot read it has a broken command, and a skip there would report the pass the stage exists to withhold.

### Manifest validation

The Plugin manifests stage runs `claude plugin validate --strict` over every plugin and marketplace manifest. It always runs, because a manifest edit is not the only thing that invalidates one and the stage costs about a third of a second.

- It discovers its inputs through tracked and untracked `git ls-files` listings matching `*.claude-plugin/plugin.json` and `marketplace.json`, so a later manifest is covered the day it lands
- Both listings honor `.gitignore`, which keeps linked worktrees and dependency copies out
- `--strict` promotes warnings to failures, so a Claude Code release adding a warning fails `bun run check` for everyone until the manifest answers it

The guard tests that `claude` resolves on `PATH` and that `claude --version` succeeds, since a global install can land the wrapper without the native package. A contributor's machine skips on either failure. CI refuses on both, and the refusal for a binary that cannot run names the pinned version.

### Skill paths

The Skill paths stage runs the `skillPaths` measure over the shipped skill tree and fails on a path that resolves only in this repository. A shipped skill runs from a plugin cache in someone else's project, so a citation that reads correctly here is a dead pointer there.

- The walk reads inside fenced code blocks, because an example is the part a reader copies, and one built from this repository's `docs/` and `wiki/` rows teaches a target a folder set it lacks
- The banned pattern is a bare `wiki/` with no exemption, so a skill routing a page into a project's wiki names a folder called `wiki` rather than a path, as `teach-workspace` does

### Canonical records

The Canonical records stage calls `measureRequirements` in-process and fails when `canon/REQUIREMENTS.md` holds more words than the cap it states. A record stating no cap passes, and a project with no record passes and says so.

The stage keeps its id and label, since a rename costs every doc citing the label for no behavior change. It reads the record directly because the Context citations stage runs `--citations-only`, which never opens it.

### Design prose

The Design stage regenerates `canon/DESIGN.md`, asserts drift, and runs the `designProse` measure over it and `examples/design/DESIGN.md`. The limits in `src/design/budget.ts`, stated in `claude/skills/canvas-board/references/design.md`, are a one-paragraph Overview, at most three rules a section, a word cap on each rule, and a short lead.

A drift assert cannot see these, since a regenerated paragraph agrees with its source however long it grows. An absent record is skipped, a tree holding neither passes and says so, and an unreadable path reports unmeasured.

### Document ceiling

The Document ceiling stage reads every markdown file git lists, sums `documentHeight` over the whole source, and names each one past `CHECKPOINTS.ceiling`, 300 rendered lines. Frontmatter and fenced blocks count, since a session pays for every line it loads.

- `CHANGELOG.md` is exempt by name, because the release tool rewrites it and would drop a marker
- Any other file is exempt only through a whole-line `<!-- canon-length-exempt: <reason> -->` outside a fence, since a list of exempt paths would need a second edit on every rename
- The failure names every document with its height and the two remedies, splitting at a seam or marking a verbatim record exempt

`canon markdown audit` prints the same list under its Length step and never exits 2 on it, because the plan and groundwork skills run that audit on a gitignored record where a long plan is not a defect. The stage owns the verdict, as the Canonical records stage owns each record's caps while `canon context audit` only reports.

### Document ceiling measurement

A table counts at the width the formatter pads it to, so one wide cell raises every row. A lookup table with long cells costs nearly twice what the same rows cost as a bullet list, which the formatter never pads, and that conversion is the cheapest cut on a file near the ceiling.

Frontmatter counts too, so a sweep adding a field across a corpus pushes every body already at the ceiling over it. Measure each target's slack with `canon markdown audit` before planning such a sweep, and name the splits it forces in the plan.

### Folder-echoed filenames

The stage reads every path `git ls-files` lists and fails on each whose stem, the basename up to its first dot, equals its immediate parent folder's name or opens with `<folder>-`. The failure names every path in one pass, and a tree git cannot list reports unmeasured.

It reads the parent folder only, so the governance install layout under `.claude/rules/canon/canon/`, where a folder repeats a folder, stays out of reach.

- It is a gate stage rather than an audit finding because it reads paths, covering code and config files the audit never opens
- The audit also runs inside every target through the tooling base stack, where a folder-named file may be the target's convention, and a finding would fail a push on that choice
- The rule sits in the `codebase-layout` skill and reaches targets as guidance, so this stage is this repository's only enforcement
- Matching is exact rather than singular-aware, so `skills/skill.md` passes, since a false positive teaches contributors to route around the gate and widening is cheap later
- The stage carries no exemption list, and one waits for the first hit someone argues for

### Skill provenance

The Skill provenance stage calls `auditSkills` in-process and fails on every ISO date its `datedProvenance` finding reads in a `SKILL.md` or `references/` file, outside a fence or code span, across `claude/skills/` and `.claude/skills/`. The failure names each file, line, and date, and points the incident at `REQUIREMENT.md` under `Gap` or at git.

- A tree holding neither corpus reports unmeasured
- It fails outright because the corpus sits at zero and a report-only phase would have nothing to wait for
- `canon claude skills audit` prints the same finding and keeps its exit on a missing requirement alone, so a target is told and never fails, which is why the stage reads the report in-process

### Skill practice shape

The Skill practice shape stage calls `auditSkills` in-process and fails on every `practiceShape` finding, naming each listed practice skill and the closing H2 or ledger it lacks, or the listed skill itself when no folder under `claude/skills/` matches it. It fails for the same reason as Skill provenance, since every listed skill is held at zero.

It reports unmeasured when `claude/skills/` is absent rather than when both corpora are, since the list names shipped folders alone and a tree carrying only `.claude/skills/` would otherwise pass without reading a practice skill.

### Skill family

The Skill family stage calls `auditSkills` in-process and fails on every `family` finding, naming each skill under `claude/skills/` whose `metadata.family` is missing or names no key in `src/claude/skills-families.ts`. The verb reports the same finding and keeps its exit on a missing requirement alone.

The field needs a stage because no other stage reads the skill map. Its only reader is the web build, which CI runs when a skill or the map changes and `bun run check` never runs, so a skill with no family would reach the push and fail there. Internal skills take no family, and a tree without `claude/skills/` reports unmeasured.
