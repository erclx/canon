---
title: Claude skill reference
description: Claude skill structure and authoring rules
---

# Claude skill reference

## Overview

Skills give Claude Code domain-specific constraints and rules inline, so it can act immediately without reading all docs.

## Scope

Governs a skill folder under `skills/` as one artifact: `SKILL.md`, its siblings `REQUIREMENT.md` and `EVAL.md`, and the bundled reference, script, and asset folders beside them.

Does not govern:

- What a `REQUIREMENT.md` must answer, its sections, and its template: `skill-requirement.md`
- Path-scoped coding rules, which load on a file match rather than on a request match: `rule.md`
- Voice, rhythm, and sentence construction in a skill body: the `write-human` skill
- Punctuation, formatting, and word choice in a skill body: `markdown.md`
- The transform from a branch name to a slug a skill carries in a filename: `slug.md`
- Whether a new skill earns its place: the three-question test in the `create-skill` skill and the clause in `570-skill.md`

## Changing a skill

Answer all four before editing, and carry the answers into wherever the change is proposed.

- What problem does this solve? Name the run that went wrong, rather than the improvement the change makes.
- Which surface owns the rule today? A rule already stated in a standard, a governance rule, or a sibling skill is cited or moved, never restated in the body.
- What deterministic check catches a regression? Name it, or say none exists and the step holds on a session reading it.
- What does this collide with? Name the sibling skill, rule, or requirement it contradicts, or state that nothing does.

## Whether a rule belongs beside the skill

A skill fires when a session invokes it or its description matches the request. A path-scoped rule fires when a session reads a file matching its glob, with no decision from the session at all. The rule is the floor and the skill is the depth.

Run the two-part test over what the body states before calling the skill finished. Does the invariant fire when a specific path is edited, and does violating it ship silently? An invariant passing both halves belongs in a rule as well, since a session that never invoked the skill still edits that path. An invariant failing either half stays here, which is most of a body.

Write that rule to the shape `rule.md` sets and leave the procedure here, since the two carry one invariant at two depths rather than two copies of it. Nothing checks the split.

## Skill types

Pick the type before writing. It decides the body shape.

- Reference: conventions, patterns, and domain knowledge Claude applies inline. The body is rule bullets grouped by concern.
- Task: step-by-step workflows Claude executes as actions. The body is numbered steps plus the rules constraining them.

A task skill takes the template below. A reference skill takes the same frontmatter and replaces `## Steps` and `## Rules` with one H2 per concern group, each holding constraint bullets.

```markdown
---
name: <skill-name>
description: <the action and when to use it>
allowed-tools: <tools required>
---

# <Action name>

## Steps

1. <action>
2. <action>

## Rules

- <constraint on how the steps run>
- <constraint on output format>
```

## Structure

- Skill is a folder named in kebab-case containing `SKILL.md` (required), `REQUIREMENT.md` (required), `EVAL.md` (optional), `scripts/` (optional), `references/` (optional), `assets/` (optional)
- Create a new skill with its `REQUIREMENT.md` beside it, even where nobody contests its scope. A requirement present for some skills and absent for others cannot be scanned, since an absence reads as a gap rather than as a verdict
- Name a file sitting directly in the skill folder in capitals and a bundled folder in lowercase, so the parts a reader opens are distinct from the ones a skill loads
- `EVAL.md` holds prompts and a judging rubric a person runs by hand, since the automated `claude plugin eval` runner is gated in early access
- `SKILL.md` must start with YAML frontmatter between `---` delimiters
- No `README.md` inside the skill folder
- No spaces, capitals, or underscores in folder or skill name

## Frontmatter

- `name` (required): kebab-case, matches folder name, no spaces or capitals
- `description` (required): what it does + when to use it, under 1024 chars, no XML tags
- `disable-model-invocation: true`: user-invoked only, Claude will not auto-trigger. Set it on a skill that starts a process the operator owns, never on one reachable by a matched trigger.
- `allowed-tools`: restrict tool access when the skill is active
- `metadata`: optional key-value pairs (`author`, `version`, `mcp-server`)

## Description

- Structure: `[What it does] + [When to use it] + [Key trigger phrases]`, quoting phrases users would say
- Be specific, not vague. Claude routes based on this field alone.
- Add negative triggers if skill is over-triggering: `Do NOT use for X`

## Body

### Rule content and scope

- Use imperative voice throughout, and sentence case for every heading
- Front-load critical instructions
- Contain only behavioral rules (what to do, what not to do) and pointers to reference docs. Narrative descriptions of what files are or how the system works belong in `docs/`, not in the skill body.
- State rules, not inventories. Reference docs for lists that change, and phrase a rule as a ban on the forbidden shape rather than an enumeration of allowed options, so it stays stable as categories change.
- Cut any rule that resists crisp one-line phrasing. Vague guidance is worse than none.
- State the current rule only, in the body and in every file under `references/`. The incident and the date that earned a rule go in `REQUIREMENT.md` under `Gap`, or stay in git. A date inside a fence or a code span is example data and stays.
- Group bullets under H2 headings by domain concern. Keep dos and don'ts together under the topic they belong to rather than splitting them into flat rules and constraints sections.
- One actionable constraint per bullet. Prefer the `X over Y` form for preferences.
- Do not include code examples unless a one to three line inline snippet captures a pattern the model cannot infer.
- Do not duplicate general knowledge the model already has. Focus on project-specific conventions and preferences.

### Progressive disclosure

- Keep `SKILL.md` and each file under `references/` at or under the 300 rendered line ceiling `markdown.md` sets for a whole document. The ceiling binds procedure as much as reference material.
- Look at a body once it passes 150 lines. That number prompts a look and gates nothing.
- Move a catalog, a table of cases, or a format spec running past roughly 15 lines to `references/` at any body length.
- Below the ceiling, name the branch that skips a block before moving it. A block every run dereferences costs a read and saves nothing.
- Past the ceiling, move a whole step to a reference, preferring a step a named branch skips. Keep the step heading in the body with one line naming the file to read on reaching it, so the body still shows every step in order.
- Name every file under `references/` in the body at the point a session reads it, since an unnamed reference is never loaded.
- Keep the trigger, the skip condition, and the guard in the body. A run that never reaches the block has to decide that without opening the reference.
- Never point one skill at a sibling skill's folder for a reference both read. Each skill carries its own copy under `references/`, generated rather than hand-copied by the rule in `## Path resolution`.

### Reading and running commands

- When referencing project files, include "from the project root" in the read instruction
- When executing multiple independent operations (file reads, shell commands), run them in parallel to reduce latency

### Anti-patterns to avoid

- Avoid flags that dispatch between alternate flows. The model misreads them and runs the vanilla path. Dry-run-style toggles are fine. For alternate flows, prefer a separate skill or manual invocation of two skills in sequence.
- When a skill should fire from multiple callers, rely on description matching with strong trigger phrases. Do not hardcode `Skill` calls in sibling skills that could trigger it naturally.
- Before collapsing a manual multi-step flow into a skill, ask what the manual pauses do. Where a pause carries external timing, error-surfacing, or judgment weight, prefer explicit per-step confirmation.

### Output and tuning

- Skill success lines emit the full relative path from the project root (`<dir>/<file>`) for any file written, updated, or deleted. A bare filename names a file the reader cannot open. The `## Output` section of the project's instruction file sets the form that path takes, so a skill body states which path is emitted and leaves the form to that section.
- Before a skill writes anything, decide whether the output is a deliverable the project keeps or a toolkit session record. A deliverable lands among the project's own tracked files. A session record lands under `.canon/`, in the named subfolder for its kind (`tasks/`, `plans/`, `review/`, `memory/`, `groundwork/`, `intake/`, `proposals/`, `diagrams/`, `teach/`, `ready/`, `feedback/`, `picks/`, `evidence/`, `transcripts/`, or `walkthroughs/`, with `tmp/` for scratch nothing else claims), never in a folder the body invents. A `review/` writer names its file `<kind>-<slug>.md` and writes it flat, and an `evidence/` folder takes the next two-digit ordinal as `<nn>-<slug>/`, numbered in the order the folders first appeared.
- Codify a skill's posted or generated output as a fenced template, and keep the body consistent with every capability the frontmatter description names.
- When a skill gathers user input or pre-seeds a template, attach a concrete proposed default to every question, derived from project context. Accept "use defaults" as a bulk-confirm.
- Separate correctness axes (routing, sourcing, escalation, decline) from shape axes (line count, formatting, variant sprawl) when tuning a skill. Tighten only on correctness regressions, never turning a soft cap hard for aesthetic drift.

## Scripts

- Use `scripts/` for operations that must be deterministic or repetitive
- Use XML tags in script output for reliable parsing: `<SECTION>content</SECTION>`
- Use `#!/usr/bin/env bash` shebang
- Always include `2>/dev/null || echo "FALLBACK"` guards on git and shell commands

## Path resolution

A skill reads from two roots, so know which one a file lives under before referencing it.

- Bundled skill assets (`references/`, `scripts/`, `assets/`) resolve against the skill's own directory. Reference them with `${CLAUDE_SKILL_DIR}/<path>`, never a bare relative path, which resolves against the session cwd and fails when a plugin skill runs from another project.
- Installed shared docs (`.claude/rules/`, `canon/context/`) resolve against the target project cwd, where install placed them. Reference them by that path.
- Do not hand-copy a standard into a skill. If a skill must carry its own copy, generate it from the single source and reference it through `${CLAUDE_SKILL_DIR}`, so one owner keeps every copy in sync.

### Citing a standard

No standard installs into a project, so a body cites one place rather than choosing between two.

- Cite `${CLAUDE_SKILL_DIR}/../../standards/X.md`. The plugin ships the whole standards folder beside `skills/`, so the path resolves in every install.
- Never cite `.claude/standards/X.md` from a shipped body. A target holds no such folder. <!-- audit-ignore-citations: .claude/standards/X.md -->
- Name `canon standards X` instead where the body wants the document rather than a path to open, such as a value it captures or reports. That verb resolves `standards/` at the project root and then the corpus inside the package.
- State the path once per body, at the site that reads the standard. A later mention of a standard the body already read stays bare, since repeating the path at every mention is noise rather than instruction.
- A guard on a standard's presence names the file rather than the folder holding it, since a folder test answers for a sibling that happens to be there.
- Use `${CLAUDE_SKILL_DIR}`, never a bare `../../` and never `${CLAUDE_PLUGIN_ROOT}`, since only the first expands before the body reaches the model.
- Cite a shared procedure, never restate it. A procedure two or more skills execute gets one definition in a standard and a citation in each body.
- Keep the trigger in the body and the procedure in the standard. The citing skill states when the procedure runs and what it runs against, since that varies per skill and the standard cannot know it.

## Invocation

- Invoke a plugin skill by its namespaced name, `/<plugin>:<skill-name>`.
- Task skills with preview+execute patterns execute commands immediately after outputting the preview, with no "confirm before running" pause, since the tool permission dialog is the confirmation gate.

## Examples

### Correct

- `description: Reviews code for bugs and clarity. Use when asked to "review this" or "check the PR".` # names the action, then the trigger phrases
- `Read ${CLAUDE_SKILL_DIR}/references/post.md on reaching this step.` # a moved step keeps its heading and one load line

### Incorrect

- `description: Handles all code tasks in scripts/, src/, and lib/, and any file ending in .ts .js .py .sh.` # path-focused and keyword-stuffed
- `A good review checks bugs, performance, security, style, naming, coverage, docs, and SOLID...` # dumps everything inline instead of citing a standard
