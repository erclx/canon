---
title: Planning procedure
description: How a planner reads the code and outside sources in Step 2, and what it adds to the plan standard in Step 3, from success criteria to suggestions, sources, and size
---

# Planning procedure

Applies to `plan-feature` Step 2 and Step 3, between the onboarding reads and the write. The plan's sections and their contract stay in `${CLAUDE_SKILL_DIR}/references/plan.md`, and this file carries what the skill adds on top.

## Step 2: scan the source

### Read the code

The body bounds the read to the source files the feature touches. Where a folder carries an `index.md`, read it first and load only the files it points at.

Measure against the tree rather than recall, since a count carried from an earlier session or a summary is the most common way a plan ships the wrong scope.

- Open each file before describing what is in it
- Grep for each construct the plan will name and count the sites
- Confirm any work the plan sequences behind is still open
- Read `renderedLines` from `canon markdown audit <file> --json` for each markdown file the plan touches, since a raw line count reads far under the gate's measure
- Read a flat folder as a reading to place against rather than a pattern to copy, since the tree shows what exists beside a new path, not where it belongs

### Outside sources

When a decision rests on an outside practice or a third-party behavior, invoke `canon:search-craft` before searching, fetch each source, and record the passage relied on. Skip this for a plan that rests on nothing outside the project.

- Confirm exact wording through `curl` where a decision turns on it, since `WebFetch` returns a model's answer rather than the page
- Fetch a Claude Code subject from Anthropic's docs directly, starting at the index `https://code.claude.com/docs/llms.txt` and reading the `.md` form of the page it names
- Mark a source that could not be fetched as unverified rather than citing recall
- Report it rather than proceeding silently when `canon:search-craft` does not resolve

### Build or adopt

Run this for each new server, runtime, harness, or agent loop the plan would create. A plan that edits existing code skips it.

- Name the candidates that already do the job through `canon:search-craft`, including a tool the project or the platform already carries
- Judge each candidate's fit against the requirement, and record the call with its reason on the component's `## Files to touch` entry
- Read a build call with a written reason as a pass, since the check records fit and carries no bias toward adopting

## Step 3: build the plan

What this skill adds on top of the standard:

- Record each command Step 2 ran and what it showed, or the not-run reason, under `## Current behavior`, and omit the section when nothing ran
- Reframe a vague ask as success criteria before `## Files to touch`, each an observable result and its check, which becomes one `## Verification` bullet. "Make it faster" names none.
- Confirm a concrete project or use case drives the feature, and lift patterns from it where precedent exists. A feature with no named user is a guess.
- Prefer one layout that serves both a new and a grown project over a dual-mode toggle or a migration shim. Two modes double what every later change holds.
- Name `proposal-critique` for a one-way change or an unverified cause

A file at 280 rendered lines or more gets its new content placed in its entry, as a second markdown path for the reference it lands in or the split that comes first. Weigh what the plan adds too, since a file at 250 can take a 60-line section.

### Suggestions and sections

Every `- Suggested:` line takes senior judgment, picking the best option in one line with its reason or main tradeoff, and naming alternatives only when they change the pick.

- Suggest a real default when best practice, the codebase, or prior context points to one
- Before `## Files to touch`, load `canon:codebase-layout` for a new path (its reason) and `canon:api-design` for a changed verb, flag, output, record shape, or endpoint. Report either if missing.
- Fill `## Design references` per rendered surface, each folder opening on `built against` or `redrawn` as the change alters it, and `## Reference images` with each untracked image that shaped the plan
- Write `## Verification` as one bullet per outcome naming the test or command that proves it, with a grep bullet per `## Verbatim` block of settled wording
- Write `## Review focus` as the inputs or states that would break the change, carrying the risk you understood to the executor and the reviewer

### Sources and size

A small feature produces a short plan, not a padded one.

- Cite the `## Sources` entry for every decision Step 2 sourced, each with its quoted passage or the word `unverified`
- Prefer `None identified.` over low-signal fillers
- When three or more questions remain, keep chat output to the file pointer plus a short summary. Inline chat is fine when two or fewer remain.
