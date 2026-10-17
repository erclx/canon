---
title: Citations
description: Verdicts for every rule and standard citing a skill or sibling document, the form that resolves for a target, the moot exception, and what the citation stage resolves and cannot
---

# Citations

## Overview

Owns whether a citation inside `governance/rules/` resolves for the target holding it, and whether the citing body points at its owner rather than restating it. It excludes a "Does not govern:" entry, which names an owner, and a rule restating a sibling rule, which `canon gov restated` covers.

## Decisions

### The form that resolves for a target

A plugin skill named with the `canon:` prefix, paired with a line reporting rather than proceeding silently when the skill does not resolve, degrades honestly. It loads for a target holding the plugin and names the gap for one holding governance alone.

A bare skill name carrying neither the prefix nor the fallback line resolves for a plugin-holding target and fails silently for every other one. That is the defect the form exists to close.

### A rule names no path into this repository

A rule ships through `canon gov sync`, and no path on a target's machine resolves to this repository's context entries. A rule states its facts and names no path, and the local answer is reached from the entry rather than from the rule.

### What the stage resolves

`canon gov citations` resolves every path a rule body cites across `governance/rules/` and `internal/rules/`, plus every frontmatter `paths:` glob under `internal/rules/`. `bun run check` gates on it as the `Rule citations` stage.

The stage answers whether a citation resolves. Whether a resolving citation points at the right file, or restates what it points at, stays a manual read.

- A rule retired alongside its standard also leaves `governance/renames.toml`, since `src/gov/renames.test.ts` fails on a chain ending on a rule nothing ships
- Measured at `2e912110`, the corpus held 36 body citations across 77 rules, being twenty `canon standards <name>`, fifteen backticked paths, and one sibling rule by filename
- All 36 resolved or were excused and every internal glob matched, so the gate is a floor rather than a repair

### What the stage cannot read

The glob half reads one corpus. A rule under `governance/rules/` installs into a target and its globs name that project's shape, so many match nothing in this tree and every one is correct. Gating them would ship an exemption list the length of the corpus. `internal/rules/` ships nowhere, so the tree it governs is the tree present.

Four bounds follow from shapes the corpus already writes.

- A placeholder or glob segment is declined, since it describes a shape rather than naming a file
- A span with no file extension is declined as a folder or module specifier, which costs any real folder path
- A path written without backticks is not read, since matching one would report every sentence that names a file
- A glob that matches real files and still misses its work is not read, since reach is a judgment about where the work happens. `lib/e2e-reliability.md` globs `**/e2e/**/*.ts` to reach `web/e2e/`.

### Excused classes

Two classes resolve to nothing and are correct to, and the stage reports both by name rather than dropping them.

- **Governed.** A path the rule spells exactly in its own `paths:` names an artifact a target holds. Only an exact declaration excuses, so a typo under a globbed folder is still a finding.
- **Ignored.** A path git ignores is session scratch no clone holds. `governance/rules/canon/tasks.md` cites `.canon/tasks/index.md`, absent from a fresh clone and every linked worktree.

The ignored class makes the counts tree-dependent. From the main worktree that path resolves and the ignored count is zero, and from a linked worktree it is one. The verdict is the same, so a quoted count names which tree it came from.

### Rules point rather than restate

`claude/skills/create-rule/references/rule.md` settles the shape. A rule points at the standard that owns a convention, loading the skill that owns it rather than naming a path.

`governance/rules/canon/tasks.md`, `plan.md`, and `context.md` are hand-written and cite no standard by name, since their standards live in `task-board`, `plan-feature`, and `context-fold`. They load the owner skill instead. `governance/rules/claude/skill.md` is hand-written because its bullets fire on a hand edit between skill runs.

### Verdicts: skill citations with prefix and fallback

Each of these cites its skill with the `canon:` prefix plus a report-if-missing line.

- `claude/skills/teach-workspace/references/teach.md` cites `canon:teach-workspace`, with the fallback "say so and stop"
- `governance/rules/claude/skill.md` cites `canon:create-skill` twice
- `claude/skills/markdown-craft/references/markdown.md` cites `canon:write-human` in prose stating where a markdown edit routes, which reads as a directive rather than a scope boundary

### Verdicts: moot, clean, and excluded

A rule scoped to a folder only a plugin skill creates is inert rather than broken for a target holding governance alone. The folder never exists there, so the glob never matches. No repair applies, and the row keeps a later pass from misreading inertness as a defect.

- Moot: `governance/rules/canon/context.md`, scoped to `canon/context/**`, where only `context-fold` writes an entry
- Clean: `governance/rules/writing/markdown.md` points at the `markdown-craft` and `write-human` skills, each with the fallback line
- Clean: `claude/skills/create-skill/references/skill.md` points at sibling references by the `${CLAUDE_SKILL_DIR}/../<skill>/references/<name>.md` form, which resolves in every install
- Clean: `claude/skills/task-board/references/tasks.md` points at `git-commit`'s `versioning.md` and `plan-feature`'s `plan.md` the same way
- Excluded: every other shape reference names `write-human` or `markdown.md` only inside a "Does not govern:" bullet

## Gotchas

### Scope lines are not citations

A "Does not govern:" line naming a skill or a sibling reference is a scope exclusion. `claude/skills/create-skill/references/skill-reference.md` requires that shape for every excluded concern, so the many `write-human` mentions across the references carry no verdict here.

### What each check misses

Three checks cover different questions, and a citation can pass one and fail another.

- `canon gov restated` catches a rule restating a sibling rule or `CLAUDE.md`, and misses one restating the standard it cites, which stays a manual read
- `canon gov citations` asks whether a cited path resolves, and `canon gov superseded` whether a citation still names a value a changed convention no longer produces
- The Consumed copies stage passes an authored rule and its copy that are wrong together, which is how the teach rule shipped a `references/glossary.md` that did not exist

A rule can carry both the restated and the moot verdict. Moot says the citation never fires for a target holding governance alone, and restated says the rule duplicated its standard regardless. Neither excuses the other.
