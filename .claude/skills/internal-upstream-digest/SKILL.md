---
name: internal-upstream-digest
description: Triages the Claude Code releases published since the last digest against this repository and files the findings as one intake pass. Use when asked to "run the upstream digest", "triage the Claude Code releases", or "what changed upstream since last time". Do NOT use for a single feature question, which is `internal-ask`, or to edit a wiki page.
disable-model-invocation: true
---

# Internal upstream digest

Run by hand, inside this repository, in the operator's own session. Each run turns every Claude Code release since the stored cursor into ranked findings with evidence and files them as one intake pass. It is a first pass: recall is incomplete, so say so in the overview and do not present the result as exhaustive.

The reasoning for running locally and for advancing the cursor last is in `canon/context/claude-internal/upstream-digest.md`. The verb contract is in `docs/agents/upstream.md`.

## Guards

- Run every `canon upstream` call as `bun src/cli.ts upstream ...` from the repository root. The global `canon` resolves to the installed package, which lacks the verb until a release ships it.
- If `fetch` refuses, stop and report its `reason`. For `no-cursor`, ask which version the last digest covered and re-run with `--since <version>`.
- Do not edit any file outside the intake folder. A finding names the file to change and leaves the change to its own plan.
- Do not run `advance` before the intake pass is filed.

## Step 1: fetch

```bash
bun src/cli.ts upstream fetch --json
```

Read `from`, `to`, `lines`, and `llms`. Each line carries its version, date, text, and the repository files naming any backticked identifier in it. `llms.added` and `llms.removed` are docs pages that appeared or left since the last digest, so read them as pointers to features the release lines may not mention.

When `lines` is empty, report the range as empty and stop without filing or advancing.

## Step 2: read the catalog

```bash
bun src/cli.ts upstream catalog
```

This is canon's own mechanisms, generated from the tree. Name a Retire match against a row in it. Report any row under Gaps in the overview.

## Step 3: triage

Sort every line into one class. Verify each claim against the files before keeping it.

| Class   | Test                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Revisit | It trips a "Revisit when" sentence in `canon/ARCHITECTURE.md` or `canon/context/`, or lifts a gate, preview, or limitation a canon record says it is waiting on |
| Retire  | The platform now ships what a catalog mechanism does, fully or partly, so canon could delete or shrink its own                                                  |
| Adopt   | It gives a canon workflow a capability it lacks, works around by hand, or could do better with it. Name the canon surface and the gain                          |
| Fix     | It breaks or changes behavior canon depends on                                                                                                                  |
| Wiki    | It makes a lesson on a `wiki/claude/` page false, or its orientation paragraph wrong, in a way a reader would act on. Open the page and quote the line          |
| Drop    | None of the above                                                                                                                                               |

- Ask of each new built-in command, tool, or extension mechanism which catalog row does something overlapping, since Retire is the class a read of release lines alone misses.
- A line you confirm changes nothing in canon is a near-miss, never a Fix.
- A gate or preview a canon record waits on is Revisit even when nothing else about the line matters.
- The wiki pages hold a `Source:` link, an orientation paragraph, and lessons, and restate no reference. Test a line against the lessons and the orientation only.

Rank each class most important first. Every finding carries the version, the shortened release line, the canon surface, the evidence as `file:line` or a quote, and one sentence of reason. List up to ten near-misses with a line each.

## Step 4: file the pass

Load `canon:plan-intake` and file one pass with slug `claude-code-<from>-to-<to>`, the versions written with dashes for dots. Each finding is an item whose verdict follows its class. State the release range, the count per class, and the first-pass recall caveat in the overview body, since intake frontmatter carries only `date`.

## Step 5: advance the cursor

Only after the pass is on disk:

```bash
bun src/cli.ts upstream advance <to> --intake claude-code-<from>-to-<to>
```

Report the intake folder, the range, and the count per class. A refusal here leaves the pass filed and the cursor where it was, so report the reason and stop.
