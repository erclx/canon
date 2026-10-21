---
title: Headless verification
description: How internal-sandbox-check Step 6 drives one arm of the provisioning scenario through canon sandbox run, resolves the arm, reports the verdict, and names the gate an unverified item carries
---

# Run the headless verification

Step 6 of `internal-sandbox-check`. Step 4 reads the arm rule below before the report prints, and Step 6 reads the rest when neither skip condition in the body holds.

Verify the `Provisioning:` scenario through `canon sandbox run`, which drives the skill under `claude -p` and returns without holding a terminal. Run one arm per invocation and never sweep the `Queued:` list, which keeps the spend inside the $0.10 to $0.25 a run costs.

```bash
canon sandbox run <category>:<rest> "/canon:<skill-name>" <arm>
```

Derive the arguments from the Step 2 mapping:

- Target: `<category>:<rest>` from the scenario path `sandbox/<category>/<rest>.ts`
- Prompt: `/canon:<skill-name>` with no arguments, since `canon sandbox run` injects no skill and only the qualified form reaches the branch's body through `--plugin-dir`
- Arm: required for a multi-arm scenario, omitted for a single-arm one

## Resolving the arm

Resolve the arm at Step 4, before the report prints. A scenario file with more than one key under `arms` is multi-arm, which is roughly half the catalog, so treat that case as ordinary.

A multi-arm scenario run with no arm never reaches the skill session. The provisioning child sets `SANDBOX_SCENARIO` only when it receives an arm, so without one the scenario falls through to the picker.

- The picker refuses a caller with no terminal on stdin, which is every agent-driven run, and lists the arm names in the refusal. It blocks on input when a terminal is attached.
- It never takes the first arm for a headless caller, so the refusal is the whole outcome and no verdict follows it
- Do not guess the arm from the scenario file. Ask `Arm for <category>:<rest>? (arm name, or "none" to skip verification)`, and read `none` as the `no-mechanism` gate.

## Running and reporting

Print the target, prompt, and arm before running, since a wrong pairing is invisible in the verdict alone. A scenario that needs prompt arguments is a case to report, not to guess at.

`canon sandbox run` merges a `verdict` object carrying `state`, `asserted`, `failed`, and `unchecked` into the JSON envelope on stdout. Report it rather than asserting it.

- Print `state` as it came back, and say so when it is `unchecked`, which means the arm declared no expectations and asserted nothing
- Read `unchecked` as neither a pass nor a failure. `--strict` covers a caller that has finished arming.
- Do not fix a failing verdict. The skill surfaces the result and the user decides.

Print one line after the run:

```plaintext
Verification: <state>  <category>:<rest>  →  <asserted> asserted, <failed> failed, <unchecked> unchecked
```

## Gate vocabulary

An item shipping without live verification names exactly one gate. Cost, credentials, and no-mechanism have different fixes, and a report collapsing them lets an affordable run and an impossible one read the same.

| Gate           | What it blocks                                                  | Who clears it                                |
| -------------- | --------------------------------------------------------------- | -------------------------------------------- |
| `no-mechanism` | An arm with no scenario, or a claim no assertion kind carries   | A task that writes the scenario or assertion |
| `credentials`  | The `anchor: true` scenarios, off an authenticated machine      | The operator, once                           |
| `cost`         | Nothing at this scale. One arm sits inside the documented range | Nobody, it is already affordable             |

Use `cost` only for a sweep across the catalog the user asked for. A single arm never earns it.
