---
name: target-check
description: What the target check is for, the gap it closes, and the repairing it refuses
---

# Target check requirement

## Gap

Without this skill, a session landing in a target project decides for itself what to look at. `canon-rollout` dispatches a worker into each target and gets a pull request out, and nothing told that worker what a target holds against what the toolkit ships, so a wave is only as good as whatever each session happened to examine. Four hand-driven repairs across two waves examined four different sets of surfaces and none of them read the same domain twice.

The second half of the gap is silence. A session that runs a verb the target's binary does not carry, or reads a report key that is absent, has no instruction telling it apart from a clean answer, so an unexamined domain reaches the reader as a domain that passed.

## Must

- Report one section per domain, so a reader can tell which surface a finding came from
- Read each domain through the verb that already owns that comparison, rather than inspecting the same files by hand, since the verb is the surface under test
- Take the installed domains from the catalog the report returns rather than from a list in the body, so a domain the toolkit adds later needs no edit here
- Report a refusal, an absent key, and a missing subcommand as unread, naming the cause, so an unexamined domain never reads as a passing one
- Report the Claude harness as unchecked on every run while no verb answers for it, as a row rather than an omission
- Report the toolkit version first, since a target behind on the binary explains every unread section under it
- Run every read non-interactively by default, because every caller in the near term is a dispatched worker with nobody present to answer a prompt

## Must not

- Repair a finding, write a file in the target, or open a pull request. A check that repaired as it read leaves the reader unable to tell a finding from a fix, and the wave decides what to fix.
- Emit a verdict across the domains. Five answer from verbs and one answers from nothing, so any roll-up is a figure that lies about the sixth.
- Answer the harness domain by file inspection. A section reaching a verdict from a hand-rolled read is exactly what the other five sections avoid, and a hole a reader can see is worth more than a number nobody can trace.
- Hardcode a stack, rule, or domain name. A name written into the body goes stale on its own cadence.

## Guards

- `canon` absent from the path: stop, since no domain can be read
- No `.claude/` at the working root: stop and name the scaffold command, since nothing is installed to check
- The working root is the toolkit itself: stop and name `canon-rollout`, since this skill reads what the toolkit installed into rather than the source

## Out of scope

- Document health, which asks a content question rather than a structural one and takes its own surface
- Repairing anything a section names. Each routes to the command or skill that owns it.
- A target's own routes, which `canon inventory` reports as a listing rather than a verdict and which is a fact about the project rather than about what the toolkit ships
- First-time scaffold, which is `setup-init`, and per-intent routing of a single toolkit operation, which is `canon-operator`
