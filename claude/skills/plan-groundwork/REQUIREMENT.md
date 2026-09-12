---
name: plan-groundwork
description: Why a question that has not been measured gets a disposable folder instead of a plan, and the write scope that lets the track run without pausing
---

# Plan groundwork requirement

## Gap

Without this skill, a question nobody has measured is answered with a plan. The session commits to an approach before the current state is known, and the reasoning that produced it lives in a conversation that compacts away. A research pass that does run spreads its findings across chat, so the next session re-measures what this one already counted, or worse carries a figure from recall and states it as current.

Two failure modes cost more than the rest. A track that fans out to subagents returns findings without the reasoning that makes the folder worth keeping, which turns a conversation into a search result. And an experiment fixture written under the project root loads that project's own instruction files through the ancestor chain, so the arm measures the repository instead of the question, and the result reads as evidence either way.

A track that closes with several separable findings writes only one task, and the rest have no stated route out of the folder. Without one, a finding sits until the operator asks whether filing it elsewhere is the next step, which is how a track that measured everything correctly still lost work between sessions.

## Must

- Detect open, resume, and close from the folder itself, matching the topic against tracks already there before deriving a slug
- Name a newly opened folder with a two-digit ordinal ahead of the slug, taken from the highest one already present across groundwork and intake
- Apply the qualifying test in open mode alone, so a track already measured is not refused by the test that admitted it
- Measure the current state now rather than carrying a figure from a previous session
- Carry a lean and the finding that would overturn it on every open question, or admit that a measurement is missing
- Confine writes to the track folder, with the close-time task file, the experiment fixture, and the intake routing below as the only exceptions
- Route a closing-track finding the required task does not cover through `plan-intake`, rather than leaving it to be asked about. The route runs in the same session, so it is a write outside the folder rather than a handoff to a later one.
- Place the closing task's row through `task-board` Step 4 rather than writing `priority.md` or `backlog.md` directly
- Link every claim about a source outside the project, and list an unread source as a lead rather than citing it
- Put a fixture a headless run is pointed at outside the repository
- Write the next-session file self-contained, since backing the folder through `canon records push` and `canon records pull` holds only where a records remote is configured, protects only against the machine being lost even there, and never against a compaction dropping this session's reasoning before it has pushed

## Must not

- Write a feature plan, a source change, a standard, a rule, or a reference doc
- Dispatch subagents. A search too large to run inline is a finding that the question is too broad.
- Close while an open question quietly fails an outcome, rather than resolving it or recording it as knowingly accepted
- Spawn more than three billed headless runs without asking
- Match a topic against the shared scratch directory, which holds folders that were never tracks
- Pause for approval between steps, which the write scope is what makes safe

## Guards

- No topic given: stop rather than inferring one
- Fewer than two of the three qualifying conditions hold in open mode: stop and route to the planning skill, because the decision is already made
- Resume and close are exempt from that test by definition

## Out of scope

- Writing the plan the track concludes toward, which `plan-feature` owns
- Implementing anything the track recommends
- Persisting the folder. It is gitignored and disposable, which is what makes it the right container for an unanswered question.
