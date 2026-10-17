---
title: Overview
description: What the audit commands own, how their engines split, the aggregate that runs the set, what it gates on, and why the pipeline runs it without gating
---

# Overview

## Overview

Eight commands read a tree and report on it instead of writing into one, and three checks across them gate a push. What each measures and what it refuses to fail on is the decision worth carrying here.

- `canon context audit`, `canon markdown audit`, and `canon claude skills audit`
- `canon comments scan`, `canon tasks validate`, and `canon records validate`
- `canon gov test-order` and `canon labels audit`

`canon audits run` runs the whole set and is the only one anything schedules. `canon/context/cli/audits/index.md` lists the file each audit's decisions live in.

## Layout

- `src/audits/` owns the aggregate, its catalog of verbs, and the retained baseline comparison
- `src/context/` owns the folder contract, the structural measures, cited-path resolution, and index-to-sibling comparison, where only citation resolution gates anything
- `src/markdown/` owns rule reading, the line walker and its exclusions, the weight measures, and corpus resolution
- `src/comments/` owns the counting pass, the history sampler, and the vocabulary loader
- `src/secrets/`, `src/deps/`, and `src/labels/` own the secret scan, the advisory read, and the label map

Each engine splits by reason to change rather than by size. Counting, sampling, and rule reading are three reasons, and so are a folder contract, a checkpoint, an exclusion set, and a catalog format.

## Decisions

### The audit set

`canon audits run` runs twenty-one verbs together, reads each one's own record, and reports them under a single verdict. It writes no measure of its own, which keeps it cheap.

### Reading each shape beats a common envelope

Every record already has consumers naming its keys, and one refuses to rename a key for a gain of one word, so an envelope is a breaking change bought for tidiness. The cost is one extractor per verb in `src/audits/catalog.ts`.

An extractor meeting a record it cannot read returns nothing rather than zero, on the ground the context audit states about `--citations-only`.

### The verbs run together

They walk separate trees and share no state, so the set finished in 0.8 seconds of wall clock against 4.4 seconds of processor. That was measured at twelve verbs on the authoring machine at `bd2be81a`, and it settles whether `bun run check` can afford the stage.

`canon deps audit` is the first member whose latency is not this machine's, since it reaches an advisory index rather than a tree, so that figure does not bound the set on its own.

### `deps` dominates the latency

Three consecutive clean runs of `deps` measured 44.7, 77.6, and 62.9 seconds, dwarfing every other stage in `bun run check` combined. `src/deps/audit.ts` gives `execa` an explicit 120-second `timeout`, not bun's own 299-second ceiling.

### `--corpus` scopes a run

`--corpus <tracked|per-machine|upstream>` on `audits run` is repeatable and defaults to every corpus. `auditsFor` in `src/audits/run.ts` reads it, so a bare invocation reaches all twenty-one verbs including `deps` and a scoped one reaches fewer.

### Timing is on the record

`StageResult` and `AuditResult` both carry `ms`, timed around each stage and each spawn, so a slow run is attributable to a verb rather than hand-timed.

### The `placement` entry pins the regex layer

The `placement` entry runs `canon context classify sweep --backend off`, not the resolved classifier setting. A tally that moves with the model a machine runs cannot be compared across clones.

- The model layer ran about 17 minutes over the context sections on a 27B local model, against 0.14 seconds for the regex layer
- The model's reading stays with `document-health`, which reports to a reader rather than into a baseline
- The entry tallies `keep`, `rewrite`, and `move` through a record keyed on `SweepVerdict`, so a verdict the classifier adds fails the build

### What the aggregate gates on

Four findings gate, and each is a fact. Every other measure it prints is a judgment, and exiting non-zero on any finding would erase the recorded split in one line.

- An unresolved context citation
- A banned character
- A skill folder carrying no `REQUIREMENT.md`
- A credential-shaped value in the tree this repository publishes

### The gate is not widened by registration

Three of the four are the set the merge gate in `src/gate/stages.ts` already fails a push on, and the secret scan is the one gate with no stage behind it. The addition was decided on the fact-or-judgment test and asserted whole in `src/audits/catalog.test.ts`, so a fifth cannot arrive quietly.

Read the count in that test as the guard, not the policy.

### The catalog holds the decision, not the exit code

A reporting verb sets `2` on findings it deliberately does not gate on. Reading the code alone would promote every one of them to a gate the first time the aggregate ran.

### Exit 3 is a defect in the run

An audit that did not report is a defect in the run rather than the tree, and folding it into the clean or findings exit says the wrong thing about which is broken. It takes `3`, the code `canon markdown audit` already uses for a corpus walked with nothing looked for.

### Per-machine corpora take `absent`

Six of the set read gitignored folders, which no fresh clone and no CI run carries. The first shape reported `incomplete` on every run a contributor did not make on their own machine.

A per-machine corpus refusing because its folder is missing takes `absent`, which reports and moves nothing. The advisory check takes the same allowance, since an unreachable index is the same ordinary absence over a network.

### The corpus decides the allowance by default

A per-machine verb refusing for any reason other than a missing folder is a broken verb and stays `unmeasured`. So does a tracked tree that cannot be found, since that is a broken checkout.

A spec naming its own reasons overrides the default. Without the override every such project reports `incomplete` forever, the permanent signal the split exists against.

### Six tracked specs name reasons

Each is the ordinary state of a target installing this CLI, not a defect in it.

| Verb                        | Absence reason                                            |
| --------------------------- | --------------------------------------------------------- |
| Secret scan                 | A project that publishes nothing                          |
| Citation reach, skill audit | A project holding no skills tree                          |
| Context audit               | A project adopting none of the folders it measures        |
| Label audit                 | A project declaring no coverage map                       |
| Restated sweep              | A project with neither the seed nor a shipped skills tree |

Every run states the measured count against the absent one, since a report naming only what passed is a claim about a set it never read.

### `test-order` marks the baseline's edge

`canon gov test-order` scopes against the trunk and falls back to the root commit. A depth-1 checkout has neither, so the range is empty and it reports zero rather than refusing.

A shallow run therefore under-reports against a floor taken from a full clone and reads as shrinkage. That is the safe direction, and that delta means something only from a clone carrying history.

### Refusals write a record

Every audited verb writes a parseable record on its refusal path, since a refusal printing nothing reaches the aggregate as unparseable output rather than a reading it can act on.

`canon context audit` and `canon claude skills audit` each take the allowance the reach check had. A project adopting neither `canon/context/` nor an older install's `.canon/diagrams/`, or neither `claude/skills/` nor `.claude/skills/`, has adopted no convention either audit measures, so each names its one absence reason.

### Three verbs claim no allowance

`canon markdown audit`, `canon comments scan`, and `canon gov test-order` write a record on every refusal path and claim no allowance. A corpus with no markdown file, a bad `--languages` argument, and a tree with no git history are each a broken invocation or checkout, so they stay `unmeasured`.

### Why the pipeline runs it without gating

`bun run check` runs the set after the three gating stages and never fails on it. Those stages keep their own remedies, which are specific in a way one aggregate line cannot be, so a fact still fails the push where a reader is told what to do.

### The gate runs two corpora

`auditSet` in `src/gate/measures.ts` passes `--corpus tracked --corpus per-machine` to `audits run`. That excludes `deps`, the one `upstream` member, so `summary.audited` in the gate's record reads 19 rather than 20.

A push reads what describes this tree. A weekly `dependency-advisories` job in `.github/workflows/verify.yml` reads the advisory index on a schedule.

### Growth reports and does not gate

The standards behind the largest counts set no hard cap, and a push failing on a judgment teaches a contributor to route around the stage.

### The stage reads a flat `summary`

A flat `summary` object sits beside the nested arrays, so a shell stage greps one scalar rather than parsing the record. Every key in it is unique across the whole document, which keeps the match on the top level.

Publishing it beat deriving it in bash, since deriving means restating which question a number answers, and one wrong restatement reports growth against a measure that never moved.

### The second walk is the price of one verdict

The three verbs the gating stages already ran walk their trees a second time here, the 0.8 seconds above. It buys one verdict over the corpora the gate reads, where a stage measuring only the skipped part would report a health nobody took.
