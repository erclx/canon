---
title: CI workflow rule ledger
description: Sources for governance/rules/tooling/ci-workflow.md, one row per bullet
---

# CI workflow rule ledger

The field is continuous integration on GitHub Actions, and the authority is GitHub's own Actions documentation at docs.github.com. The rule is the second half of a pair with the `ci-workflow` skill, which owns triggers, pinning, job shape, and the top-level read-only default, so this ledger covers only what the rule itself states.

## Authority

| Bullet                  | Source                                                                                                                                         | Read       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Load the skill, routing | Routing only: it sends workflow authoring to the `canon:ci-workflow` skill, which carries the sourced directives, and claims no outside source | 2026-10-18 |

## Commit-back

| Bullet                                 | Source                                                                                                                                                                                                                                                                                                                                                                                              | Read       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Commit back only what the branch moved | House choice: a refresh an outside input moved, such as a font or a build-time count, lands a diff on a pull request whose change did not cause it, so the reviewer reads churn the author cannot explain                                                                                                                                                                                           | 2026-10-18 |
| Deterministic output, diff check first | House choice: a step that regenerates differently on each run commits noise on every push, and a commit step with no diff check ahead of it pushes a capture that did not change                                                                                                                                                                                                                    | 2026-10-18 |
| Skip a fork's pull request             | [Workflow syntax, permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax): "if the workflow was triggered by a pull request event other than `pull_request_target` from a forked repository, and the Send write tokens to workflows from pull requests setting is not selected, the permissions are adjusted to change any write permissions to read only" | 2026-10-18 |
| Never commit back to the trunk         | House choice: a workflow pushing onto the trunk lands a change no pull request carried and no reviewer read                                                                                                                                                                                                                                                                                         | 2026-10-18 |

## Steps

| Bullet                          | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Read       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Long steps call a script, 5 max | House choice, from [issue 2531](https://github.com/erclx/canon/issues/2531): a 33-line publish check copied out of a workflow carried a program no laptop or shellcheck could run. [Workflow syntax, run](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) documents `run` as a command run in the shell, with no limit on its size. One guard stays inline, since a placeholder or secrets guard of three lines gains nothing from a script | 2026-10-21 |

## Token scopes

| Bullet                      | Source                                                                                                                                                                                                                                                                                                                                       | Read       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Write scope on the job only | [Workflow syntax, permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax): "For a specific job, you can use `jobs.<job_id>.permissions` to modify the default permissions granted to the `GITHUB_TOKEN`, adding or removing access as required, so that you only allow the minimum required access" | 2026-10-18 |

## Declined

Nothing was cut. Every bullet already sat inside the shape limits, and the rule keeps its split with the skill, a pointer plus at most five directives.
