---
title: Internal skills
description: The internal canon skills loaded before editing a toolkit domain, their requirement coverage, and the sandbox verification route
---

# Internal skills

Internal skills live in `.claude/skills/` and are toolkit-only. They are not installed into target projects.

| Skill                        | Use                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `internal-ask`               | Answer a repository-knowledge question from the indexes before opening any file, via `/internal-ask`            |
| `internal-canvas`            | Load before editing the canvas server, its browser shell, or the `canon canvas` verbs                           |
| `internal-claude`            | Load before editing plugin skills, the CLAUDE.md seed, or the Claude context entries                            |
| `internal-governance`        | Load before editing governance rules or stack definitions                                                       |
| `internal-rule-audit`        | Audit the governance rule set, one keep, move, retire, or merge verdict per rule with its check                 |
| `internal-scripts`           | Load before editing scripts or sandbox scenarios                                                                |
| `internal-docs`              | Load before editing `docs/` or `canon/context/`                                                                 |
| `internal-teach`             | Load before editing the learning workspace, its committed fixture, or the teach standards                       |
| `internal-tooling`           | Load before editing tooling stacks or golden configs                                                            |
| `internal-web`               | Load before editing the landing page or this repository's own rendered images                                   |
| `internal-sandbox-check`     | Audit changed skills and scripts for missing sandbox scenario edits, via `/internal-sandbox-check`              |
| `internal-shipped-reference` | Review a shipped-corpus edit for a self-only reference no pattern scan catches, routed by `authoring-layout.md` |

## Decisions

### Requirement coverage

Every internal skill carries a `REQUIREMENT.md`, because the operator reads the corpus to decide whether a skill should exist at all. A file present for some skills and absent for others cannot be scanned for that, and an absence reads as a gap in the authoring.

- A working requirement lets a reader recover from the body alone the failures the skill prevents and the nearest thing it deliberately does not do. Length does not decide which skills need one.
- The rule gating a skill edit globs `.claude/skills/**/REQUIREMENT.md` and fires on every internal skill edit
- The plugin corpus under `claude/skills/` carries the same coverage, and `claude/skills/create-skill/references/skill.md` calls the file required for both
- A skill whose scope an in-flight branch is changing takes its requirement from that branch

### Sandbox check verification route

`internal-sandbox-check` maps changed items to scenarios, then verifies one by driving `canon sandbox run` against the `Provisioning:` scenario. It derives the target from the scenario path and the prompt as `/canon:<skill-name>`, and reports the verdict the runner returns rather than asserting its own.

- Verification stops at one arm per invocation. The `Queued:` list stays a printed command, so a ship-time step cannot become a catalog sweep.
- The runner is the only path the skill takes, since an interactive sandbox terminal is one a headless caller cannot release. `## Do not` bans it and names the runner.

### The arm is required for a multi-arm scenario

The arm is the third argument, and roughly half the catalog requires it. `canon sandbox` sets `SANDBOX_SCENARIO` and `CANON_NON_INTERACTIVE` only when it receives an arm.

- Without one, a multi-arm scenario falls to the `routeArm` picker in `src/sandbox/scenario.ts`, which aborts on a missing TTY and blocks when one is attached
- Forcing `CANON_NON_INTERACTIVE=1` is worse. The picker takes the first arm and the verdict names an arm nobody chose.
- The skill counts the keys under `arms` in the scenario and asks for the arm rather than guessing

### Collection commands need a resolved merge base

The skill's Guards and Step 1 carry `git diff "$(git merge-base main HEAD)" --name-only -- <globs>`. The isolation guard refuses any command it cannot statically verify stays inside the worktree, such as a command substitution standing in for a git argument.

Autoship reaches this skill only from a linked worktree, so the literal fails on every ship-time invocation. Resolve the merge base in a prior plain command and pass the sha.

### Unverified items name a gate

An item that ships unverified names one of three gates, because each has a different fix and one sentence about verification being undone hides which applied.

| Gate           | Covers                                                     |
| -------------- | ---------------------------------------------------------- |
| `no-mechanism` | A script mapping with no skill invocation to run           |
| `credentials`  | The `anchor: true` scenarios, off an authenticated machine |
| `cost`         | Reserved for a sweep rather than a single arm              |

### A detection root excludes the artifacts a skill writes

When a skill derives its mode from listing a directory, any artifact it writes belongs outside that directory, since the listing cannot tell a fixture from real state. `plan-groundwork` Step 1 routes on whether a matching folder exists under `.canon/groundwork/`, so the spike fixture went to `.canon/tmp/runs/groundwork-fixtures/<slug>/`.

Before adding a write path to a skill, check whether any step lists that path's parent to decide something.
