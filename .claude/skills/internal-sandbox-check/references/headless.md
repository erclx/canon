---
title: Headless verification
description: How internal-sandbox-check Step 6 drives one arm of the provisioning scenario through scripts/sandbox/run.sh, resolves the arm, reports the verdict, and names the gate an unverified item carries
---

# Run the headless verification

Step 6 of `internal-sandbox-check`. Step 4 reads the arm rule below before the report prints, and Step 6 reads the rest when neither skip condition in the body holds.

Verify the `Provisioning:` scenario through `scripts/sandbox/run.sh`, which drives the skill under `claude -p` and returns without holding a terminal. One arm per invocation. Never sweep the `Queued:` list, which is what keeps the spend inside the $0.10 to $0.25 a run costs.

Derive the arguments from the Step 2 mapping:

- Target: `<category>:<rest>` from the scenario path `scripts/sandbox/<category>/<rest>.sh`
- Prompt: `/canon:<skill-name>` with no arguments. The qualified form resolves through `--plugin-dir` whether or not the branch changed the skill, and a bare `/<skill-name>` resolves only for the ones the sandbox injects.
- Arm: required for a multi-arm scenario, omitted for a single-arm one

```bash
scripts/sandbox/run.sh <category>:<rest> "/canon:<skill-name>" <arm>
```

## Resolving the arm

Resolve the arm at Step 4, before the report prints. Grep the scenario file for `select_or_route_scenario`, which is what a multi-arm scenario calls. Roughly half the catalog declares it, so treat the multi-arm case as ordinary rather than exceptional.

A multi-arm scenario run with no arm never reaches the skill session. `run.sh` forwards the arm to `manage-sandbox.sh`, which sets `SANDBOX_SCENARIO` and `CANON_NON_INTERACTIVE` only when it receives one, so an empty arm leaves both unset and `select_or_route_scenario` falls through to the picker. The picker aborts on a missing TTY, which is every agent-driven run, and it blocks on input when a TTY is attached. Passing `CANON_NON_INTERACTIVE=1` to dodge that is worse than not running, since the picker then takes the first arm and the verdict reports an arm nobody chose.

Do not guess the arm from the scenario file. Ask the user: `Arm for <category>:<rest>? (arm name, or "none" to skip verification)`. Accept `none` as the `no-mechanism` gate. This mirrors the question Step 2a already asks when a skill maps to no scenario.

## Running and reporting

Print the target, prompt, and arm before running, since a wrong pairing is invisible in the verdict alone. A scenario that needs prompt arguments is a case to report, not to guess at.

Report the verdict. Do not assert it. `run.sh` merges a `verdict` object into the JSON envelope on stdout carrying `state`, `asserted`, `failed`, and `unchecked`. Print `state` as it came back, and say so when it is `unchecked`, which means the arm declared no expectations and the run asserted nothing.

Do not read `unchecked` as a pass or convert it into a failure. `--strict` covers a caller that has finished arming.

Do not fix a failing verdict. The skill surfaces the result and the user decides.

Print one line after the run:

```plaintext
Verification: <state>  <category>:<rest>  →  <asserted> asserted, <failed> failed, <unchecked> unchecked
```

## Gate vocabulary

An item shipping without live verification names exactly one gate. Cost, credentials, and no-mechanism are different facts with different fixes, and a report that collapses them lets an affordable run and an impossible one read the same.

| Gate           | What it blocks                                                  | Who clears it                                |
| -------------- | --------------------------------------------------------------- | -------------------------------------------- |
| `no-mechanism` | An arm with no scenario, or a claim no assertion kind carries   | A task that writes the scenario or assertion |
| `credentials`  | The `use_anchor` scenarios, off an authenticated machine        | The operator, once                           |
| `cost`         | Nothing at this scale. One arm sits inside the documented range | Nobody, it is already affordable             |

Use `cost` only for a sweep across the catalog the user asked for. A single arm never earns it.
