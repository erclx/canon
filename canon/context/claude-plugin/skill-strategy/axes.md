---
title: Axes
description: How a plugin skill is named and sorted, from the judgment-call rule and its escalation skill to the interface pair to the prefix families, the two-word rule, and the direction axis
---

# Axes

## Decisions

### The judgment-call rule and `decision-escalate`, split by reach

The judgment-call rule in `CLAUDE.md` states two branches. A call the session can weigh takes a pick carrying its tradeoff in one sentence. A call whose answer turns on the operator's preference goes through the structured question surface, which reaches every session rather than only an invoked one.

`decision-escalate` layers batching over that statement, so several open decisions arrive in one turn rather than one question each.

- The rule is text in the project's own files, while `decision-escalate` loads live from the plugin root, so a project that added the plugin and installed nothing reaches the skill alone
- A session hits the escalation branch mid-run inside a repository, which is why it needed that property
- It carries `disable-model-invocation: true`, so nothing routes to it on a description match and the operator fires it
- The body tests the surface rather than naming a vendor's tool or reading the instruction file, so one body runs where the structured tool exists and where it does not
- Gating on the instruction file would reach no installed target, since the rule ships in the seed and a seed reaches only a project scaffolded after it

### The interface pair splits on the act

`ux-audit` and `ux-measure` share a subject and differ on what they do to it. The first reads source and reports judgments against stated intent, the second starts the thing and reports numbers against published thresholds.

Without the second, the question lands on whichever skill matches the word "UI", since no other surface covers a running interface.

- Folding measurement into the audit is ruled out by the audit's own guard, which stops when it finds no interface source to read
- A running interface does not satisfy that condition, so the host would refuse before reaching the measurement
- Each body declines the other by name, since a boundary stated on one side alone is never checked against the other skill
- Contrast stays with the static reader. Two color values compute it and the audit already reads the custom properties holding them, so moving it buys a browser start for arithmetic
- The accepted cost is a contrast failure from a color computed at runtime, invisible to a reader of declared properties

### Detected runner and the front door

The runner is detected rather than prescribed, since the harness differs per project. The surface owns the metrics and thresholds, which are portable, and reads the project's runner, which is not.

- Detecting nothing reports what the measurement needs and stops, the same absent-key rule a `canon sync --check` reader follows
- The stop says the project has not chosen a runner, not that the skill is broken
- The front door reaches the skill through the audit offers. Four rows are `canon` verbs and this one is a skill handoff, so the execute contract governing a CLI run does not reach it
- Its second condition is a browser harness, which the front door does not test, because the skill already detects that and a second reader of the same fact answers stale

### Prefix families

Two prefixes answer ownership, each the same way. `internal-` is a skill only this repository runs, and `canon-` is a skill whose subject is the toolkit or which wraps a `canon` verb.

Beside them sit the act families, `git-` and `create-`, which name what the session is doing rather than what it is doing it to. A family picking a further ownership answer is what recording the axis is meant to prevent.

- A `claude-` prefix is the rejected third ownership answer. The namespace already resolves every shipped skill as `canon:<name>`, so it buys grouping over a large family and uniqueness over nothing
- Skills take the phase or subject their members share instead, in families such as `plan-`, `review-`, `role-`, `docs-`, `memory-`, `ux-`, `session-`, and `draft-`
- `canon-` covers only skills that name the toolkit. A member that drafts a document joins `draft-` (`draft-screencast`, `draft-slides`)
- A member that neither drafts nor names the toolkit takes a standalone verb-first name (`record-screencast`, `read-frames`), rather than a fourth prefix for a pipeline read as a sequence

### What the prefix axis gives up

Ownership is what the trade gives up. A shipped skill outside `internal-` and `canon-` says nothing about whose surface it maintains, since the phase and act prefixes answer when in a session the skill is reached, and the two readings do not compose into one name.

- Nothing reports a skill landing under a phase prefix while owning a surface the phase says nothing about
- An ownership axis would catch that by reading

### Two words, and the collision that forces the axis

A plugin skill takes two words and only rarely one. A bare word such as `autoship`, `diagram`, `docs`, `feature`, `groundwork`, `intake`, `orchestrate`, `planner`, `review`, `tasks`, `teach`, `worker`, or `worktree` is an ordinary English word met in running prose, so a catalog holding it leaves no token to grep for.

The rule costs the catalog its shortest names and keeps every name a token a search can find. An internal skill and the plugin namespace can both want `canon-`, which makes the ownership axis unavoidable rather than merely untidy.

- `claude/skills/create-skill/references/skill.md` puts project ahead of plugin, so a genuine collision resolves in the internal family's favor with nothing reporting it
- `internal-` wins over `toolkit-` and over a bare domain name because it matches `internal/`, the folder `authoring-layout.md` governs, so the prefix teaches the boundary instead of restating it
- The cost is that the family still names its domain second, so scanning it improves nothing

### Where a skill writes and the feedback pair

Where a skill writes does not decide the ownership answer. A thin wrapper over a `canon` verb that writes under `.claude/` still takes the phase-or-subject prefix, since a durable record folder stays wherever its subject places it.

The feedback pair is the one place the axis alone is not enough. `canon-feedback` and `canon-feedback-triage` share a subject and split on the act, the rule `## The interface pair splits on the act` above states.

- The prefix places the family and the trailing word separates the consumer from the producer
- Naming both for the subject alone would ship `canon-feedback` and `canon-triage`, which read as unrelated in a listing

### The direction axis

Direction is a second sorting axis beside the phase-of-use one the prefixes carry, and it earns no prefix. A family naming it would hold one member and contradict the ownership answer the prefix already gives, the further answer `## Prefix families` above exists to prevent.

- Recording it here costs an axis with no naming convention behind it, so a second outbound skill can land under a prefix that hides the fact and nothing reports it
- The risk moves with the distinction. A wrong run inside this repository damages a checkout under version control with a test suite over it
- A wrong run outbound enters a worktree in somebody else's project and pushes a branch there, and the sandbox arm can reach a fixture rather than a real target, so no test here covers it

### One skill rather than a family

The outbound skill carries an orchestrator role and a worker role in one body, where `role-orchestrator` and `role-worker` split the same pair across two. Splitting would put the target census in one body and the dispatch that reads it in another, when the three phases are one loop over one target list. The accepted cost is a longer body.

Three contracts both roles execute against keep them together.

- The fixed `chore/agents` branch and `chore(agents)` title
- The ban on merging that binds every role rather than sitting as a setting on a wave
- The pull request URL every report carries

A family states each contract twice with nothing comparing the copies, the failure the fixed shape exists against, since hand-driven repairs without it produce a different title each time.

The body stays whole rather than moving one role into `references/`.

- That move would be justified by a role read only by the sessions holding it
- It was declined because the contracts sit ahead of the split and belong to both, so a reference per role either duplicates them or leaves a reader without them
- `claude/skills/create-skill/references/skill.md` puts the 150-line prompt on a body carrying more than procedure, and what sits above the roles here is the contract set rather than narrative
