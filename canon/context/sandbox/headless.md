---
title: Headless
description: Driving a skill through run.sh, composing the prompt, the run envelope and record, and the turn and cost budget
---

# Headless

`scripts/sandbox/run.sh` drives a skill through `claude -p` non-interactively, so a session can test a skill without a human opening an interactive sandbox. It provisions a scenario, invokes the skill from the sandbox tree, and prints the run envelope as JSON on stdout with a framed summary on stderr.

```bash
scripts/sandbox/run.sh <cat:cmd> "<prompt>" [scenario]
scripts/sandbox/run.sh git:commit "/canon:git-commit"
scripts/sandbox/run.sh claude:plan-feature "/canon:plan-feature add a widget" small
```

## Decisions

### The envelope decides nothing alone

The JSON envelope carries `is_error`, `result`, `num_turns`, and `total_cost_usd`, plus a `verdict` object holding `state`, `asserted`, `failed`, and `unchecked`. An arm can return `error=false` having written nothing and met none of its scenario's expectations, so a suite scoring on the envelope would count it as a pass. `run.sh` snapshots the tree before the session, diffs it after, and hands the result to `canon sandbox check`, whose exit code becomes the run's outcome.

Override the model, allowed tools, turn cap, or permission mode with `CANON_SKILL_TEST_MODEL`, `CANON_SKILL_TEST_TOOLS`, `CANON_SKILL_TEST_MAX_TURNS`, and `CANON_SKILL_TEST_PERMISSION_MODE`. `canon/context/sandbox/isolation.md` covers why the defaults are `sonnet` and `bypassPermissions`.

### The run record

Every run lands at `.canon/tmp/runs/sandbox/<target>-<arm>-<timestamp>.json`, and `run.sh` logs the path on stderr. The file holds what stdout emitted plus a `writes` array. Both are needed to score a run again: `canon sandbox check` recovers the tree assertions from surviving sandbox state, but `max_turns` reads the envelope and `write_scope` reads the writes list, and the temp files carrying those are deleted at the end of the run.

- The record is gitignored scratch with no rotation, one file per run. Writing it is additive and stdout stays the data contract, so a failure to record warns on stderr and prints the verdict anyway. The turn count is then recoverable from nowhere else, so an arm whose record failed cannot have its ceiling calibrated without paying for the run twice.
- When the skill session exits non-zero, `record_dead_run` stamps `{is_error, exit_code, raw_output}` to the same folder ahead of that exit, so the run that most needs a record still gets one.
- A non-zero exit from `manage-sandbox.sh` during provisioning logs `Provisioning exited <n> before the session could start.`, which separates that failure from a session exit, since both leave no verdict and no run record.

### Turn budget

The default turn cap is 30, above the observed cost of the heaviest arm, because a truncated run fails the same assertions as a reasoning miss with nothing to tell them apart. `CANON_SKILL_TEST_MAX_TURNS` is the only budget. An arm's `max_turns` is a ceiling the checker asserts after the run, and `run.sh` never reads `expect.toml`, so a declaration cannot raise the cap it runs under. A per-arm budget would need `run.sh` to parse the declaration.

- Declare an arm's ceiling at the default and correct it from an observation. A ceiling under the cap catches truncation the same way an equal one does, since a truncated run reports one turn past the cap. A corrected ceiling asserts something the runner does not already enforce.
- Correct from a cost that holds rather than from one sample of a variable one. A route-only arm that resolves off one read has a fixed extent and can take its ceiling from a single run. An arm whose work follows what the run finds needs several runs and a ceiling above the widest, which is what `claude:docs-fold/anchor-sweep` carries. A ceiling derived from one path through a variable cost fires on a correct run.
- Never declare a ceiling above the cap. The checker fails an arm only on a count strictly over its ceiling, so a ceiling above the cap goes green on a truncated run and masks the one failure it exists to catch.
- Estimate an arm's cost from what it reads rather than from what it writes. A few extra edits cost little, and the turns go to reading the tree and reasoning about it.

### Dollar cost

An autonomous sonnet run tracks its turn count, and a light arm costs a fraction of a dollar. Drive one skill on demand rather than sweeping the catalog. The range `internal-sandbox-check` documents covers the cheap half alone: an arm whose skill does the domain work, such as `claude:plan-groundwork` `open`, which stages a workspace and writes a three-file track, costs several times the top of it. Read the documented range as a floor for such an arm.

## Gotchas

- Use the `/canon:<skill>` prompt form so `--plugin-dir` resolves the skill whether or not the branch changed it. A bare `/<skill>` resolves only for skills the sandbox injects.
- An injected skill is a copy of its `SKILL.md` alone, with none of its `references/`. A project skill outranks a plugin skill of the same name, so a run reaching the skill by its bare name or by a description match loads that copy, and every `${CLAUDE_SKILL_DIR}/references/` path in it resolves to nothing. Remove the injected folder before driving an arm for a skill that carries references.
- `run.sh` passes the prompt it is given and nothing else. The `Action:` block `stage_setup` prints goes to the provisioning log a human reads, not to the spawned session. A skill guarding on a missing argument, or routing on an explicit request rather than on tree state, answers a bare prompt with its own refusal or an `❌ Ambiguous` stop, and every assertion fails against a skill that works. Read the scenario's `Action:` line and pass that full command as the prompt. `claude:plan-intake/file` and every `claude:task-board` arm have this shape.
- `internal-sandbox-check` fixes the prompt at `/canon:<skill-name>` with no arguments, so a caller following it on an argument-guarded arm reports the mismatch rather than reading a defect in the skill.
- A multi-arm scenario puts the headless run out of reach of an unattended ship. `internal-sandbox-check` sends the choice of arm to a person, so a dispatched worker with nobody watching takes the `no-mechanism` gate and the branch ships with its scenario provisioned and unverified. `CANON_NON_INTERACTIVE=1` would hand the picker the first arm and return a verdict against an arm nobody chose.
- A sandbox session resolves `canon` off the machine's PATH, and the harness manages neither the binary nor the variable. An arm exercising a verb the branch adds runs against the global install, and a released binary predating the verb refuses and writes nothing. Put the branch's own CLI ahead on PATH for that run, and never repair it by installing over the operator's global.
