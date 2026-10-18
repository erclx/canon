---
title: Claude skill reference
description: Skill structure and authoring rules for Claude Code
---

# Claude skill reference

Checked against the [Claude Code skills](https://code.claude.com/docs/en/skills) and [skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) pages on `2026-10-18`.

## Contents

- [Overview](#overview)
- [Scope](#scope)
- [Changing a skill](#changing-a-skill)
- [Whether a rule belongs beside the skill](#whether-a-rule-belongs-beside-the-skill)
- [Skill types](#skill-types)
- [Structure](#structure)
- [Frontmatter](#frontmatter)
- [Description](#description)
- [Body](#body)
- [Scripts](#scripts)
- [Invocation](#invocation)
- [Examples](#examples)

## Overview

Skills give Claude Code domain-specific constraints and rules inline, so it can act immediately without reading all docs.

## Scope

Governs a skill folder under `skills/` as one artifact, being `SKILL.md`, its siblings `REQUIREMENT.md` and `EVAL.md`, and the bundled reference, script, and asset folders beside them.

Does not govern:

- **`skill-requirement.md`**: what a `REQUIREMENT.md` must answer, its sections, and its template
- **`skill-practice.md`**: a practice skill's closing sections and ledger
- **`skill-paths.md`**: which root a path in a body resolves against, and how a body cites another skill's reference
- **`skill-reference.md`**: the jurisdiction, success criterion, and rule phrasing of a reference setting one artifact's shape
- **`rule.md`**: path-scoped coding rules, which load on a file match rather than on a request match
- **the `write-human` skill**: voice, rhythm, and sentence construction in a skill body
- **`markdown.md`**: punctuation, formatting, and word choice in a skill body
- **`slug.md`**: the transform from a branch name to a filename slug
- **the `create-skill` skill and the creation-time bullet in the `skill` governance rule**: whether a new skill earns its place, by the three-question test

## Changing a skill

Answer all four before editing, and carry the answers into wherever the change is proposed.

- What problem does this solve? Name the run that went wrong, rather than the improvement the change makes.
- Which surface owns the rule today? A rule already stated in a standard, a governance rule, or a sibling skill is cited or moved, never restated in the body.
- What deterministic check catches a regression? Name it, or say none exists and the step holds on a session reading it.
- What does this collide with? Name the sibling skill, rule, or requirement it contradicts, or state that nothing does.

## Whether a rule belongs beside the skill

A skill fires when a session invokes it or its description matches the request. A path-scoped rule fires when a session reads or writes a file matching its glob, with no session decision. The rule is the floor and the skill is the depth.

- Run the two-part test over the body before calling the skill done. Does the invariant fire when a specific path is edited, and does violating it ship silently?
- An invariant passing both halves moves to a rule, since a session that never invoked the skill still edits that path. It stays here when this skill creates the file the rule globs.
- An invariant failing either half stays here, which is most of a body

Write that rule to the shape `rule.md` sets, keeping one copy of each invariant. A skill that only edits existing files points at the rule.

## Skill types

Pick the type before writing. It decides the body shape.

- Reference: conventions, patterns, and domain knowledge Claude applies inline. The body is rule bullets grouped by concern.
- Task: step-by-step workflows Claude executes as actions. The body is numbered steps plus the rules constraining them.
- Practice: judgment a session may skip, shaped by `skill-practice.md`.

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

A skill is a folder named in kebab-case. It holds `SKILL.md` and `REQUIREMENT.md`, both required, and maybe `EVAL.md`, `scripts/`, `references/`, and `assets/`.

- Create a new skill with its `REQUIREMENT.md` beside it, even where nobody contests its scope, since an absence reads as a gap rather than as a verdict
- Name a file sitting directly in the skill folder in capitals and a bundled folder in lowercase, so the parts a reader opens differ from the ones a skill loads
- `EVAL.md` holds prompts and a judging rubric a person runs by hand, since the automated `claude plugin eval` runner is gated in early access

### Folder and file rules

The loader reads the folder name as the skill name, so the name follows the same casing everywhere.

- `SKILL.md` must start with YAML frontmatter between `---` delimiters
- No `README.md` inside the skill folder
- No spaces, capitals, or underscores in folder or skill name

## Frontmatter

Read `skill-frontmatter.md` for the required and optional fields, their limits, and which keys an upload accepts.

## Description

- Structure: `[What it does] + [When to use it] + [Key trigger phrases]`, quoting phrases users would say
- Be specific, not vague. Claude routes based on this field alone.
- Write in the third person, since the description is injected into the system prompt. Write "Reviews code" over "I review code".
- Add negative triggers if skill is over-triggering: `Do NOT use for X`. That form is canon's own, and Anthropic's pages do not mention it.

## Body

### Rule content and scope

A body holds behavioral rules and pointers to reference docs, front-loading the critical ones. Narrative about what files are or how the system works belongs in `docs/`.

- Use imperative voice throughout, and sentence case for every heading
- State rules, not inventories. Reference docs for lists that change.
- Phrase a rule as a ban on the forbidden shape rather than an enumeration of allowed options, so it stays stable as categories change
- When referencing project files, include "from the project root" in the read instruction
- Run independent operations, such as file reads and shell commands, in parallel to reduce latency

### Current rule and grouping

State the current rule only, in the body and in every file under `references/`. The incident and the date that earned a rule stay in git, and a date inside a fence or a code span is example data and stays.

- Cut any rule that resists crisp one-line phrasing. Vague guidance is worse than none.
- Group bullets under H2 headings by concern, keeping dos and don'ts together rather than in flat rules and constraints sections
- One actionable constraint per bullet. Prefer the `X over Y` form for preferences.

### Examples and density

Every statement in a body costs a read on each invocation.

- Do not include code examples unless a one to three line inline snippet captures a pattern the model cannot infer
- Keep a statement only when removing it would change what the agent does, naming a principle as a few-word handle rather than explaining it
- Revisit when a run shows the model ignoring a principle named only as a handle

### Progressive disclosure

Keeping a body and its references under the ceiling, what moves to `references/` and what stays, and how a body names a reference are in `skill-disclosure.md`.

### Anti-patterns to avoid

Avoid flags that dispatch between alternate flows, since the model misreads them and runs the vanilla path. Dry-run-style toggles are fine, and an alternate flow takes a separate skill or two skills invoked in sequence.

- When a skill should fire from multiple callers, rely on description matching with strong trigger phrases. Do not hardcode `Skill` calls in sibling skills that could trigger it naturally.
- Before collapsing a manual multi-step flow into a skill, ask what the manual pauses do
- Where a pause carries external timing, error-surfacing, or judgment weight, prefer explicit per-step confirmation

### Output paths

A success line emits the full relative path from the project root (`<dir>/<file>`) for any file written, updated, or deleted, since a bare filename names a file the reader cannot open. The `## Output` section of the project's instruction file sets the form that path takes, so the body states which path and leaves the form to that section.

### Where output lands

Before writing, decide whether the output is a deliverable, which lands among the project's tracked files, or a session record. A session record lands under `.canon/` in the named subfolder for its kind, never in a folder the body invents.

- Kinds: `tasks/`, `plans/`, `review/`, `groundwork/`, `intake/`, `proposals/`, `diagrams/`, `teach/`, `ready/`, `feedback/`, `picks/`, `evidence/`, `transcripts/`, `walkthroughs/`
- `tmp/` takes scratch nothing else claims
- A `review/` writer names its file `<kind>-<slug>.md` and writes it flat
- An `evidence/` folder takes the next two-digit ordinal as `<nn>-<slug>/`, numbered in the order the folders first appeared

### Templates, input, and tuning

Codify a skill's posted or generated output as a fenced template, and keep the body consistent with every capability the frontmatter description names.

- When a skill gathers input or pre-seeds a template, attach a proposed default derived from project context to every question. Accept "use defaults" as a bulk-confirm.
- Separate correctness axes (routing, sourcing, escalation, decline) from shape axes (line count, formatting, variant sprawl) when tuning a skill
- Tighten only on correctness regressions, never turning a soft cap hard for aesthetic drift

## Scripts

Use `scripts/` for operations that must be deterministic or repetitive. First ask whether a CLI verb the project already has does the job, since a verb is installed and tested and a script beside it is a second copy that drifts.

- Write a script in TypeScript and run it as `bun ${CLAUDE_SKILL_DIR}/scripts/<name>.ts`. Keep bash for a few lines that start one command.
- Import no package. A plugin loads from a cache that carries no `node_modules`, so only `node:` built-ins and the CLIs the skill already requires resolve.
- Use XML tags in script output for parsing: `<SECTION>content</SECTION>`
- Guard a git or shell command a body runs inline with `2>/dev/null || echo "FALLBACK"`. A TypeScript script uses try and catch instead.

The TypeScript rule governs a new script, so bash kept by decision is no breach and is not ported unasked. Examples are `review-ui`'s `scripts/pw.sh` as glue and the shell scripts the web tooling stacks ship, whose port was deferred.

## Invocation

- Invoke a plugin skill by its namespaced name, `/<plugin>:<skill-name>`.
- Task skills with preview+execute patterns execute commands immediately after outputting the preview, with no "confirm before running" pause, since the tool permission dialog is the confirmation gate.

## Examples

### Correct

Each line names its reason after the `#`.

- `description: Reviews code for bugs and clarity. Use when asked to "review this" or "check the PR".` # names the action, then the trigger phrases
- `Read ${CLAUDE_SKILL_DIR}/references/post.md on reaching this step.` # a moved step keeps its heading and one load line

### Incorrect

Each line names its fault after the `#`.

- `description: Handles all code tasks in scripts/, src/, and lib/, and any file ending in .ts .js .py .sh.` # path-focused and keyword-stuffed
- `A good review checks bugs, performance, security, style, naming, coverage, docs, and SOLID...` # dumps everything inline instead of citing a standard
