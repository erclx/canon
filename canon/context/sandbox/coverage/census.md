---
title: Census
description: The per-skill census and its verdicts, how a scenario pairs to a skill, the ship-time audit that reads it, and exemptions
---

# Census

`canon sandbox coverage --skills` adds a per-skill verdict beside the scenario view. It answers what the scenario count cannot, which is whether anything can fail a given skill.

## Decisions

### Verdicts

A skill reports one of three verdicts.

| Verdict              | Means                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asserted`           | an arm paired to it declares a mechanical assertion                                                                                                 |
| `should-be-asserted` | the honest default rather than a work queue, with the blast-radius rule in `canon/context/sandbox/coverage/overview.md` deciding which earns an arm |
| `exempt`             | no arm should be written, which holds only with a reason                                                                                            |

The denominators disagree on purpose. Fewer skills are asserted than scenarios are armed, because arms such as `infra:wiki`, `infra:drift`, and `infra:gov` drive a CLI domain rather than a skill. Both views print, since replacing the scenario view would lose the rollout `--strict` is written against.

- The census counts `claude/skills/`, not `.claude/skills/`, since the second holds toolkit-internal skills that reach no target
- An arm reports as `<category>:<command>/<arm>` rather than bare. A skill two scenarios drive can hold two arms of the same name, and deduplicating would report one arm where two assert.

### Pairing

Pairing tries two spellings, `<category>-<command>` first and bare `<command>` second. The fallback pairs `claude/target-setup.ts` to `target-setup` rather than to a `claude-target-setup` that does not exist. The rule lives in `skillForScenario`.

`SANDBOX_ASSERTED_FLOOR` in `src/gate/measures.ts` pins the asserted-skill count, so a rename that drops a pairing fails the push it ships on. The `Sandbox coverage` stage counts scenarios declaring an expectation, not skills reached, so without the floor renames would drop pairings under a green gate.

### The ship-time audit

`internal-sandbox-check` resolves a skill here first, taking the `scenarios` entry as the pairing and the verdict as the report, rather than falling back to its own `<category>/<rest>.ts` split whenever that split finds no file. A per-run label answered in the audit reaches nothing and asks the same question again on the next branch.

- The census reaches skills alone, so the audit's script mapping keeps a prompt of its own
- `scripts/core/` meets it on every branch, and the standing answer is `none`, since those scripts are the check runner and its guards, exercised by every `bun run check`
- A skill with no scenario can still have a file at `infra/<rest>.ts`. The audit offers that path and records neither answer, since the file proves a scenario exists, not that it exercises the skill.
- An internal skill draws no prompt at all, being absent from the denominator by construction

### Exemptions

An exemption lives in `sandbox/exempt.toml`, keyed by skill with a `reason`. It cannot live in the arm's `manual` array, because `resolveVerdict` fails any declaration carrying zero mechanical assertions, so an `expect.toml` holding only an exempt reason goes red the moment it is written.

Two reasons qualify, being a harness limit the checker cannot reach past, and a skill that writes no artifact. "Nobody has written one yet" is `should-be-asserted`.

- An armed arm outranks an exemption
- Two wrong exemptions print as errors and exit 1 without `--strict`, since an uncheckable claim is worse than none. One names a skill the tree no longer carries, the other a skill an arm now asserts.
- Losing an exemption is invisible in the counts, since the skill reclassifies to `should-be-asserted`
- The parser therefore throws on a file that does not parse and on a table carrying no usable `reason`, and `runCoverage` catches both and frames them

## Gotchas

### Internal skills and create skills

Two skill families answer `none` for different reasons.

- `internal-sandbox-check` Step 2a splits a skill name on its first `-`, so `internal-claude` resolves to `sandbox/internal/claude.ts`, which has no category. Answer `none`.
- The `create-*` skills report `no scenario` and read `should-be-asserted`. Answer `none` when the ship is not the place for a scenario, and record the gap rather than reading it as coverage.

### Renames break pairing silently

A skill rename that leaves its scenario file's name behind breaks pairing silently. A scenario `docs/draft.ts` beside skills named `draft-<kind>` pairs `docs-draft`, and `--skills --json` reports empty `scenarios`. Renaming the scenario file and fixture folder is a separate step, and a merge takes one scenario named for the merged skill.

A citation sweep after a scenario rename greps for two more shapes than `claude/<name>(\.ts|/)` and `claude:<name>`.

- A `ctx.fixtures('claude', '<name>', '<arm>', '<stage>')` call carries the name as a positional argument and breaks fixture staging at run time when the folder moves
- Prose naming a scenario bare leaves a sentence that no longer resolves, so re-read the narrative around any hit
