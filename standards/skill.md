---
title: Claude skill reference
description: Claude skill structure and authoring rules
---

# Claude skill reference

## Overview

Skills give Claude Code domain-specific constraints and rules inline, so it can act immediately without reading all docs. Each skill body contains actionable rules for its domain. Full reference docs are the fallback for edge cases and deeper context. Skills use progressive disclosure: Claude reads only frontmatter at session start (~100 tokens each), matches a query against descriptions, then loads the full skill body.

## Scope

Governs a skill folder under `skills/` as one artifact: `SKILL.md`, its siblings `REQUIREMENT.md` and `EVAL.md`, and the bundled reference, script, and asset folders beside them.

Does not govern:

- Path-scoped coding rules, which load on a file match rather than on a request match: `rule.md`
- Single-purpose chat prompts carrying no frontmatter, references, or scripts: `snippets.md`
- Voice, rhythm, and sentence construction in a skill body: the `write-human` skill
- Punctuation, formatting, and word choice in a skill body: `markdown.md`
- The transform from a branch name to a slug a skill carries in a filename: `slug.md`
- The domain conventions a skill cites, each of which belongs to the standard that owns it
- Whether a new skill earns its place: the three-question test in the `create-skill` skill and the clause in `570-skill.md`

## Changing a skill

Answer all four before editing, and carry the answers into wherever the change is proposed.

- What problem does this solve? Name the run that went wrong, rather than the improvement the change makes.
- Which surface owns the rule today? A rule already stated in a standard, a governance rule, or a sibling skill is cited or moved, never restated in the body.
- What deterministic check catches a regression? Name it, or say none exists and the step holds on a session reading it.
- What does this collide with? Name the sibling skill, rule, or requirement it contradicts, or state that nothing does.

The second question is the one that decides between a body and a rule, which the next section tests in two parts.

## Whether a rule belongs beside the skill

A skill fires when a session invokes it or its description matches the request. A path-scoped rule fires when a session reads a file matching its glob, with no decision from the session at all. The two are layers rather than alternatives, so the rule is the floor and the skill is the depth.

Run the two-part test over what the body states before calling the skill finished. Does the invariant fire when a specific path is edited, and does violating it ship silently? An invariant passing both halves belongs in a rule as well, because a session that never invoked the skill still edits that path and needs the floor under it. An invariant failing either half stays here, which is most of a body, since procedure and orientation are what a rule cannot carry.

Write that rule to the shape `rule.md` sets and leave the procedure here, since the two carry one invariant at two depths rather than two copies of it. Nothing checks the split. The checkpoint is a judgment prompt rather than an invariant, so it ships as prose with no gate behind it, and a skill that skips it fails silently in the same way the invariants it is meant to catch do.

## Skill types

Pick the type before writing. It decides the body shape.

- Reference: conventions, patterns, and domain knowledge Claude applies inline. The body is rule bullets grouped by concern.
- Task: step-by-step workflows Claude executes as actions. The body is numbered steps plus the rules constraining them.

Reference template:

```markdown
---
name: <skill-name>
description: <what it does, when to use it, trigger phrases>
---

# <Topic>

## <Concern group>

- <actionable constraint>
- <preference in X over Y form>
```

Task template:

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
- Name a file sitting directly in the skill folder in capitals and a bundled folder in lowercase, so the parts a reader opens are distinct from the ones a skill loads
- `EVAL.md` holds prompts and a judging rubric a person runs by hand, which is the path open to everyone. `claude plugin eval` is the automated one and it is gated in early access, refusing before it parses a target, so write the hand-run rubric and know that the runner exists rather than that it does not
- `SKILL.md` must start with YAML frontmatter between `---` delimiters
- No `README.md` inside the skill folder
- No spaces, capitals, or underscores in folder or skill name

## Requirement

`REQUIREMENT.md` states what a skill is for, so a proposed change can be argued against something and the corpus can be read to decide whether a skill should exist at all. This standard governs shape across the corpus and the requirement governs scope and behavior for one skill. Claude Code loads `SKILL.md` as the entry and ignores the sibling, so the file costs a target session nothing.

The file serves a second purpose beside the argument. A skill body is procedural by design, so what the skill is for sits spread across its steps rather than stated in one place. The requirement is the compressed statement a reader gets before opening the body, and that purpose holds whether or not the skill's scope is contested.

Read it before editing the skill. When a change closes no gap the requirement states, change the requirement first or drop the change.

Write the gaps from what the skill is for, then compare the body against them. Deriving the requirement from the body is circular, because a requirement reverse-engineered from an overfitted skill records the overfitting as the requirement. That failure costs more under the orientation purpose than under the argument one, since a file summarizing the body misinforms whoever reads it in place of the body rather than merely failing to gate a change.

Every skill carries one. Coverage was selective while the file existed only to disambiguate a contested boundary, and a file present for some skills and absent for others cannot be scanned, because an absence reads as a gap rather than as a verdict. A skill whose scope nobody contests still owes the statement, since the reader deciding whether a skill should exist reads the corpus rather than one entry. A new skill is created with the sibling beside it rather than acquiring one in a later sweep.

### What a working requirement looks like

A requirement works when a proposed change to the skill can be settled by reading it alone, without re-deriving what the skill is for:

- Does this change close a gap the file states?
- Does a line already in the body trace to one of those gaps?
- Does this behavior belong to this skill or to a sibling the file names?

A requirement that leaves any of the three open is non-conforming regardless of whether it satisfies every shape rule below. The third question is what makes a requirement worth more than a restated description, because a boundary stated only in prose is never checked against the skill on the other side of it.

- State each gap as an observed failure, not an intent. "Without this skill a session invents its own filename" can be shown wrong. "This skill helps manage tasks" cannot fail, so it constrains nothing.
- Trace everything under `## Must` to a stated gap. A `Must` with no gap behind it is the padding the file exists to prevent.
- Keep it high level. A requirement that outgrows one file has stopped being a requirement, and `references/` already holds detail.
- Use `name` and `description` frontmatter, matching `SKILL.md` so the pair is consistent.

```markdown
---
name: <skill-name>
description: <one line, distinct from the SKILL.md description>
---

# <Skill name> requirement

## Gap

Without this skill, a session <observed failure>, <observed failure>.

## Must

- <behavior that closes a named gap>

## Must not

- <behavior that would be wrong even though it closes a gap>

## Guards

- <the refusal condition and its message>

## Out of scope

- <the adjacent thing this deliberately does not cover, and what covers it>
```

## Frontmatter

- `name` (required): kebab-case, matches folder name, no spaces or capitals
- `description` (required): what it does + when to use it, under 1024 chars, no XML tags
- `disable-model-invocation: true`: user-invoked only, Claude will not auto-trigger. Set it on a skill that starts a process the operator owns, never on one reachable by a matched trigger. The field marks that boundary, not a style preference.
- `allowed-tools`: restrict tool access when the skill is active
- `metadata`: optional key-value pairs (`author`, `version`, `mcp-server`)

## Description

- Structure: `[What it does] + [When to use it] + [Key trigger phrases]`
- Include specific phrases users would say to trigger it
- Be specific, not vague. Claude routes based on this field alone.
- Add negative triggers if skill is over-triggering: `Do NOT use for X`

## Body

### Voice and headings

- Use imperative voice throughout
- Use sentence case for all headings (H1, H2, H3)

### Rule content and scope

- Front-load critical instructions
- Contain only behavioral rules (what to do, what not to do) and pointers to reference docs. Narrative descriptions of what files are or how the system works belong in `docs/`, not in the skill body.
- State rules, not inventories. Reference docs for lists that change, and phrase a rule as a ban on the forbidden shape rather than an enumeration of allowed options, so it stays stable as categories change.
- Cut any rule that resists crisp one-line phrasing. Vague guidance is worse than none.
- Group bullets under H2 headings by domain concern. Keep dos and don'ts together under the topic they belong to rather than splitting them into flat rules and constraints sections.
- One actionable constraint per bullet. Prefer the `X over Y` form for preferences.
- Do not include code examples unless a one to three line inline snippet captures a pattern the model cannot infer.
- Do not duplicate general knowledge the model already has. Focus on project-specific conventions and preferences.

### Progressive disclosure

- Look at a body once it passes 150 lines. The number prompts a look rather than gating a build, so nothing enforces it and a body carrying nothing but procedure stays whole at any length.
- Move a catalog, a table of cases, or a format spec running past roughly 15 lines to `references/`. Procedure prose stays, since a session sent to a reference for its own steps pays two reads for one job.
- Name the branch that skips a block before moving it. Body lines are paid on every invocation and a reference only when the body sends the session to it, so a block every run dereferences costs a read and saves nothing.
- Keep the trigger, the skip condition, and the guard in the body. A run that never reaches the block has to decide that without opening the reference.
- Never point one skill at a sibling skill's folder for a reference both read. Each skill carries its own copy under `references/`, generated rather than hand-copied by the rule in `## Path resolution`.
- Use progressive disclosure: `SKILL.md` for core instructions, `references/` for detail, `scripts/` for deterministic operations
- Link to `references/` files explicitly so Claude knows to load them

### Reading and running commands

- Reference a bundled `references/` or `scripts/` file with `${CLAUDE_SKILL_DIR}/<path>`, never a bare relative path. A bare path resolves against the session cwd and fails when a plugin skill runs from another project. `${CLAUDE_SKILL_DIR}` expands to the skill's own directory at render time and resolves from any cwd.
- When referencing project files, include "from the project root" in the read instruction
- When executing multiple independent operations (file reads, shell commands), run them in parallel to reduce latency

### Anti-patterns to avoid

- Avoid flags that dispatch between alternate flows. The model misreads them and runs the vanilla path. Dry-run-style toggles are fine. For alternate flows, prefer a separate skill or manual invocation of two skills in sequence.
- When a skill should fire from multiple callers, rely on description matching with strong trigger phrases. Do not hardcode `Skill` calls in sibling skills that could trigger it naturally.
- Before collapsing a manual multi-step flow into a skill, ask what the manual pauses do. Pauses that carry external timing, error-surfacing, or judgment weight are the feature. Prefer a snippet over a skill, or require explicit per-step confirmation.

### Output and tuning

- Skill success lines emit the full relative path from the project root (`<dir>/<file>`) for any file written, updated, or deleted. A bare filename names a file the reader cannot open. The `## Output` section of the project's instruction file sets the form that path takes, so a skill body states which path is emitted and leaves the form to that section.
- Before a skill writes anything, decide whether the output is a deliverable the project keeps or a toolkit session record. A deliverable lands among the project's own tracked files. A session record lands under `.canon/`, in the named subfolder for its kind (`tasks/`, `plans/`, `review/`, `memory/`, `groundwork/`, `intake/`, `proposals/`, `diagrams/`, or `teach/`, with `tmp/` for scratch nothing else claims), never in a folder the body invents. `canon/ARCHITECTURE.md`'s per-folder decisions are the precedent for which kind takes which folder.
- Codify a skill's posted or generated output as a fenced template, and keep the body consistent with every capability the frontmatter description names.
- When a skill gathers user input or pre-seeds a template, attach a concrete proposed default to every question, derived from project context. Accept "use defaults" as a bulk-confirm.
- Separate correctness axes (routing, sourcing, escalation, decline) from shape axes (line count, formatting, variant sprawl) when tuning a skill. Tighten only on correctness regressions. Do not convert soft caps to hard caps for aesthetic drift when correctness passes.

## Scripts

- Use `scripts/` for operations that must be deterministic or repetitive
- Claude executes scripts and receives stdout. Scripts are not loaded into context.
- Use XML tags in script output for reliable parsing: `<SECTION>content</SECTION>`
- Use `#!/usr/bin/env bash` shebang
- Always include `2>/dev/null || echo "FALLBACK"` guards on git and shell commands

## Path resolution

A skill reads from two roots. Know which one a file lives under before referencing it.

- Bundled skill assets (`references/`, `scripts/`, `assets/`) resolve against the skill's own directory in the source clone. Reference them with `${CLAUDE_SKILL_DIR}/<path>`, never a bare relative path, so a plugin skill running from another project still finds them.
- Installed shared docs (`.claude/rules/`, `canon/context/`) resolve against the target project cwd, where install placed them. Reference them by that path.
- Do not hand-copy a standard into a skill. A hand-copied file drifts from its source and belongs to no owner. If a skill must carry its own copy, generate it from the single source and reference it through `${CLAUDE_SKILL_DIR}`, so one owner keeps every copy in sync.

### Citing a standard

No standard installs into a project, so a body cites one place rather than choosing between two.

- Cite `${CLAUDE_SKILL_DIR}/../../standards/X.md`. The plugin ships the whole standards folder beside `skills/`, so the path resolves in every install and needs no fallback behind it.
- Never cite `.claude/standards/X.md` from a shipped body. A target holds no such folder, and one left behind by an older toolkit is a stale copy no resolver reads. <!-- audit-ignore-citations: .claude/standards/X.md -->
- Name `canon standards X` instead where the body wants the document rather than a path to open, such as a value it captures or reports. That verb resolves `standards/` at the project root and then the corpus inside the package.
- State the path once per body, at the site that reads the standard. A later mention of a standard the body already read stays bare, since repeating the path at every mention is noise rather than instruction.
- A guard on a standard's presence names the file rather than the folder holding it, since a folder test answers for a sibling that happens to be there.
- Use `${CLAUDE_SKILL_DIR}`, never a bare `../../` and never `${CLAUDE_PLUGIN_ROOT}`. Only `${CLAUDE_SKILL_DIR}` is expanded before the body reaches the model. The other two leave the model to infer a base path, which it may resolve against the session cwd instead.
- Cite a shared procedure, never restate it. A procedure two or more skills execute gets one definition in a standard and a citation in each body. Nothing catches a restatement that drifts, because the drift assertion covers generated copies and a hand-written one is not generated, so the guarantee is only that a single definition exists to correct.
- Keep the trigger in the body and the procedure in the standard. The citing skill states when the procedure runs and what it runs against, since that varies per skill and the standard cannot know it.

## Invocation

- Skills auto-trigger when Claude matches the request against the description
- Invoke manually with `/skill-name` or `/<plugin>:skill-name` for plugin skills
- Plugin skills are namespaced: `plugin-name:skill-name`
- Priority order when names conflict: enterprise > personal > project > plugin

## Execution

- Task skills with preview+execute patterns must execute commands immediately after outputting the preview. Do not include "confirm before running" language or pause for user input.
- Claude Code's tool permission dialog is the confirmation gate. The user hits Enter to approve or Escape to interrupt and revise.

## Examples

### Correct

```markdown
---
name: code-review
description: Reviews code for bugs, clarity, and standards compliance. Use when asking to review code, check a PR, or asking "does this look right".
---

# Code review

Before reviewing, read from the project root:

- `CLAUDE.md`: project conventions and behavior rules
- `.claude/rules/`: path-scoped coding rules

## Guards

- If no file or diff is provided, stop: `❌ No code to review. Provide a file or diff.`

## Response format

- **Issues found:** <count>
- **Summary:** <one line>

List each issue with file, line, and suggested fix.
```

### Incorrect

```markdown
---
name: code-review
description: Handles all code-related tasks in scripts/, src/, and lib/. Also activate when user mentions bugs, refactoring, testing, linting, formatting, or any file ending in .ts .js .py .sh. # path-focused + keyword-stuffed
---

# Code review

A good code review should check for bugs, performance issues, security vulnerabilities,
code style, naming conventions, test coverage, documentation, error handling,
edge cases, and adherence to SOLID principles... # dumps everything inline instead of referencing standards
```
