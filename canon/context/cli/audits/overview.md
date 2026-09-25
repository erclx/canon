---
title: Overview
description: What the audit commands own, how their engines split, the aggregate that runs the set, what it gates on, and why the pipeline runs it without gating
---

# Overview

## Overview

`canon context audit`, `canon markdown audit`, `canon claude skills audit`, `canon comments scan`, `canon tasks validate`, `canon records validate`, `canon gov test-order`, and `canon labels audit` are the commands that read a tree and report on it instead of writing into one. None installs anything, and three checks across the eight gate a push, so what each measures and what it refuses to fail on is the decision worth carrying here. `canon audits run` runs the whole set and is described first, since it is the only one of them anything schedules. `canon/context/cli/audits/index.md` lists the file each audit's decisions live in.

## Layout

- `src/audits/` owns the aggregate, its catalog of verbs, and the retained baseline comparison
- `src/context/` owns the folder contract, the structural measures, cited-path resolution, and index-to-sibling comparison, where only citation resolution gates anything
- `src/markdown/` owns rule reading, the line walker and its exclusions, the weight measures, and corpus resolution
- `src/comments/` owns the counting pass, the history sampler, and the vocabulary loader
- `src/secrets/`, `src/deps/`, and `src/labels/` own the secret scan, the advisory read, and the label map

Each engine splits by reason to change rather than by size. Counting, sampling, and rule reading are three reasons to change, and so are a folder contract, a checkpoint, an exclusion set, and a catalog format.

## Decisions

### The audit set

`canon audits run` runs twenty-one verbs together, reads each one's own record, and reports them under a single verdict. It writes no measure of its own, which is what makes it cheap and what separates it from the two harder halves the same request raised.

Reading each shape was chosen over forcing a common envelope. Every record already has consumers naming its keys, and one of them refuses to rename a key for a gain of one word, so an envelope is a breaking change bought for tidiness. The cost is one extractor per verb in `src/audits/catalog.ts`, and an extractor meeting a record it cannot read returns nothing rather than zero, on the ground the context audit already states about `--citations-only`.

They run together rather than in sequence. They walk separate trees and share no state, so the set finished in 0.8 seconds of wall clock against 4.4 seconds of processor, measured at twelve verbs on the authoring machine at `bd2be81a`. That figure is what settles whether `bun run check` can afford the stage, and it sits under every other stage in that script. `canon deps audit` is the first member whose latency is not this machine's, since it reaches an advisory index rather than a tree, so the figure above does not bound the set on its own.

Three consecutive clean runs of `deps` measured 44.7, 77.6, and 62.9 seconds, dwarfing every other stage in `bun run check` combined. `src/deps/audit.ts` gives `execa` an explicit 120-second `timeout` rather than letting a stalled lookup run unbounded to bun's own 299-second ceiling. `--corpus <tracked|per-machine|upstream>` on `audits run` is repeatable and defaults to every corpus, and `auditsFor` in `src/audits/run.ts` reads it, so a bare invocation still reaches all twenty-one verbs including `deps` while a scoped one reaches fewer. `StageResult` and `AuditResult` both carry `ms` now, timed around each stage and each spawn, so a slow run is attributable to a verb rather than hand-timed the way the figure above was.

The `placement` entry runs `canon context classify sweep --backend off`, pinned to the regex layer rather than following the resolved classifier setting. A tally that moves with whichever model a machine runs cannot be compared across clones, and the model layer ran for about 17 minutes over the context and wireframe sections on a 27B local model where the regex layer took 0.14 seconds. The model's reading stays with `document-health`, which reports to a reader rather than into a baseline. The entry tallies `keep`, `rewrite`, and `move` through a record keyed on `SweepVerdict`, so a verdict the classifier adds fails the build here rather than dropping out of the count.

### What the aggregate gates on

Four findings. An unresolved context citation, a banned character, a skill folder carrying no `REQUIREMENT.md`, and a credential-shaped value in the tree this repository publishes are facts. Every other measure it prints is a judgment, and an aggregate exiting non-zero on any finding would erase the recorded split in one line.

Three of the four are the set the merge gate in `src/gate/stages.ts` already fails a push on, and the secret scan is the one gate with no stage behind it. A gate is not widened as a side effect of registering a measure: the addition was decided on the fact-or-judgment test, argued from the architecture record's own ranking of content that leaves the repository, and asserted whole in `src/audits/catalog.test.ts` so a fifth cannot arrive quietly. Read the count in that test as the guard rather than as the policy.

The catalog holds that decision rather than the exit code, because a reporting verb sets `2` on findings it deliberately does not gate on. Reading the code alone would promote every one of them to a gate the first time the aggregate ran.

A fourth kind of failure needed a code of its own. An audit that did not report is a defect in the run rather than in the tree, and folding it into either the clean exit or the findings exit says the wrong thing about which is broken. It takes `3`, the code `canon markdown audit` already uses for a corpus walked with nothing looked for.

Six of the set read gitignored folders, which no fresh clone and no CI run carries, so the first shape reported `incomplete` on every run a contributor did not make on their own machine. A per-machine corpus refusing because its folder is missing therefore takes `absent`, which reports and moves nothing. The advisory check takes the same allowance, since an index it could not reach is the same ordinary absence wearing a network instead of a disk.

The corpus decides the allowance by default, and a spec naming its own reasons overrides it. A per-machine verb refusing for any reason other than a missing folder is a broken verb and stays `unmeasured`, and so does a tracked tree that cannot be found, since that is a broken checkout. Six tracked specs name reasons anyway: the secret scan on a project that publishes nothing, the citation reach check and the skill audit on a project holding no skills tree, the context audit on a project adopting none of the folders it measures, the label audit on a project declaring no coverage map, and the restated sweep on a project holding neither the seed nor a shipped skills tree. Each is the ordinary state of a target installing this CLI rather than a defect in it, so without the override every such project reports `incomplete` forever, which is the permanent signal the whole split exists against. Every run states the measured count against the absent one, since a report naming only what passed is a claim about a set it never read.

`canon gov test-order` marks the edge of what the baseline can compare. It scopes against the trunk, falls back to the root commit, and a depth-1 checkout has neither, so the range is empty and it reports zero rather than refusing. A shallow run therefore under-reports against a floor taken from a full clone and reads as shrinkage, which is the safe direction and the reason that one delta means something only from a clone carrying history.

Every audited verb now writes a parseable record on its refusal path, since a refusal printing nothing reaches the aggregate as unparseable output rather than as a reading it can act on. `canon context audit` and `canon claude skills audit` each take the allowance the reach check already had: a project adopting none of `canon/context/`, `.canon/diagrams/`, and `canon/wireframes/`, or neither `claude/skills/` nor `.claude/skills/`, has adopted no convention either audit measures, so each names its one absence reason rather than reporting `incomplete` on every run a target makes.

`canon markdown audit`, `canon comments scan`, and `canon gov test-order` write a record on every refusal path too, and none claims the allowance. A corpus with no markdown file, a bad `--languages` argument, and a tree carrying no git history at all are each a broken invocation or a broken checkout, so they stay `unmeasured` on the corpus's own default.

`records-standards` is the one tracked record kind that takes the allowance, against the rule that an unread tracked tree is a broken checkout. The exception rests on a fact this record already carries: the install channel that would have written `standards/` into a target's own tree closed, so a project other than this toolkit's own checkout carries no standards folder at all by design. Leaving the corpus label without the exception would have pinned every such project's aggregate at `incomplete` forever, the same signal the split above exists to retire.

### Why the pipeline runs it without gating on it

`bun run check` runs the set after the three gating stages and never fails on it. Those stages keep their own remedies, which are specific in a way one aggregate line cannot be, so a fact still fails the push where a reader is told what to do about it.

The set the gate runs is `tracked` and `per-machine` rather than every corpus. `auditSet` in `src/gate/measures.ts` passes `--corpus tracked --corpus per-machine` to `audits run`, which excludes `deps`, the one `upstream` member, so `summary.audited` in the gate's own record reads 19 rather than 20. A push reads what describes this tree, and a weekly `dependency-advisories` job in `.github/workflows/verify.yml` reads the advisory index instead, on a schedule rather than on every push.

Growth reports and does not gate, on the same ground every measure here rests on. The standards behind the largest counts set no hard cap, and a push failing on a judgment teaches a contributor to route around the stage.

The stage reads a flat `summary` object published beside the nested arrays, so a shell stage greps one scalar rather than parsing the record. Every key in it is unique across the whole document, which is what keeps the match on the top level. Publishing it was chosen over deriving it in bash for the reason the context audit gives about its own join: deriving means restating which question a number answers, and one wrong restatement reports growth against a measure that never moved.

The three verbs the gating stages already ran walk their trees a second time here. That is the 0.8 seconds above, and it buys one verdict over the corpora the gate reads, where a stage measuring only the part those stages skip would report a health nobody took.
