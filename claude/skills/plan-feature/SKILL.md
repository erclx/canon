---
name: plan-feature
description: Plans a feature by reading the project's Claude setup and scanning relevant source files. Outputs which files to touch, risks, and ambiguities, then stops. Use before implementing anything, or when asked to "implement X", "add X", "build X", or "I want to add X". Do NOT implement. Plan only.
metadata:
  family: decide
---

# Plan feature

## Guards

- If no feature description is provided, stop: `❌ No feature description. Describe what you want to add.`
- Do not implement anything. Output the plan and stop.
- When the feature description spans two or more independent concerns, write one plan file per concern. Do not bundle them under a single slug.

## Write scope

Write the plan, and nothing else in the tree being planned against.

- A file made only to look at goes to scratch under a topic slug, per `${CLAUDE_SKILL_DIR}/references/onboarding.md`
- A fixture or headless session that must be its own project goes outside the repository, in a temporary directory

### Predict the next three questions

Before Step 3, name the next three questions you would ask about what the ask must achieve, and predict the operator's answer to each. The test reads the ask's success criteria, never the plan's open questions.

- A predictable answer settles its criterion, which Step 3 writes as a `## Verification` bullet rather than a question
- Only a prediction still open goes under `## Questions` with a `- Suggested:` line, so a fully specified ask carries none and Small mode stays reachable
- When you can predict none of the three, ask before Step 3 through whatever route reaches the operator, including a message to a dispatching session

## Step 1: read the Claude setup

Read these in parallel from the project root, skipping any that do not exist:

- `CLAUDE.md`: behavior rules, conventions, commands
- `canon/REQUIREMENTS.md`: feature scope and non-goals
- `.canon/tasks/index.md`: current scope and status, then any task file the feature relates to

Also read `canon/DESIGN.md` when the feature touches code or UI, for visual intent and component rules, with values read from the stylesheet its lead names. Skip it for prose, docs, catalog, or config-only changes. For a UI feature, read `canon/design/index.md` too, if it exists, for the surfaces with an accepted design.

Coding standards live in `.claude/rules/`. Claude Code loads them automatically, and path-scoped rules apply to the files they match.

### Read the domain's context entry

Onboard to each domain the feature touches before reading its code, through its context entry. Read `${CLAUDE_SKILL_DIR}/references/onboarding.md` for the lookup.

## Step 2: run the surface, then scan relevant source files

When the feature changes a verb, a route, or a rendered surface that already exists, run it once before reading its code and record what it showed. Read `${CLAUDE_SKILL_DIR}/references/onboarding.md` for the safe form per surface kind, the rules that keep the run from writing, and the not-run record.

### Read the code

Read the source files directly relevant to the feature, never whole directories speculatively. Where a folder carries an `index.md`, read it first and load only the files it points at.

Measure against the tree rather than recall, since a count carried from an earlier session or a summary is the most common way a plan ships the wrong scope.

- Open each file before describing what is in it
- Grep for each construct the plan will name and count the sites
- Confirm any work the plan sequences behind is still open
- Read a flat folder as a reading to place against rather than a pattern to copy, since the tree shows what exists beside a new path, not where it belongs

### Outside sources

When a decision rests on an outside practice or a third-party behavior, invoke `canon:search-craft` before searching, fetch each source, and record the passage relied on. Skip this for a plan that rests on nothing outside the project.

- Confirm exact wording through `curl` where a decision turns on it, since `WebFetch` returns a model's answer rather than the page
- Fetch a Claude Code subject from Anthropic's docs directly, starting at the index `https://code.claude.com/docs/llms.txt` and reading the `.md` form of the page it names
- Mark a source that could not be fetched as unverified rather than citing recall
- Report it rather than proceeding silently when `canon:search-craft` does not resolve

## Step 3: build the plan

The section list, what each section holds, and the suggested-and-answer contract are fixed by `${CLAUDE_SKILL_DIR}/references/plan.md`, and the lifecycle by `${CLAUDE_SKILL_DIR}/references/plan-lifecycle.md`. Read it before writing the file and follow it rather than working the shape from memory.

What this skill adds on top of the standard:

- Record each command Step 2 ran and what it showed, or the not-run reason, under `## Current behavior`, and omit the section when nothing ran
- Reframe a vague ask as success criteria before `## Files to touch`, each an observable result and its check, which becomes one `## Verification` bullet. "Make it faster" names none.
- Confirm a concrete project or use case drives the feature, and lift patterns from it where precedent exists. A feature with no named user is a guess.
- Prefer one layout that serves both a new and a grown project over a dual-mode toggle or a migration shim. Two modes double what every later change has to hold.

### Suggestions and sections

Every `- Suggested:` line takes senior judgment, picking the best option in one line with its reason or main tradeoff, and naming alternatives only when they change the pick.

- Suggest a real default when best practice, the codebase, or prior context points to one
- Before `## Files to touch`, load `canon:codebase-layout` for a new path (its reason) and `canon:api-design` for a changed verb, flag, output, record shape, or endpoint. Report either if missing.
- Fill `## Design references` with the `canon/design/<surface>/` folder for each surface a UI file in `## Files to touch` renders, and write `None identified.` in a project with no folder
- Write `## Verification` as one bullet per outcome naming the test or command that proves it
- Write `## Review focus` as the inputs or states that would break the change, carrying the risk you understood to the executor and the reviewer

### Sources and size

A small feature produces a short plan, not a padded one.

- Cite the `## Sources` entry for every decision Step 2 sourced, each with its quoted passage or the word `unverified`
- Prefer `None identified.` over low-signal fillers
- When three or more questions remain, keep chat output to the file pointer plus a short summary. Inline chat is fine when two or fewer remain.

## Pull request boundaries

A plan sequencing its work into batches declares where each pull request ends, since a dependency chain cannot be split once it is built. Read `${CLAUDE_SKILL_DIR}/references/batches.md` when the plan carries more than one batch, for the one-file-per-batch rule, when a dependent batch folds, and the build order. A single-batch plan skips it.

## Step 4: output

Decide the mode based on what Step 3 produced:

- **Small** when the plan touches 2 files or fewer, has no architectural or cross-cutting choices, and both Risks and Questions come out `None identified.`
- **Full** otherwise

A consumer list is a `Risks` entry, which already forces Full. A resource with more than one consumer, at least one writing, is a cross-cutting choice, so such a plan stays Full even at two files.

### Small mode

Output the plan to chat and write no plan file. The markers match the standard's, so a plan that later grows into a file keeps its shape.

```markdown
## Files to touch

- `path/to/file`: reason

## Verification

- <outcome>: `<test or command that proves it>`
```

Small mode carries no `## Review focus`, since its Risks already came out `None identified.` and the reviewer has no breaking input to name.

If real questions exist, include a numbered `## Questions` section below, each with a `- Suggested:` line and an `- Answer:` slot:

```markdown
## Questions

1. <question>
   - Suggested: <pick>, <reason or tradeoff>
   - Answer:
```

Omit empty sections. Do not print `None identified.` in chat.

### Full mode

Derive a 2-to-4-word kebab-case slug from the feature description. Write the plan to `.canon/plans/feature-<slug>.md` at the main worktree root, resolved the way `session-worktree` does, creating the directory if needed.

The plan is a main-root write, from a linked worktree and from a background session at the main root alike, so it goes out as a heredoc routed the way `session-worktree` states. Copy the shape from the template in `${CLAUDE_SKILL_DIR}/references/plan.md` rather than from this body, so one edit to the standard moves every plan.

### Checking the written plan

Two commands check the file once it lands, and both write nothing.

- Run `canon records validate plans feature-<slug>` when the CLI is on PATH. Its `findings` name a section, a filename, or an answer slot that does not hold.
- Fix each entry its `structure` array names before reporting, against `### Structure` in `${CLAUDE_SKILL_DIR}/references/plan.md`
- Read that array rather than the exit code, since a structure entry never sets the exit
- Say the check did not run when the binary refuses the plan argument or carries no `structure` key, rather than reporting the plan clean
- Run `canon markdown audit .canon/plans/feature-<slug>.md`, naming the file, since the gitignored plan reaches no other gate. Rewrite a hit's sentence rather than swapping the token.

When Step 1 resolved an existing task, run `canon tasks plan-link <task> .canon/plans/feature-<slug>.md` right after the file lands, naming the stem Step 1 read. Skip it when Step 1 found no task, and report a refusal rather than stopping, since `canon tasks validate` still catches an unlinked task through `plan-uncited`.

### Chat output

Then output in chat:

```markdown
📝 Wrote .canon/plans/feature-<slug>.md

## Questions

1. <question>
   - Suggested: <pick>, <reason or tradeoff>

Next: <line from the table below>
```

Pick the `Next:` line from the roster check `${CLAUDE_SKILL_DIR}/../task-board/SKILL.md` states under `### Check for a live orchestrator`, read there rather than restated here.

| Roster read                                                                | `Next:` line                                                                                         |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Found**                                                                  | `<name> places and dispatches <task>`, naming the orchestrator row the check matched                 |
| **Not found**, and this session's name starts with `worker-` or `planner-` | `Hand <task> to a worker`, naming no session, since none is live and the operator dispatches by hand |
| **Not found otherwise**, or the read fails                                 | `/session-worktree`                                                                                  |

Three rules apply to the `Next:` choice:

- With a live orchestrator and no planner role held, send the plan path to it through `canon:session-relay`, resolved from its `sessionId`
- A session holding `canon:role-planner` already owes that announcement through its own channel, so it sends none
- Say which row fired in one clause, since a line with no stated reason is one the next reader re-derives.

Show only the path line and the `Next:` line when there are no questions. The `.canon/plans/` directory is gitignored, so do not stage or commit the file.

Do not proceed to implementation until the user explicitly says to continue.

## Discussion rounds

After the plan is written, the user may re-ping with follow-up questions or pushback. Keep chat output to a decision-help shape.

- State each pick as one-line pick plus one-line reason. Section headers, context blocks, and multi-section breakdowns belong in the plan file.
- Put numbered decisions to resolve at the bottom of the response, not interleaved with findings
- When a finding needs more than two lines, update `.canon/plans/feature-<slug>.md` in place and point the user at the file
