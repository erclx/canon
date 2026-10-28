---
name: proposal-critique
description: Questions a plan, a fix, a triage call, or a feature ask before it is built, in both directions, whether it does too much and whether it is too cautious, scaling the questions to how reversible the change is and how far it reaches, and ends on one verdict of go, probe first, absorb, or stop. Use when asked to "critique this plan", "poke holes in this", "is this fix worth it", "should we even build this", "challenge this proposal", or "is the cause actually ours". Do NOT use to batch open decisions that turn on the operator's preference, which is `decision-escalate`, to investigate a failing test, which is `systematic-debugging`, or to review a finished change, which is `review-pr`. Do NOT auto-trigger.
metadata:
  family: decide
---

# Proposal critique

Question a proposal before anything is built from it, answer each question with evidence from the tree or the record, and end on one verdict.

A proposal fails two ways. It does too much, fixing a cause nobody showed is ours, or it holds back so far that the work it guards stalls. Ask both.

## Guards

- If no proposal is named and the conversation holds none, stop: `❌ Nothing to critique. Name a plan, an issue, or the proposal in a sentence.`
- Critique only what is not built yet. A finished change is a review, so stop and name `review-pr`.
- Write nothing into the proposal or any other record. The verdict goes to chat, and the operator decides what moves into a record.

## Step 1: read the proposal

Read it from its written record where one exists, being a plan path, an issue, a task, or an intake item. Read every file it names before asking anything.

- Say in the output that it was read from the conversation when no record exists, since a restated proposal drifts from the one asked for
- Say in the output when this session wrote the proposal, since a critique by its author is the weak form and catches less than an independent read
- Read the project's requirements record where one exists, since two questions test the proposal against its goals and non-goals

## Step 2: size the critique

Rate the proposal on two axes before asking anything, and let the rating set how many questions run.

- Reversibility: a two-way change is undone by a revert with nothing left behind, and a one-way change leaves state, a published release, a migration, or a habit a revert cannot reach
- Reach: a local change touches one surface in this repository, and a shipped change reaches targets, other repositories, or other people's work

| Rating                        | Groups to ask                                         |
| ----------------------------- | ----------------------------------------------------- |
| Two-way and local             | Real problem only, its first two questions, then stop |
| Two-way and shipped           | Real problem, worth it, cheapest probe                |
| One-way, local or shipped     | Every group                                           |
| A fix for an unverified cause | Every group, whatever the rating, starting with cause |

State the rating and its reason in one line. Never run the full set on a two-way local change to look thorough.

## Step 3: ask in both directions

Answer each question from evidence found in the tree, the history, CI, or the record, quoting what was found. A question nothing answers is answered as unknown, and an unknown feeds the probe.

### Real problem

These two run on every proposal, and alone on a two-way local one.

- What does it solve, and who hits it? A proposal with no named user or measured failure is a guess
- Which goal does it serve, and does it cross a non-goal?

### Cause

These test the cause before the fix, so a fix for someone else's fault never ships as ours.

- Is the cause ours? Name the evidence that separates our fault from an upstream one, such as failures bunched by day or other repositories hit at once
- What is the strongest rival explanation, and what would prove the proposal wrong?
- Where did the numbers come from? A figure the proposal predicts rather than measured is a guess until read

### Worth it

These weigh the fix against doing nothing, and the last one asks the cautious direction.

- What does doing nothing cost, being how often it hurts and what one occurrence costs, such as a rerun?
- Does the fix route around the cause, or retry into it?
- Has its mechanism worked once, anywhere this project can see?
- Is it too cautious? Name the work a gate, a hold, or a narrowed scope stalls, and whether the risk it guards is worth that cost

### Premortem

Treating the failure as already happened surfaces reasons a forward-looking question misses.

- Assume it shipped and failed. What is the likeliest story of how?

### Cheapest probe

An unknown found above becomes a check here rather than a guess carried into the build.

- What small, reversible check would settle the largest unknown before the build, and what would it cost?

### Stop rule

A chain of mitigations needs an end point, set before the first one fails.

- After which failed attempt does the work stop mitigating and measure the cause instead?

## Step 4: route what evidence cannot answer

Settle every question the tree or the record can answer yourself. A question whose answer turns on what the operator wants, such as how much a rerun costs them, goes to them.

- Put every such question as one batch through the structured question surface, the way `decision-escalate` shapes a batch
- Hold the verdict until the batch is answered when an answer could move it, and give it now when none could

## Step 5: give one verdict

Pick one of four, and name the questions that decided it.

- **Go**: the problem is real, the cause is shown, and the fix is worth its cost. Build it as proposed
- **Probe first**: an unknown could flip the verdict, and a cheap reversible check settles it. Name the check
- **Absorb**: the cost of doing nothing is smaller than the fix, so live with the problem and record why
- **Stop**: the problem is not shown, the cause is not ours, or the proposal crosses a non-goal

Never give two verdicts or a verdict with a condition attached. A condition is a probe, so the verdict is probe first.

## Output

```plaintext
Proposal: <path, issue, or "read from the conversation">
Rating:   <two-way|one-way>, <local|shipped>, because <reason>
Author:   <independent read|written by this session, so the weak form>

<group>
- <question>: <answer>, per <evidence>

Verdict: <go|probe first|absorb|stop>, decided by <the questions that settled it>
<Probe: the check and its cost, on probe first alone>
```

## What this delegates

- Batching questions only the operator can answer: `decision-escalate`
- Investigating a failure already in hand: `systematic-debugging`
- Judging a finished change: `review-pr`
- Writing the plan the verdict lets through: `plan-feature`
