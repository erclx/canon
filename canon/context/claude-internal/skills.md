---
title: Internal skills
description: The internal canon skills loaded before editing a toolkit domain, their requirement coverage, and the sandbox verification route
---

# Internal skills

Internal skills live in `.claude/skills/` and are toolkit-only. They are not installed into target projects.

- `internal-ask`: Answer a repository-knowledge question from the indexes before opening any file, user-invoked via `/internal-ask`
- `internal-claude`: Load before editing plugin skills, the CLAUDE.md seed, or the Claude context entries
- `internal-governance`: Load before editing governance rules or stack definitions
- `internal-rule-audit`: Audit the governance rule set, returning one keep, move, retire, or merge verdict per rule with the check that decided it
- `internal-scripts`: Load before editing scripts or sandbox scenarios
- `internal-standards`: Load before editing standards or docs
- `internal-teach`: Load before editing the learning workspace, its committed fixture, or the teach standards
- `internal-tooling`: Load before editing tooling stacks or golden configs
- `internal-web`: Load before editing the landing page or this repository's own rendered images
- `internal-sandbox-check`: Audit changed skills and scripts for missing sandbox scenario edits, user-invoked via `/internal-sandbox-check`
- `internal-shipped-reference`: Review a shipped-corpus edit for a self-only reference no pattern scan catches, routed by `598-authoring-layout.md`

## Requirement coverage

Every internal skill carries a `REQUIREMENT.md`. Coverage is universal rather than selective, because the operator reads the corpus to decide whether a skill should exist at all, and a file present for some skills and absent for others cannot be scanned for that. An absence reads as a gap in the authoring rather than as a verdict that the body is already its own specification.

A working requirement lets a reader recover from the body alone both the failures the skill prevents and the nearest thing it deliberately does not do. Length does not decide which skills need one.

The rule gating a skill edit globs `.claude/skills/**/REQUIREMENT.md`, firing on every internal skill edit. The plugin corpus under `claude/skills/` carries the same coverage, and `standards/skill.md` calls the file required for both corpora. A skill whose scope an in-flight branch is changing takes its requirement from that branch.

## Sandbox check verification route

`internal-sandbox-check` maps changed items to scenarios and then verifies one of them. It drives `scripts/sandbox/run.sh` against the `Provisioning:` scenario, deriving the target from the scenario path and the prompt as `/canon:<skill-name>`, and reports the verdict `run.sh` returns rather than asserting its own.

The arm is the third argument and roughly half the catalog requires it. `manage-sandbox.sh` sets `SANDBOX_SCENARIO` and `CANON_NON_INTERACTIVE` only when it receives an arm, so a multi-arm scenario invoked without one falls through to `select_or_route_scenario` and its picker, which aborts on a missing TTY and blocks on input when one is attached. Either way the run dies before the skill session.

Forcing `CANON_NON_INTERACTIVE=1` past it is worse, since the picker then takes the first arm and the verdict names an arm nobody chose. The skill greps the scenario for `select_or_route_scenario` and asks for the arm rather than guessing.

The runner is the only path the skill takes on its own. Its interactive counterpart stays with the user, because a session that opens a sandbox terminal holds one a headless caller cannot release. That distinction is why the skill's `## Do not` bans the interactive session and names the runner in the same block.

Verification stops at one arm per invocation. The `Queued:` list stays a printed command, so an automatic ship-time step cannot turn into a catalog sweep.

The collection commands the skill spells out do not run as written from where it is invoked. Its Guards and Step 1 both carry `git diff "$(git merge-base main HEAD)" --name-only -- <globs>`, and the worktree isolation guard refuses any Bash command it cannot statically verify stays inside the worktree, which covers a command substitution standing in for a git argument and a braced compound joined by a pipe. Autoship reaches this skill only from a linked worktree, so the literal is refused on every ship-time invocation. Resolve the merge base in a prior plain command and pass the resulting sha.

An item that ships unverified names one of three gates, `no-mechanism`, `credentials`, or `cost`. The vocabulary exists because the three have different fixes and a single sentence about verification being undone hides which one applied. `credentials` covers the `use_anchor` scenarios off an authenticated machine, `no-mechanism` covers a script mapping with no skill invocation to run, and `cost` is reserved for a sweep rather than a single arm.

## A detection root excludes the artifacts a skill writes

When a skill derives its mode from listing a directory, any new artifact it writes belongs outside that directory, since the listing cannot tell a fixture from the state it is scanning for. `plan-groundwork` Step 1 lists `.canon/groundwork/` and routes on whether a matching folder exists, so the experiment fixture the spike permission needed went to `.canon/tmp/runs/groundwork-fixtures/<slug>/`. One level inside the scanned root it would have matched as a live track and resumed. Before adding a write path to a skill, check whether any step lists that path's parent to decide something.
