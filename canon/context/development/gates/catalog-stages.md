---
title: Catalog stages
description: The gate stages reading a catalog or a count, covering sandbox coverage, plugin manifest validation, skill paths, the architecture record, the document ceiling, skill provenance, and standard success criteria
---

# Catalog stages

## Sandbox coverage

`canon sandbox coverage` reports which scenarios declare expectations. The Sandbox coverage stage reads the same report and gates on it, so a scenario added with no expectation fails a push rather than sitting undeclared.

The gate is `SANDBOX_UNDECLARED_CEILING` in `src/gate/measures.ts`, an absolute count of scenarios declaring nothing, pinned at what a clean run reports. A floor under the declared count would pass the case the stage exists for, since adding an unarmed scenario leaves the declared count where it was, and a ratio moves when a scenario is legitimately deleted. The ceiling does neither: deleting an unarmed scenario lowers it, and deleting an armed one leaves it alone. Raising the number is a deliberate edit, so a branch shipping an unarmed scenario says in the diff which one and why, rather than a percentage drifting down over several merges with no single commit responsible.

`SANDBOX_ASSERTED_FLOOR`, also in `src/gate/measures.ts`, gates the same command's `--skills` census on `asserted`. A floor is the right shape here for the reason a floor was wrong for the scenario count: a dropped skill-to-scenario pairing lowers `asserted` directly. A rename that drops pairings without touching any scenario file fails this floor even while the ceiling stays green, since the ceiling counts scenarios declaring an expectation rather than skills a scenario reaches.

A coverage command that exits non-zero fails the stage under CI and warns on a contributor's machine. The scenario tree ships in the checkout, so a runner that cannot read it has a broken command rather than an absent tree, and taking the skip there would report the pass the stage exists to withhold.

## Manifest validation

The Plugin manifests stage runs `claude plugin validate --strict` over every plugin and marketplace manifest the repository carries. It always runs, because a manifest edit is not the only thing that invalidates one and the whole stage costs about a third of a second.

It discovers its inputs instead of naming them. Two `git ls-files` listings, tracked and untracked, match `*.claude-plugin/plugin.json` and `*.claude-plugin/marketplace.json`, so a marketplace manifest added later is covered the day it lands. Both listings honor `.gitignore`, which is what keeps linked worktrees and dependency copies from being validated as if they were ours.

The guard tests twice, first that `claude` resolves on `PATH` and then that `claude --version` succeeds, because a global install can land the wrapper and none of the platform-native package behind it, which leaves a name that resolves and a binary that dies on the first real call. A contributor's machine takes a skip on either failure, since an absent or half-installed CLI there is someone mid-setup. CI installs the plugin CLI as a workflow step, so both failures refuse there, and the refusal for a binary that cannot run names the pinned version rather than the install step that already succeeded.

`--strict` promotes warnings to failures, which is what makes the stage catch a manifest missing metadata rather than only one that fails to parse. The cost is that a Claude Code release introducing a new warning fails `bun run check` for everyone until the manifest answers it.

## Skill paths

The Skill paths stage runs `scripts/core/check-skill-paths.sh` over the shipped skill tree and fails on a path that resolves only in this repository. A shipped skill runs from a plugin cache in someone else's project, where this tree's top-level folders reach nothing, so a citation reading correctly here is a dead pointer everywhere the skill actually runs.

The walk reads inside fenced code blocks, which is what makes an illustrative example count. An example is the part of a reference a reader copies, so a target handed one built from this repository's own `docs/` and `wiki/` rows learns a folder set it does not have. That is a true positive rather than the fenced-example class the Seed independence stage accepts, and an example in shipped content invents its paths.

The banned pattern is a bare `wiki/` with no exemption for a body that has a reason to name it. A shipped skill routing a page into a project's wiki has to describe both spellings, and only `.claude/wiki/` survives the match, so the root spelling is stated as a folder named `wiki` rather than as a path. That is the phrasing the promotion routing in `teach-workspace` carries.

## Architecture record

The Architecture record stage calls `measureArchitecture` in-process and fails when `canon/ARCHITECTURE.md` holds more decisions than the entry cap it states or runs past the line ceiling its own allowances derive. Both limits are the record's own clauses, so a project whose record states neither passes, and a project with no record passes and says so.

It reads the record directly because the Context citations stage runs `--citations-only`, which never opens it. The count is by `###` heading outside a fence, so a heading carrying two decisions counts once, which is the undercount a writer at the cap is asked not to exploit.

## Document ceiling

The Document ceiling stage reads every markdown file git lists, sums `documentHeight` over the whole source, and names each one past `CHECKPOINTS.ceiling`, 300 rendered lines. Frontmatter and fenced blocks count, since a session pays for every line it loads. A file named `CHANGELOG.md` is exempt by name, because the release tool rewrites it and would drop a marker, and any other file is exempt only through a whole-line `<!-- canon-length-exempt: <reason> -->` outside a fence. A committed list of exempt paths was the alternative, and every rename would have made it a second edit with nothing checking it.

The stage is report-only while documents past the ceiling remain: each is a `warn` and the stage passes. Flipping it changes the measure to return a `failure` and deletes the `warn` path, once the count reads zero. `canon markdown audit` prints the same list under its Length step and never exits 2 on it, because the plan and groundwork skills run that audit on a gitignored record where a long plan is not a defect. The stage owns the verdict for the same reason the Architecture record stage owns its record's cap while `canon context audit` only reports.

A table counts at the width the formatter pads it to, so one wide cell raises every row to that width. A lookup table carrying long cells costs close to twice what the same rows cost as a bullet list, which the formatter never pads, and that conversion is the cheapest cut on a file sitting near the ceiling.

## Skill provenance

The Skill provenance stage calls `auditSkills` in-process and fails on every ISO date its `datedProvenance` finding reads in a `SKILL.md` or a `references/` file, outside a fence or a code span, across both `claude/skills/` and `.claude/skills/`. The failure names each file, line, and date, and points the incident at `REQUIREMENT.md` under `Gap` or at git. A tree holding neither corpus reports as unmeasured.

It fails outright rather than reporting, because the corpus sits at zero and a report-only phase would have nothing to wait for. `canon claude skills audit` prints the same finding under its Provenance step and keeps its exit code on a missing requirement alone, so a target running the verb is told about a date and never fails on one. The stage is what makes the finding fail here, where the corpus is held at zero, and it reads the report in-process rather than through the verb's exit for that reason.

## Standard success criteria

The Standard success criteria stage runs `bun src/cli.ts standards audit --arrivals-only`, which fails a push when a standard new to the branch carries no `## Success criterion` section. It is scoped to arrival rather than to the corpus, since `standards/standard.md` forbids writing the section into an existing standard outside the change that exercises it, and a gate over the corpus would fail every push until someone closed every known gap at once, which is the sweep that rule exists to prevent.

`--arrivals-only` prints nothing when every arriving standard carries the section, matching the Skill requirements stage's own silent-pass shape. The bare `canon standards audit` a session runs by hand reports the whole corpus instead, so the same verb serves the gate and the reader without a second command to keep in sync.
