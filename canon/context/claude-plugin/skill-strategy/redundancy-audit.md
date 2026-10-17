---
title: Redundancy audit
description: Each toolkit skill with a plausible community counterpart compared against it, the borrows taken into a body, and the one borrow still standing
---

# Redundancy audit

Every toolkit skill with a plausible community counterpart is compared here, and every one is kept. Most borrows found have been taken, each into a named body.

The `review-address` push-back borrow is the one still standing, a repair that edits a skill body no verdict pass has opened.

| Borrow taken     | Landed in          |
| ---------------- | ------------------ |
| Submodule guard  | `session-worktree` |
| CLS attribution  | `ux-measure`       |
| Verify gate      | `git-ship`         |
| Path-prefix test | `git-worktree`     |

## Decisions

### Debugging and audit counterparts

Two skills in the debugging and audit slots take nothing from their counterparts.

- `canon:systematic-debugging` vs `obra/superpowers/systematic-debugging` is the same methodology, 98 lines to their 283 at `8ca22db`. No borrow
- Bisect, the reduce step, the non-reproducible branches, and error output as data came from `addyosmani/agent-skills`'s `debugging-and-error-recovery`, and `references/adopted.md` records each
- `canon:ux-audit` vs `impeccable`'s `/audit` and `/critique` are different lenses. Ours enumerates UI surfaces for missing states and inconsistencies, while theirs score technical quality and design
- They compose, so run `ux-audit` first, then the `impeccable` commands to polish
- No body change, because third-party skill references belong on this surface rather than in a `SKILL.md` body

### Planning counterparts

Both planning skills sit in different slots from the `obra/superpowers` skills nearest them.

- `canon:plan-feature` vs `brainstorming`, `writing-plans`, and `executing-plans` reads the full `.claude/` doc set and plans at a coarser grain than the task-atomized `writing-plans`
- No borrow, since the approval gate between plan and implement already covers the clarification `brainstorming` does upfront
- `canon/context/claude-plugin/boundaries.md` positions Plan mode and Ultraplan
- `canon:plan-groundwork` vs `brainstorming` is the closest analogue with a different output. Theirs is an upfront conversation whose product is a better-specified plan
- Groundwork leaves a durable folder of measurements and rejected options that can conclude in doing nothing, and it runs before a plan is warranted. No borrow

### Worktree counterpart

`canon:session-worktree` vs `obra/superpowers/using-git-worktrees` differ in premise. Theirs is portable, so most of its 202 lines carry fallbacks for a harness with no native tool, such as an ignore check, a dependency install, and a baseline test run.

- Ours assumes `EnterWorktree` and spends its 133 lines on what that tool leaves undone
- The borrow landed in `session-worktree`'s Guards, on the opposite branch from theirs
- Their Step 0 adds `git rev-parse --show-superproject-working-tree`, but an absorbed submodule returns one identical path from both reads
- What it closes is a submodule passing the first guard and building `.claude/worktrees/` inside a tree the superproject tracks as a commit. The skill body carries the measurement

### Measurement counterpart

`canon:ux-measure` vs the user-scoped `web-perf` skill, 110 lines against their 201, shares the subject and the same three thresholds. Every other premise differs.

- Theirs requires the `chrome-devtools` MCP server and stops without it. Ours detects a browser MCP server, Playwright, or Lighthouse in that order and installs none, per `axes.md`
- Theirs traces one load, while ours takes the median of three cold readings, because one load carries startup noise wider than the gap between two thresholds
- Theirs recommends fixes by name, while ours reports the reading and stops, since a remedy is a change with its own review
- Theirs folds in an accessibility snapshot and a codebase pass, which ours lists under `Not measured` and routes to `ux-audit`

`web-perf` retrieves boundaries from `web.dev` at run time across seven metrics. Ours pins the published numbers for three and forbids moving one to fit a reading, so retrieval would contradict that rule.

The borrow went into `ux-measure` Step 3 and its report format. Their `CLSCulprits` insight names which elements shifted, where a bare CLS number carries no attribution.

- It fits the report-and-stop contract because it says where the score came from rather than what to do about it
- The attribution comes off the run that produced the median, since merged shares are proportions of a total no run measured

### Shipping counterparts

Two shipping skills compare against `executing-plans` and `finishing-a-development-branch`. Both counterparts end on a menu, and ours end on a draft pull request with CI polled.

- `canon:auto-ship` vs `executing-plans` and the `finishing-a-development-branch` it requires is a different product. Theirs walks plan tasks against a todo list and closes on a menu
- No borrow. `executing-plans` opens by critiquing the plan, and this toolkit does that at the `plan-feature` approval gate ahead of autoship
- The one outcome is internal, since `auto-ship`'s ship step invokes `git-ship` rather than restating its sequence

### git-ship against the branch-finishing skill

`canon:git-ship` vs `finishing-a-development-branch` is the same moment with opposite postures. Theirs offers merge, pull request, keep, or discard, with a typed confirmation on the destructive one. Ours runs a fixed sequence and offers no menu.

- The menu is the split. A project on this toolkit answered the integration question at the plan-to-execute boundary
- `session-worktree` opens a branch there that exists to become a pull request, so asking again reopens a settled question
- Two halves of theirs have no counterpart here. Worktree cleanup is `git-worktree`'s subject, and the discard path is a destructive operation this chain declines to offer

The borrow is `git-ship`'s `## Verify` section, from their Step 1, which refuses to present any option until the project's test suite passes.

- Without it, several `auto-ship` stop points hand the run back to `/git-ship`
- That would reach the remote without re-running anything, so a manual fix after a verify stop could ship unverified
- A project naming no verify command says so and continues, since a stop there would refuse every target without a suite

`git-ship` keeps the chain, and `auto-ship`'s ship step invokes it rather than restating it. `git-ship` is reachable on its own while that step is reached only inside the chain, so the body a reader meets alone should be the complete one.

- The step keeps the draft marking, placed ahead of the CI watch, because a pull request marked afterward is mergeable for the length of the run

### git-worktree against the cleanup step

`canon:git-worktree` vs the Step 6 cleanup in `finishing-a-development-branch` is a different scope at a different moment.

- Theirs cleans the one worktree the session sits in, at the end of one branch, and only for two of its four options
- Ours enumerates every worktree at any time, resolves each branch's merge state through `gh` with a local-ancestry fallback, and removes the merged set in one batch

The borrow is a fourth enumeration test. Theirs checks the worktree path against a known prefix before removing anything and leaves a harness-owned workspace in place.

- Without it, a merged clean tree an operator added by hand elsewhere on disk would land in the remove set, its branch following under `branch -D`
- A non-main row outside `<MAIN_ROOT>/.claude/worktrees/` reads as `foreign` and joins the skip set with that reason, in `list` and `cleanup` both

### Orchestration counterpart

`canon:role-orchestrator` vs `dispatching-parallel-agents` and `subagent-driven-development` has the same subject and the opposite mechanism. Both of theirs delegate to in-process subagents and spend most of their length building each one's context, since a subagent inherits nothing.

- Ours dispatches a separate `claude --bg` process with its own worktree and pull request, and forbids the Agent tool
- `canon/context/claude-internal/orchestration/dispatch.md` records why, being that a subagent carries none of independence, steerability, or its own pull request
- No borrow, because the halves do not correspond. Their prompt-construction sections exist since a subagent starts empty, and a dispatched session reads the plan file instead
- Ours carries a collision check that theirs has no room for, composing a worktree listing, a session roster, and the refs already naming the branch

### Review counterparts

`canon:review-pr` has two counterparts at one moment, `obra/superpowers/requesting-code-review` and Claude Code's own `/code-review`, and the built-in is the closer.

- Theirs dispatches a reviewer subagent and returns findings into the requesting session, the shape `canon/context/claude-internal/orchestration/review.md` declines
- A finding in one session dies with it, so ours posts to the pull request
- `/code-review` takes a pull request target, `--comment` posts inline comments, and `ultra --post` posts one comment from the operator's account
- `canon/context/claude-plugin/boundaries.md` records the built-in against `review-pr`
- What still separates ours is the re-review contract. A first pass reads the whole change and every later pass reads only the commits added since

The heading moves from `## Review` to `## Review closed` when a pass carries no finding, and a close-out that repeats one already standing is refused. No borrow.

### Review-response counterpart

`canon:review-address` vs `obra/superpowers/receiving-code-review` is the same moment in different kinds of document. Theirs is a posture covering forbidden responses, unclear feedback, and correcting a wrong pushback. Ours is a procedure from pulling findings and CI status through fixing, verifying, rebasing, pushing, and replying.

- They compose rather than compete, so a session can hold both
- Ours has one line where theirs has a chapter, the note that a finding may be a question or a conscious-accept, answered in the reply
- One borrow stands, not yet taken. Their `## When To Push Back` states six criteria for declining a finding
- Ours says a declined finding carries the fact that settled it, without saying when declining is right
- It is a judgment inside the existing reply path rather than a new step, so it awaits a pass that opens the skill body
