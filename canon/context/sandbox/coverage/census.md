---
title: Census
description: The per-skill census and its verdicts, how a scenario pairs to a skill, the ship-time audit that reads it, and exemptions
---

# Census

`canon sandbox coverage --skills` adds a per-skill verdict beside the scenario view. It answers what the scenario count cannot, which is whether anything can fail a given skill.

## Decisions

### Verdicts

A skill reports one of three verdicts. `asserted` means an arm paired to it declares a mechanical assertion. `should-be-asserted` is the honest default rather than a work queue, and the blast-radius rule in `canon/context/sandbox/coverage/overview.md` decides which of those earns an arm. `exempt` means no arm should be written, and it holds only with a reason.

The denominators disagree on purpose. Fewer skills are asserted than scenarios are armed, because arms such as `infra:wiki`, `infra:drift`, and `infra:gov` drive a CLI domain rather than a skill. `--skills` carries `totalSkills` and `asserted` for the current pair, and both views print, since replacing the scenario view would lose the rollout `--strict` is written against.

The census counts `claude/skills/`, not `.claude/skills/`. The second holds toolkit-internal skills that reach no target, and folding them in would inflate a denominator meant to describe what ships.

An arm reports as `<category>:<command>/<arm>` rather than bare. A skill two scenarios drive can hold two arms of the same name, and deduplicating would report one arm where two assert, which understates in the direction this measure exists to keep honest.

### Pairing

Pairing tries two spellings, `<category>-<command>` first and bare `<command>` second. The fallback is what pairs `claude/target-setup.sh` to `target-setup` rather than to a `claude-target-setup` that does not exist. The rule lives in `skillForScenario`.

`SANDBOX_ASSERTED_FLOOR` in `src/gate/measures.ts` pins the asserted-skill count, so a rename that drops a pairing fails the push it ships on. The `Sandbox coverage` gate stage counts scenarios that declare an expectation rather than skills a scenario reaches, and the two numbers move independently, so without the floor a wave of renames would drop pairings under a green gate.

### The ship-time audit

`internal-sandbox-check` resolves a skill here first, taking the `scenarios` entry as the pairing and the verdict as the report, rather than falling back to its own `<category>/<rest>.sh` split whenever that split finds no file. A per-run label answered in the audit reaches nothing and asks the same question again on the next branch.

- The census reaches skills alone, so the audit's script mapping keeps a prompt of its own. `scripts/core/` meets it on every branch, and the standing answer is `none`: those scripts are the check runner and its guards, exercised by every `bun run check` rather than by a provisioned target, and no `infra/core.sh` exists or should.
- A skill the census carries with no scenario can still have a file at `infra/<rest>.sh`. The audit offers that path and records neither answer on its own, because the file proves a scenario exists rather than that it exercises the skill. A scenario staging trees a CLI walks can exercise nothing the offered skill decides, so the correct pairing is the scenario exercising the skill's decision.
- An internal skill draws no prompt at all, being absent from the denominator by construction.

### Exemptions

An exemption lives in `scripts/sandbox/exempt.toml`, keyed by skill with a `reason`. It cannot live in the arm's `manual` array, because `resolveVerdict` fails any declaration carrying zero mechanical assertions, so an `expect.toml` holding only an exempt reason goes red the moment it is written.

- Two reasons qualify: a harness limit the checker cannot reach past, and a skill that writes no artifact. "Nobody has written one yet" is `should-be-asserted`.
- An armed arm outranks an exemption. Two kinds of wrong exemption print as errors and exit 1 without `--strict`, since a claim nobody can check is worse than no claim: one names a skill the tree no longer carries, and the other names a skill an arm now asserts. Reporting the verdict while dropping the entry would leave committed data nobody is told to delete.
- Losing an exemption is invisible in the counts, since the skill reclassifies to `should-be-asserted`. The parser therefore throws on a file that does not parse and on a table carrying no usable `reason`, and `runCoverage` catches both and frames them.

## Gotchas

- `internal-sandbox-check` Step 2a splits a skill name on its first `-`, so `internal-claude` resolves to `scripts/sandbox/internal/claude.sh`, and no `internal/` category exists. Internal skills carry the reserved `internal-` prefix and the missing file is correct by design, so answer `none` and do not invent the category.
- The `canon-` family splits the same way and is rescued. Rule 1 sends `canon-operator` to a `scripts/sandbox/canon/` category that does not exist, and rule 2 reads the census pairing and records `scripts/sandbox/claude/canon-operator.sh`, reached through the bare-command fallback. Rule 1 running first is harmless, since a split resolving to nothing costs a wasted test rather than a wrong pairing.
- The `create-*` skills report `no scenario` and `exempt.toml` carries none of them, so they read `should-be-asserted`. Answer `none` when the ship is not the place to write a scenario, and record the gap rather than reading `NONE` as settled coverage.
- A skill rename that leaves its scenario file's name behind breaks pairing silently. `docs/draft.sh` pairs `docs-draft` rather than `draft-docs`, `draft-context`, `draft-wireframes`, or `draft-readme`, and the bare fallback `draft` misses too, so `--skills --json` reports all four `should-be-asserted` with an empty `scenarios` array while a real scenario exists. Renaming the scenario file and fixture folder to match is a separate step from renaming the skill.
- A citation sweep after a scenario rename greps for two more shapes than `claude/<name>(\.sh|/)` and `claude:<name>`. A `stage_fixtures claude <name> <arm> <stage>` call is a space-separated positional argument, and it breaks fixture staging at run time when the folder moves. Prose naming a scenario bare leaves a reader-facing sentence that no longer resolves. Re-read the narrative around any hit.
