# Authoring test

This folder holds frozen evidence from a retired authoring test. The runner and its fixture archive were deleted on 2026-10-01 and are restorable from git history.

The records that stay:

- `ledger.md`: one row per run, with date, arm, kind, subject commit, cost, turns, verdict, and output path
- `pre-registration.md`: what counted as a hit before either run
- `result-context.md`: the 2026-07-31 run against `standards/context.md`
- `result-wireframes.md`: the 2026-07-31 run against `standards/wireframes.md`
- `result-seed.md`: the run against the Claude seed

Each record quotes paths and rules as they stood on its run date, so a path inside one that no longer resolves is the record working. What the arms measured and what the results report past is in `canon/context/scripts/eval.md`.
