---
title: Boundaries
description: Where built-in Claude Code features overlap toolkit skills and how the two compose
---

# Built-in vs toolkit features

Claude Code includes built-in features that overlap with some toolkit skills. They serve different purposes and are complementary.

## Decisions

### Code review

Three surfaces meet on a pull request, and what separates them is the re-review contract rather than the review.

- Claude Code Review is a managed service that runs on a push or on `@claude review`, reads the full repo on Anthropic infrastructure, and posts inline comments with severity tags
- `/code-review` takes a pull request number, a branch, or a path, and posts with `--comment` as inline comments or, under `ultra`, with `--post` as one comment from the operator's account
- `review-pr` posts under `## Review` while a finding is open and `## Review closed` once a pass carries none

`review-pr` scopes a first pass to the whole change and every later pass to the commits added since. It reads the task board for cross-feature context and refuses a close-out that repeats one already standing. `/code-review` reviews the target it is handed each time and keeps no state between passes.

Use `review-pr` where a reviewer and a worker trade passes on one pull request, since the heading state tells the next pass which half to read. Use `/code-review` for a one-shot read on a pull request nobody is iterating on.

- `review-craft` carries a security reference, a checklist of classes read against one diff during an ordinary review. It loads only when the diff reaches a sink and grades nothing.
- The built-in `security-review` is a deliberate audit over the pending changes, and the reference names it for anything wider than the diff in hand

### Planning

Three planning surfaces differ in what they are, how they start, and what they read.

| Aspect     | Plan mode                                        | Ultraplan                                               | `plan-feature` skill                                                                                  |
| ---------- | ------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| What       | Permission mode: Claude explores but cannot edit | Cloud-based plan drafting with browser review UI        | Skill that reads project docs and proposes files to touch                                             |
| Activation | `Shift+Tab` or `/plan`                           | `/ultraplan` or the word "ultraplan" in prompt          | `/plan-feature`                                                                                       |
| Output     | Free-form plan in terminal                       | Rich plan in browser with inline comments and reactions | Structured output: summary, files to touch, risks, and questions that each carry a suggested answer   |
| Context    | Whatever Claude reads during exploration         | Same, but on cloud infrastructure                       | Explicitly reads REQUIREMENTS, DESIGN, and the task board. Coding rules in `.claude/rules/` auto-load |

Plan mode restricts Claude to read-only exploration, and `plan-feature` forces a specific output format over specific project docs. They solve different problems and combine. Enter plan mode, then invoke `plan-feature` for a scoped proposal.

`plan-groundwork` sits ahead of all three. It runs before a topic is ready to plan, and its output is a scratch folder that can conclude in doing nothing. Reach for it when the current state is unmeasured and more than one approach is live, then run `plan-feature` on the decision it produces.

### Plan and groundwork leans

Both skills close their questions with a lean, and the two differ in strength on purpose.

- A plan's `- Suggested:` is decision-ready, so a blank `- Answer:` means accept it at execution time
- A groundwork `- Leaning:` records where the evidence currently points on a question still open, paired with an `- Overturned by:` line naming what would change it
- At close, each lean that became the decision carries its overturn line into a `## Revisit when` section of `06-decision.md`, so the condition outlives the question

Collapsing the two would turn a groundwork track into premature planning, the failure the container exists to prevent. A measurement question carries no lean at all, since a guess at a number is worse than an admission.

### Groundwork experiments

A track may run its own experiments. Reading and computing were always in scope, so the permission that mattered is the fixture write.

- Fixtures land under `.canon/tmp/runs/groundwork-fixtures/<slug>/` rather than inside the track folder, so mode detection never matches a fixture as a track
- A billed headless run is bounded by a count of three, since a run reports its cost only after it finishes, which makes a dollar budget reportable but not enforceable
- The record lands in `08-spikes.md`, the one reserved number after the closing files, because it holds evidence rather than a topic

The fixture path splits by who reads it. A fixture this session provisions and reads itself is fine in-repo.

A fixture a headless run is pointed at has to sit outside the repository under `mktemp -d`. A session started beneath the project root inherits its `CLAUDE.md`, `.claude/rules/`, and `canon/context/`, so an in-repo arm measures the repository rather than the thing under test.

### Background session isolation

Claude Code isolates a `claude --bg` session into its own `.claude/worktrees/` entry automatically, but lazily. The move happens right before the first file edit rather than at dispatch.

- `auto-ship` Step 0 calls `EnterWorktree` through `session-worktree` ahead of any edit tool, so a worker dispatched through the ship chain never observes the built-in trigger
- A read in the first seconds after dispatch reports the main worktree as `cwd` and `main` as the branch, which settles nothing about the built-in default, only that neither mechanism has run yet
