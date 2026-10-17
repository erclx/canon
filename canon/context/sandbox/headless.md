---
title: Headless
description: Driving a skill through canon sandbox run, composing the prompt, the run envelope and record, and the turn and cost budget
---

# Headless

`canon sandbox run` drives a skill through `claude -p` non-interactively, so a session can test a skill without a human opening an interactive sandbox. It provisions a scenario, invokes the skill from the sandbox tree, and prints the run envelope as JSON on stdout with a framed summary on stderr.

```bash
canon sandbox run <cat:cmd> "<prompt>" [scenario]
canon sandbox run git:commit "/canon:git-commit"
canon sandbox run claude:plan-feature "/canon:plan-feature add a widget" small
```

The runner lives in `src/sandbox/headless/run.ts`, beside `watch.ts` for the write and escape watch and `dispatch.ts` for the nested-dispatch bound. Provisioning still runs as a `canon sandbox --no-header` child rather than in-process, so its exit code and stderr frame stay what they were under the bash runner.

## Decisions

### The envelope decides nothing alone

The JSON envelope carries `is_error`, `result`, `num_turns`, and `total_cost_usd`, plus a `verdict` object holding `state`, `asserted`, `failed`, and `unchecked`. An arm can return `error=false` having met none of its expectations, so a suite scoring on the envelope would count a pass.

The runner snapshots the tree before the session, diffs it after, and hands the result to `canon sandbox check`, whose exit code becomes the run's outcome.

- Four variables override the defaults, being `CANON_SKILL_TEST_MODEL`, `_TOOLS`, `_MAX_TURNS`, and `_PERMISSION_MODE`
- `canon/context/sandbox/isolation.md` covers why the defaults are `sonnet` and `bypassPermissions`

### The run record

Every run lands at `.canon/tmp/runs/sandbox/<target>-<arm>-<timestamp>.json`, and the runner logs the path on stderr. The file holds what stdout emitted plus a `writes` array, both needed to score a run again, since the temp files carrying them are deleted at the end of the run.

- The record is gitignored scratch with no rotation, one file per run
- Writing it is additive and stdout stays the data contract, so a failure to record warns on stderr and prints the verdict anyway, leaving the turn count recoverable from nowhere else
- The timestamp resolves to the second, so two runs of one arm finishing inside the same second write one path. A stub `claude` finishes that fast, so compare stubbed runs one at a time.
- When the skill session exits non-zero, the runner stamps `{is_error, exit_code, raw_output}` to the same folder ahead of that exit
- A non-zero exit from `canon sandbox --no-header` logs `Provisioning exited <n> before the session could start.`, which separates it from a session exit, since both leave no verdict and no record

### Turn budget

The default turn cap is 30, above the observed cost of the heaviest arm, because a truncated run fails the same assertions as a reasoning miss with nothing to tell them apart. `CANON_SKILL_TEST_MAX_TURNS` is the only budget.

An arm's `max_turns` is a ceiling the checker asserts after the run. The runner never reads `expect.toml`, so a declaration cannot raise the cap it runs under, and a per-arm budget would need the runner to parse the declaration.

- Declare an arm's ceiling at the default and correct it from an observation, since a corrected ceiling asserts what the runner does not already enforce
- Correct from a cost that holds, not one sample of a variable one. A route-only arm can take its ceiling from one run, while an arm whose work follows what it finds needs several.
- Never declare a ceiling above the cap, since the checker fails only a count strictly over it and the arm goes green on a truncated run
- Estimate an arm's cost from what it reads rather than what it writes, since a few extra edits cost little and the turns go to reading and reasoning

### Dollar cost

An autonomous sonnet run tracks its turn count, and a light arm costs a fraction of a dollar. Drive one skill on demand rather than sweeping the catalog.

The range `internal-sandbox-check` documents covers the cheap half alone. An arm whose skill does the domain work, such as `claude:plan-groundwork` `open`, which stages a workspace and writes a three-file track, costs several times the top of it, so read the documented range as a floor for such an arm.

## Gotchas

### The prompt form

Use the `/canon:<skill>` prompt form, the only one that reaches the branch's body. A bare `/<skill>` can at most reach a marketplace copy installed on the machine. The runner sets `SANDBOX_SKIP_SKILL_INJECT=1` on the provisioning child and no other process, so every skill loads through `--plugin-dir` from the worktree's `claude/skills/`.

Injection is off because an injected skill is a copy of its `SKILL.md` alone, and a project skill outranks a plugin skill of the same name. The copy would shadow the plugin's folder and strand every `references/` and sibling-skill citation, a hazard an interactive sandbox still carries.

### The prompt is passed whole

The runner passes the prompt it is given and nothing else. The `Action:` block the arm prints goes to the provisioning log a human reads, not to the spawned session.

A skill guarding on a missing argument answers a bare prompt with its own refusal or an `❌ Ambiguous` stop, and every assertion fails against a working skill. Read the scenario's `Action:` line and pass that full command as the prompt, as `claude:plan-intake/file` and every `claude:task-board` arm need.

### Reading the verdict

The runner scores the arm's `expect.toml` itself and writes the verdict under the `verdict` key of `.canon/tmp/runs/sandbox/<cat>-<cmd>-<scenario>-<stamp>.json`. A `canon sandbox check` run afterwards reports no sandbox, since the run tears its tree down, so read the run record rather than re-checking.

### Callers and the session environment

Four constraints bind a caller.

- `internal-sandbox-check` fixes the prompt at `/canon:<skill-name>` with no arguments, so a caller following it on an argument-guarded arm reports the mismatch rather than reading a defect in the skill
- A multi-arm scenario puts the headless run out of reach of an unattended ship, since `internal-sandbox-check` sends the arm choice to a person, and `CANON_NON_INTERACTIVE=1` scores an arm nobody chose
- A sandbox session resolves `canon` off the machine's PATH, so an arm exercising a verb the branch adds meets a released binary that refuses and writes nothing
- Put the branch's own CLI ahead on PATH for that run, and never repair it by installing over the operator's global
- `CANON_SKILL_TEST_TOOLS` restricts nothing under the default `bypassPermissions` mode, since `--allowedTools` only pre-approves the tools it lists

An arm that must never reach a shell, such as one whose skill calls a live account CLI, pairs a read-only list with `CANON_SKILL_TEST_PERMISSION_MODE=dontAsk`, which denies every tool outside it. The `claude:deploy-app` arms run that way.
