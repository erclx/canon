---
title: Audits
description: Running every health check as one set, the verdict and exit codes, the corpus states, the retained baseline and its delta, and a catalog of every audit verb with whether a finding gates
kind: reference
---

# Audits

`canon audits run` runs every audit this repository owns, reports each under one verdict, and compares each count to the baseline the last recorded run left. Every number comes from a verb in the catalog below.

```bash
canon audits run
canon audits run --json
canon audits run --record
canon audits run --corpus tracked --corpus per-machine
canon audits list --json
```

`--record` writes the tracked counts to `canon/config/baseline.json`. `--corpus` limits the run to `tracked`, `per-machine`, or `upstream` and repeats. `--root <path>` measures another tree. `canon audits list` prints the catalog the run reads.

## Output

`summary.verdict` is `clean`, `reported`, `findings`, or `incomplete`. Every run also states how many corpora it measured against how many it skipped.

| Code | Meaning                                                              |
| ---- | -------------------------------------------------------------------- |
| `0`  | Every audit reported and none carried a finding that is a fact       |
| `1`  | Refused, with the reason on stderr                                   |
| `2`  | An audit carries a finding that is a fact                            |
| `3`  | An audit did not report, so the run measured less than the whole set |

Code `3` marks a defect in the run rather than in the tree. An unparseable record, a verb that could not start, and an undocumented exit all land there.

Four findings gate, being an unresolved context citation, a banned character, a skill folder with no `REQUIREMENT.md`, and a credential-shaped value in the shipped tree. Everything else reports, and growth against the baseline reports too.

**Corpus states.**

An audit that finds no corpus reports `absent`, which moves neither the verdict nor the exit code. Anything unread that should exist is `unmeasured`, which sets `incomplete` and exit `3`.

- A per-machine folder missing from this disk is `absent`
- `upstream` is `absent` offline, and stays out of the baseline
- The secret scan reports `no-manifest`, `no-publish`, and `no-shipped-files` as `absent`, and `no-files-field` and `no-git` as `unmeasured`
- The skill audits, the citation reach check, and the routing measure report `absent` for a project with no skills tree
- The context audit reports `absent` for a project that adopted none of its folders, and a tree git cannot list is `unmeasured`

**Baseline.**

`canon/config/baseline.json` holds the counts from the last `--record`, with the day and the commit. It falls back to `.claude/canon/baseline.json` for a project that has not moved. Each run reports which counts moved and by how much.

- A run with no baseline says so rather than showing a delta of zero
- A key on one side only is named as new or gone
- A per-machine record and the task board are reported every run and never recorded
- An audit that did not report is left out, never written as zero
- A baseline that does not parse refuses the run

`gov test-order` reads zero in a shallow clone, so read its delta only from a clone carrying the history.

**In `bun run check`.**

`bun run check` runs `--corpus tracked --corpus per-machine` as a reporting stage after the gating stages, and never fails on it. `summary` is a flat object of unique scalar keys that a shell stage greps without a JSON parser. `deps` runs weekly instead. Each audit runs as the CLI the caller is running, never a global `canon`.

**Catalog.**

`canon audits list` reports the first 18 rows. The rows marked `outside` run by hand or from a skill and sit beside the aggregate.

| Id                   | Verb                                | Measures                                                                                    | Finding        |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- | -------------- |
| `context`            | `canon context audit`               | Context folder structure, citations, and the requirements record's word cap                 | Gates          |
| `markdown`           | `canon markdown audit`              | Bans, dead links, density, and reference shape                                              | Gates          |
| `skills`             | `canon claude skills audit`         | Both skill corpora against the skill standards, and any ledger under `canon/ledger/skills/` | Gates          |
| `skills-reach`       | `canon claude skills reach`         | Skill bodies citing a path no target receives                                               | Reports        |
| `skills-rank`        | `canon claude skills rank`          | Whether skill descriptions separate against a routing case corpus                           | Reports        |
| `tasks`              | `canon tasks validate`              | Board rows nothing resolves                                                                 | Reports        |
| `records-plans`      | `canon records validate plans`      | Plan records against their shape                                                            | Reports        |
| `records-groundwork` | `canon records validate groundwork` | Groundwork folders against their shape                                                      | Reports        |
| `records-intake`     | `canon records validate intake`     | Intake folders against their shape                                                          | Reports        |
| `comments`           | `canon comments scan`               | Comment density by language and kind, and `TODO`, `FIXME`, `HACK`, `XXX`                    | Reports        |
| `test-order`         | `canon gov test-order`              | Implementations that reached branch history before their test                               | Reports        |
| `secrets`            | `canon secrets scan`                | Credential-shaped values in the shipped tree                                                | Gates          |
| `labels`             | `canon labels audit`                | Changed paths no row of the label map reaches                                               | Reports        |
| `restated`           | `canon gov restated`                | Instructions `CLAUDE.md` states that a second surface states too                            | Reports        |
| `rules`              | `canon gov audit`                   | Rules past a shape limit or out of step with a ledger, and here rules short of one          | Reports        |
| `counts`             | `canon gov counts`                  | Sentences stating a closed catalog's size that disagree with the tree                       | Reports        |
| `census`             | `canon census`                      | File count, extension breakdown, and line total                                             | Reports        |
| `deps`               | `canon deps audit`                  | Advisories against the resolved dependencies                                                | Reports        |
| `outside`            | `canon gov citations`               | Rule citations and internal frontmatter globs reaching nothing                              | Gates in check |
| `outside`            | `canon gov superseded <old> <new>`  | Where the tree still asserts a value a changed convention no longer produces                | Reports        |
| `outside`            | `canon claude skills drift <ref>`   | Shipped skill bodies rewritten since a ref                                                  | Reports        |
| `outside`            | `canon claude routing`              | Per `CLAUDE.md` section, how many bullets name a path and whether a rule covers it          | Reports        |

A deliberate secret takes a `canon-allow-secret: <reason>` marker. A deliberate citation takes `canon-allow-citation: <reason>` and a deliberate superseded value takes `canon-allow-superseded: <reason>`, each on its own line or the one above. Run any verb with `--help` for its flags and refusal reasons.

## Refusals

- A baseline that does not parse
- A `--root` that is not a tree git can list

## See also

- `markdown-audit.md`: the markdown audit
- `context-audit.md`: the context audit
