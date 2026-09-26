---
title: Tasks plans
description: The five verbs that read or write a task's plan, being where it sits and who cites it, whether it waits on the operator, the branch it derives, what a branch reached against what it declared, and writing its Plan line
---

# Tasks plans

## Plan citations

`canon tasks plan-citations <stem>` answers where a task's plan sits and which other live tasks hold it. It reports and never writes.

| Option          | Effect                                      |
| --------------- | ------------------------------------------- |
| `--json`        | Emit a machine-readable record on stdout    |
| `--root <path>` | Board root, defaulting to the main worktree |

The record carries `location`, one of `unstated`, `live`, `archived`, or `outside`, and `citedBy`, the other live tasks whose `Plan:` line lands on the same file. Exit codes: `0` read, `1` refused with `no-board` or `no-match`.

The target resolves against the board folder and against the project root both, so `../plans/x.md` and `.canon/plans/x.md` land on the same file and one plan two tasks spelled differently counts once. Containment is tested at both record roots rather than at the one this tree resolves at, since a line somebody wrote against a root the tree has since left is still a path into the plans folder, and reading it as outside would report a shipped plan as still live. `docs/agents/records.md` states the read order.

`canon tasks archive` decides its plan move on this same answer, so a caller wanting the count reads it here rather than scanning the board.

Branch on `reason` rather than on the exit code, which is the rule `tasks-archive.md` already states for archive and which this verb needs for a second reason. An operator's shell profile may wrap `canon` in a function that runs the binary and then another command and takes the second status, which masks every non-zero exit rather than only an absent verb. The binary exits 1 for an unknown subcommand and 1 for an ordinary refusal alike, so the record is the only signal that survives the wrapper.

A `live` location with an empty `citedBy` is the sweep to run. One whose `citedBy` names a sibling is a plan several tasks share, which the sweep leaves alone and the archive gate lets through.

```bash
canon tasks plan-citations v28.1-trigger-escalation --json | jq -r '.location' # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
```

## Plan answers

`canon tasks plan-answers <plan>` answers whether a plan is launchable, which is whether it still waits on the operator for a call only they can make. It reports and never writes.

Name the plan by its path or by its slug, which resolve to the same file:

```bash
canon tasks plan-answers dispatch-answer-gate
canon tasks plan-answers .canon/plans/feature-dispatch-answer-gate.md
canon tasks plan-answers ../plans/feature-dispatch-answer-gate.md
```

A relative path resolves against the project root first and against `.canon/tasks/` second. The third form above is what a board row writes, since its link is relative to the board, and a dispatcher copying the reference out of the row it is dispatching has that spelling to hand rather than either of the other two. A refusal names every base it looked under.

`canon tasks plan-citations` reads a task's `Plan:` line against those same two bases in the opposite order, and tests that the target lands under the live plans folder, which this verb does not. Both answer the same file for every spelling a board writes. Liveness is a separate refusal here: a plan resolving inside `.canon/plans/archive/` returns `archived` rather than a launchable reading, since it answers every question and describes work that already shipped.

A plan still staging its batches with a `**Batch N**` sub-heading inside one file's `**Files to touch:**` reads `launchable: false` the same way, alongside the operator-call case. It reports as an entry in `open` labeled `Batch staging`, stating that the plan must split into one file per batch before it can dispatch, since the row waits on a split rather than on the operator.

| Option          | Effect                                      |
| --------------- | ------------------------------------------- |
| `--json`        | Emit a machine-readable record on stdout    |
| `--root <path>` | Board root, defaulting to the main worktree |

The record carries `launchable` and `open`, the questions still waiting, each with the `label` that names it and the `why` its suggestion gave for needing a person. Exit codes: `0` launchable, `1` refused with `no-plan`, `archived`, or `bad-input`, `2` waiting on the operator.

A blank `- Answer:` is not a waiting question. The plan standard fixes an empty slot as accepting the `- Suggested:` line above it, so the shapes this reads are `- Suggested: needs your call, <why>` and the two demonstrated paraphrases, `needs operator's call` and `needs the operator's call`, over an empty slot, which is what that standard writes where the answer turns on preference rather than on a technical default. A verb reading every blank slot as open would report every plan in the folder.

The question block is read through the same parser `canon tasks validate` runs, so the gate and the conformance check cannot drift into disagreeing about what a question is. A question carrying no suggestion at all is that check's finding rather than this one's, and it goes unread here.

Branch on `launchable` rather than on the exit code, for the reason the section above states: a shell profile wrapping `canon` in a function can take a later command's status and mask every non-zero exit, which reads a waiting plan as a launchable one.

The orchestrator dispatch runbook calls this before it checks the branch or the file sets, so a row whose plan still needs a person is handed back rather than launched into a worker that halts on the same question.

```bash
canon tasks plan-answers dispatch-answer-gate --json | jq -r '.launchable'
```

## Plan branch

`canon tasks plan-branch <plan>` derives the branch name from a plan file. It reports and never writes, and it names the plan the same two ways `canon tasks plan-answers` does, by path or by slug, against the same two bases.

```bash
canon tasks plan-branch dispatch-answer-gate
canon tasks plan-branch .canon/plans/feature-dispatch-answer-gate.md --json
```

| Option          | Effect                                      |
| --------------- | ------------------------------------------- |
| `--json`        | Emit a machine-readable record on stdout    |
| `--root <path>` | Board root, defaulting to the main worktree |

The record carries `type`, `slug`, `branch`, `words`, and `conforms`. Exit codes: `0` derived and conforming, `1` refused with `no-plan`, `archived`, or `bad-input`, `2` derived with `conforms` false. Branch on `conforms` rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

`slug` is the plan filename with its `feature-` prefix and its extension taken off, and `type` is the constant `feat`. Reading a type off the plan's prose was the alternative, and it is the half of the derivation that has already disagreed with itself: one dispatch checked `fix/path-form-hook` against a worker that took `feat/path-form-hook`, both sides reading one plan. What makes the constant safe is that a branch type is cosmetic. `git-stage` reads a commit's type off the staged diff and `git-pr` reads a title off the diff, so the semantics a release reads never pass through the branch name. What it costs is a worktree listing where every plan-derived branch reads `feat/`, and nothing renames it later.

`conforms` reads both caps `standards/branch.md` states, being 4 words on the description and 50 characters on the whole branch. A false reading is a row for a person rather than a name to shorten here, since a rename parts the branch slug from the plan slug that `session-worktree` tier 1 and `git-pr`'s plan lookup both read back.

Both sides of a dispatch call it. The orchestrator's collision check derives its candidate here, and `auto-ship` Step 0 derives the worktree it enters from the same plan, so the branch a gate clears and the branch a session takes are one string by construction. They were two readings of one paragraph until 2026-09-06, when four dispatches on one plan produced three different strings.

```bash
canon tasks plan-branch dispatch-answer-gate --json | jq -r '.branch'
```

## Plan reach

`canon tasks plan-reach <plan>` reads a branch back against what was written down about it. It reports and never writes, and it names the plan the same two ways `canon tasks plan-branch` does.

```bash
canon tasks plan-reach dispatch-answer-gate
canon tasks plan-reach dispatch-answer-gate --base origin/main --json
```

| Option          | Effect                                         |
| --------------- | ---------------------------------------------- |
| `--base <ref>`  | Far side of the range, defaulting to the trunk |
| `--json`        | Emit a machine-readable record on stdout       |
| `--root <path>` | Board root, defaulting to the main worktree    |

The record carries `claimed`, `undeclared`, `declared`, `base`, `changed`, `plans`, `rows`, and `board`. Exit codes: `0` read with nothing claimed, `1` refused with `no-plan`, `archived`, `bad-input`, `no-base`, or `no-diff`, `2` read with a claim standing. Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

`claimed` leads because it is the short list and the one worth acting on. It carries one entry per path, each holding a `holders` list, so a track carrying both a live plan and a `## Run now` row reads as one holder rather than two. A holder names itself, its `source` of `plan` or `row`, and the `declaration` it matched on, so a folder claim reports which folder rather than leaving the reader to find it. A plan holder also carries `rowed`, whether that plan has a row in `## Run now` at all: a plan with no row is the shape a plan nobody archived takes, and equally the shape of one whose task has yet to be dispatched, so it narrows the reader's search rather than answering it. `undeclared` is every changed path this plan never named, which runs long on an ordinary branch: over the wave this verb was filed against, it ran 22 of 26 paths on one pull request and 18 of 25 on another. Those are the ship chain's own writes rather than scope creep, since the sync skills reach a context entry and the public docs, and the check stages regenerate what they assert.

A declaration is a backticked span standing as an entry's subject, ahead of the colon opening its reason. Reading every span was the alternative and it reports pairs that were never going to collide, since a reason routinely cites a file the entry is not about: measured over the same wave, the subject rule reports 6 crossing pairs against 14 for every span. Both sides of a rename declare, since both sit ahead of the colon.

The range is read at the current directory and the plans and board at the board root, so a linked worktree reads its own branch against the shared records. Reading both at one root was the alternative and it measures a main checkout sitting on the trunk, where the range closes on itself and every branch reports a reach of nothing.

It reads only what is written down, so it inherits the dispatch runbook's blindness: a hand-launched track carries no row and a track with no plan carries no declaration. The `plans`, `rows`, and `board` fields say how much there was to compare against, so a clear reading over an empty corpus does not read as a proof. A missing board reports `board: false` and zero rows rather than refusing, since a project with plans and no board still has a branch worth reading.

A claim is only as current as the folder it was read from, and the live folder holds a plan whose work already shipped until something archives it. `canon tasks archive` moves a plan on merge, so a plan stranded by a run that never reached the archive keeps claiming its files against every branch afterwards. Check whether the holder is actually in flight before treating a claim as a collision: the first run of this verb on its own branch reported five paths held by a plan whose verb had already merged, and the whole reading came of a file nobody archived. `canon tasks validate` is what reports the stranded plan itself.

`canon:git-ship` runs it at step 5, after `git add -A` and before the commit grouping. That is the first point the branch is whole and the last before a pull request exists to carry the answer.

```bash
canon tasks plan-reach dispatch-answer-gate --json | jq -r '.claimed[] | "\(.path) held by \([.holders[].name] | join(", "))"'
```

## Plan link

`canon tasks plan-link <task> <plan>` writes or corrects a task's `Plan:` line, as `Plan: [<label>](<target>)` right after the H1. `plan-feature` calls it right after a plan file lands, when Step 1 resolved an existing task for the feature, so the line is a mechanical write rather than hand-edited markdown.

Name the task by its filename stem, and the plan by its path or its slug, the same two forms `canon tasks plan-answers` accepts:

```bash
canon tasks plan-link v28.1-trigger-escalation dispatch-answer-gate # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
canon tasks plan-link v28.1-trigger-escalation .canon/plans/feature-dispatch-answer-gate.md --json
```

| Option          | Behavior                                    |
| --------------- | ------------------------------------------- |
| `--json`        | Emit a machine-readable record on stdout    |
| `--root <path>` | Board root, defaulting to the main worktree |

The plan resolves the same way `canon tasks plan-answers` resolves one, against the project root first and `.canon/tasks/` second, so a bare slug and a board-relative path both work. A reference resolving to no file refuses as `no-plan`, naming every base it looked under.

The write adds the line when it is absent and corrects the target in place when it exists, anchored on the H1 rather than on the last origin line, since `Plan:` is the first origin line a task carries rather than the last. The `action` field reports `added`, `corrected`, or `unchanged`, which makes a rerun against the same plan safe.

Exit codes: `0` recorded, `1` refused. The `reason` field carries `no-board`, `no-match`, `no-plan`, or `bad-input`.
