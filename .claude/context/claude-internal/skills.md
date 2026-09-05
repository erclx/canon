---
title: Internal skills
description: The internal canon skills loaded before editing a toolkit domain, their requirement coverage, and the sandbox verification route
---

# Internal skills

Internal skills live in `.claude/skills/` and are toolkit-only. They are not installed into target projects.

| Skill                        | Description                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `internal-ask`               | Answer a repository-knowledge question from the indexes before opening any file, user-invoked via `/internal-ask`   |
| `internal-claude`            | Load before editing plugin skills, the CLAUDE.md seed, or the Claude context entries                                |
| `internal-governance`        | Load before editing Cursor rules or stack definitions                                                               |
| `internal-scripts`           | Load before editing scripts or sandbox scenarios                                                                    |
| `internal-snippets`          | Load before editing snippets                                                                                        |
| `internal-standards`         | Load before editing standards or docs                                                                               |
| `internal-tooling`           | Load before editing tooling stacks or golden configs                                                                |
| `internal-sandbox-check`     | Audit changed skills and scripts for missing sandbox scenario edits, user-invoked via `/internal-sandbox-check`     |
| `internal-shipped-reference` | Review a shipped-corpus edit for a self-only reference no pattern scan catches, routed by `598-authoring-layout.md` |

## Requirement coverage

All nine internal skills carry a `REQUIREMENT.md`. Coverage is universal rather than selective, because the operator reads the corpus to decide whether a skill should exist at all, and a file present for some skills and absent for others cannot be scanned for that. An absence reads as a gap in the authoring rather than as a verdict that the body is already its own specification.

The earlier test earned a skill one only when a reader could not recover from the body alone both the failures it prevents and the nearest thing it deliberately does not do. That still describes what a working requirement answers, and it no longer decides which skills get one. Length never discriminated either way, since the 31-line skill earned one under it and the 191-line skill did not.

The rule gating a skill edit globs `.claude/skills/**/REQUIREMENT.md`, so it now fires on every internal skill edit rather than on three of eight. That increase in what a session reads before editing is the accepted cost of the corpus being readable as a set.

The plugin corpus under `claude/skills/` reached the same coverage across three batches, and `standards/skill.md` now calls the file required for both corpora. A skill whose scope a branch in flight is changing takes its requirement from that branch, so the last of the coverage closes as those branches land rather than ahead of them.

## Sandbox check verification route

`internal-sandbox-check` maps changed items to scenarios and then verifies one of them. It drives `scripts/sandbox/run.sh` against the `Provisioning:` scenario, deriving the target from the scenario path and the prompt as `/canon:<skill-name>`, and reports the verdict `run.sh` returns rather than asserting its own.

The arm is the third argument and roughly half the catalog requires it. `manage-sandbox.sh` sets `SANDBOX_SCENARIO` and `CANON_NON_INTERACTIVE` only when it receives an arm, so a multi-arm scenario invoked without one falls through to `select_or_route_scenario` and its picker, which aborts on a missing TTY and blocks on input when one is attached. Either way the run dies before the skill session.

Forcing `CANON_NON_INTERACTIVE=1` past it is worse, since the picker then takes the first arm and the verdict names an arm nobody chose. The skill greps the scenario for `select_or_route_scenario` and asks for the arm rather than guessing. The census read that narrowed the pairing prompt does not reach this one, because a census of skills names no arm.

The runner is the only path the skill takes on its own. Its interactive counterpart stays with the user, because a session that opens a sandbox terminal holds one a headless caller cannot release. That distinction is why the skill's `## Do not` bans the interactive session and names the runner in the same block. The ban entered before the runner existed and read as covering both, which routed every worker to a human for a step the repository could already run.

Verification stops at one arm per invocation. The `Queued:` list stays a printed command, so an automatic ship-time step cannot turn into a catalog sweep.

The collection commands the skill spells out do not run as written from where it is invoked. Its Guards and Step 1 both carry `git diff "$(git merge-base main HEAD)" --name-only -- <globs>`, and the worktree isolation guard refuses any Bash command it cannot statically verify stays inside the worktree, which covers a command substitution standing in for a git argument and a braced compound joined by a pipe. Autoship reaches this skill only from a linked worktree, so the literal is refused on every ship-time invocation. Resolve the merge base in a prior plain command and pass the resulting sha.

An item that ships unverified names one of three gates, `no-mechanism`, `credentials`, or `cost`. The vocabulary exists because the three have different fixes and a single sentence about verification being undone hides which one applied. `credentials` covers the `use_anchor` scenarios off an authenticated machine, `no-mechanism` covers a script mapping with no skill invocation to run, and `cost` is reserved for a sweep rather than a single arm.

## A detection root excludes the artifacts a skill writes

When a skill derives its mode from listing a directory, any new artifact it writes belongs outside that directory, since the listing cannot tell a fixture from the state it is scanning for. `claude-groundwork` Step 1 lists `.canon/groundwork/` and routes on whether a matching folder exists, so the experiment fixture the spike permission needed went to `.canon/tmp/groundwork-fixtures/<slug>/`. One level inside the scanned root it would have matched as a live track and resumed. Before adding a write path to a skill, check whether any step lists that path's parent to decide something.
