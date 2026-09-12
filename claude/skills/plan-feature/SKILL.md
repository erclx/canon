---
name: plan-feature
description: Plans a feature by reading the project's Claude setup and scanning relevant source files. Outputs which files to touch, risks, and ambiguities, then stops. Use before implementing anything, or when asked to "implement X", "add X", "build X", or "I want to add X". Do NOT implement. Plan only.
---

# Plan feature

## Guards

- If no feature description is provided, stop: `❌ No feature description. Describe what you want to add.`
- Do not implement anything. Output the plan and stop.
- When the feature description spans two or more independent concerns, write one plan file per concern. Do not bundle them under a single slug.

## Step 1: read the Claude setup

Read these in parallel from the project root, skipping any that do not exist:

- `CLAUDE.md`: behavior rules, conventions, commands
- `.claude/REQUIREMENTS.md`: feature scope and non-goals
- `.claude/ARCHITECTURE.md`: decisions already made
- `.canon/tasks/index.md`: current scope and status, then any task file the feature relates to

Also read these when the feature touches code or UI. Skip them for prose, docs, catalog, or config-only changes:

- `.claude/DESIGN.md`: tokens, typography, spacing, and component rules
- `.claude/wireframes/index.md` + the surface files relevant to the feature: intended UI layout and behavior. Read `index.md` first, then follow only the links the feature actually touches, each a flat `.claude/wireframes/<surface>.md` or a grouped surface's own `.claude/wireframes/<surface>/index.md` and the siblings it lists. Do not read the whole folder speculatively.

When the plan adds or revises a surface, the wireframe file follows `${CLAUDE_SKILL_DIR}/../../standards/wireframes.md`.

Coding standards live in `.claude/rules/`. Claude Code loads them automatically. Path-scoped rules apply to the files they match.

## Step 2: scan relevant source files

Based on the feature description, identify and read source files that are directly relevant. Do not read entire directories speculatively.

Measure against the tree rather than recall. Grep for each construct the plan will name and count the sites, so the plan carries the count the tree holds today. Confirm any work the plan sequences behind is still open, so it does not lead with an item that already shipped.

Open each file before describing what is in it. A count or a claim carried from an earlier session, a summary, or another document is the most common way a plan ships the wrong scope.

## Step 3: build the plan

The section list, what each section holds, the suggested-and-answer contract, and the lifecycle are fixed by `${CLAUDE_SKILL_DIR}/../../standards/plan.md`. Read it before writing the file and follow it rather than working the shape from memory.

What this skill adds on top of the standard:

- Apply senior judgment to every `- Suggested:` line. Pick the best option and state it in one line with its reason or main tradeoff. No padding, no alternatives unless they change the pick.
- Suggest a real default when best practice, the codebase, or prior context points to one.
- Prefer `None identified.` over low-signal fillers. A small feature should produce a short plan, not a padded one.
- When three or more questions remain, keep chat output to the file pointer plus a short summary. Inline chat is fine when two or fewer remain.

## Pull request boundaries

A plan sequencing its work into batches declares where one pull request ends, here rather than at ship time. A dependency chain cannot be split once it is built, so the choice exists only while the batches are still a plan.

- One batch is one pull request, and one pull request is one plan file, named for its own concern rather than a numeric suffix. `canon tasks plan-branch` derives one branch from one plan filename, so a `**Batch N**` sub-heading inside one file's `**Files to touch:**` shares that one branch across every batch, and the batch that merges first strands every batch behind it with nothing left to open a pull request against. Write a plan opening five batches as five files before the first line of any of them.
- State a dependent batch's dependency on the ones before it in its own `**Constraints:**`, naming the earlier batch's slug and stacking rather than merging into it. The batches are built in order and depend on each other in that order, which is what a stack expresses, so the dependency argues for stacking and never for collapsing two batches into one file or one review.
- Mark each batch dependent or independent by comparing the file sets rather than the descriptions. A batch sharing no file with another is independent and earns its own branch even where both arrived in one request. One run measured at 68 files carried three such batches into a single review because nothing drew the boundary.
- Sequence a sweep last. A batch deliberately rewriting files earlier batches touched is coherent as the final one and forces every batch behind it into one review anywhere else.
- Keep each batch's commits contiguous once the work starts. A later fix to an earlier batch belongs on that batch's own commits, since a batch interrupted by another cannot be lifted onto its own branch afterward.

## Step 4: output

Decide the mode based on what Step 3 produced:

- **Small** when the plan touches 2 files or fewer, has no architectural or cross-cutting choices, and both Risks and Questions come out `None identified.`
- **Full** otherwise

A consumer list is a `Risks` entry, which already forces Full. Establishing a resource with more than one consumer, where at least one writes, is a cross-cutting choice wherever that list ends up living, so such a plan stays Full even at two files.

### Small mode

Output the plan to chat. Do not write a plan file. The markers match the standard's, so a plan that later grows into a file keeps the shape it was drafted in.

```markdown
**Files to touch:**

- `path/to/file`: reason
```

If real questions exist, include a numbered `**Questions:**` section below, each with a `- Suggested:` line and an `- Answer:` slot:

```markdown
**Questions:**

1. <question>
   - Suggested: <pick>, <reason or tradeoff>
   - Answer:
```

Omit empty sections. Do not print `None identified.` in chat.

### Full mode

Derive a 2-to-4-word kebab-case slug from the feature description. Write the full plan to `.canon/plans/feature-<slug>.md` at the main worktree root, not the current worktree. Resolve that root the way `session-worktree` does. Create the directory if it does not exist.

From a linked worktree, or from a background session sitting at the main root with none entered, the file-editing tools refuse that path, so the plan goes out through `Bash`. Send the `mkdir -p` and the heredoc as two plain commands rather than joining them with `&&`, which is refused as compound.

The file follows the template in `${CLAUDE_SKILL_DIR}/../../standards/plan.md`. Copy the shape from there rather than from this body, so one edit to the standard moves every plan.

Run `canon records validate plans` after writing the file when the CLI is on PATH. It reports a section, a filename, or an answer slot that does not hold, and it writes nothing.

Run `canon markdown audit .canon/plans/feature-<slug>.md` beside it, naming the file. `.canon/plans/` is gitignored and the audit's default path set is what git lists, so no other gate ever opens a plan, and six ban hits landed across four plans written without this call. Rewrite the sentence carrying a hit rather than swapping the token for a near-synonym.

When Step 1 resolved an existing task for this feature, run `canon tasks plan-link <task> .canon/plans/feature-<slug>.md` right after the file lands, naming the stem Step 1 read. Skip the call when Step 1 found no task, since there is nothing to link yet. Report a refusal rather than stopping on it. The plan file is already written, and `canon tasks validate` still catches an unlinked task through `plan-uncited` if this call cannot run.

Then output in chat:

```markdown
📝 Wrote .canon/plans/feature-<slug>.md

**Questions:**

1. <question>
   - Suggested: <pick>, <reason or tradeoff>

Next: /session-worktree
```

Show only the path line and the `Next:` line when there are no questions. The `.canon/plans/` directory is gitignored. Do not stage or commit the file.

Do not proceed to implementation until the user explicitly says to continue.

## Discussion rounds

After the plan is written, the user may re-ping with follow-up questions or pushback. Keep chat output to a decision-help shape.

- State each pick as one-line pick plus one-line reason. Do not use section headers, context blocks, or multi-section breakdowns in chat. Those belong in the plan file.
- Put numbered decisions to resolve at the bottom of the response, not interleaved with findings.
- When a finding needs more than two lines to explain, update `.canon/plans/feature-<slug>.md` in place with the detail and point the user at the file instead.
