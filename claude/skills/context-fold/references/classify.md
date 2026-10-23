---
title: Classify the fold's diff baseline
description: The classify diff invocation, the record fields to read, applying a finding, the one-line keep reason, the unreachable and missing-subcommand lines, and the report shape
---

# Classify the fold's diff baseline

Mechanics for the classify half of Step 4 of `context-fold`. The body owns the skip condition and the shared baseline, and this file owns the invocation, what the record carries, and what applying a finding does.

## Invocation

Call the verb rather than reimplementing its pattern or prompt in this skill:

```bash
canon context classify diff --base <base> --json
```

Never substitute a different verb for it, such as `canon docs <name>` (a documentation lookup, not a classification).

Reuse the base the Diff baseline section already resolved for Steps 2 and 5 rather than resolving a second time. Never pick or configure a backend here. The project setting decides it, and this step reports `modelLayer` as the record returns it.

## Reading the record

Branch on the record's `decision` field, never on the exit code, which a shell function wrapping `canon` can flatten to zero.

- `decision: 'refused'`: a bad range or a file the verb could not read. Report the record's `message` and continue. See "When the verb is absent or refused" below.
- `decision: 'ok'`: the record carries `modelLayer` (`'off'`, `'ran'`, `'skipped-no-model'`, or `'skipped-unreachable'`) and `findings`.

Each finding carries `file`, a `verdict` of `KEEP`, `REPLACE`, `HISTORY`, or `MOVE`, and `decidedBy` (`'regex'` or `'model'`) naming which layer's reading won. Take the `quote` and `reason` from whichever of the finding's `regex` or `model` fields `decidedBy` names. Skip every `KEEP` finding: nothing decided against that text.

## Scope

Answer every non-`KEEP` finding the verb returns, not only the files Step 3 wrote this run, since a branch carrying a prior session's commits has doc edits the fold is equally responsible for.

The verb's own extraction already scopes to canonical doc types and reports nothing when the range carries none, so there is no narrower check to add here.

## Applying a finding

Locate the finding by its `quote` in the file's current content. The quote is often a narrow fragment rather than the whole clause it sits in, since the regex layer's own match is a short pattern hit, so the edit below targets the sentence or bullet the quote sits in rather than the literal substring alone.

- **Found exactly once.** Apply the verdict under its heading below.
- **Found more than once, or not found at all.** Report it as not located rather than guessing an occurrence or silently rewriting nothing. A model paraphrasing its quote is the usual cause.

Run the classifier once per fold. Do not re-run it after applying a finding to check the edit, since a second pass over what this step wrote is the loop the verb's own reference already warns against.

### REPLACE

Rewrite the sentence or bullet carrying the quote in place with the fact that now stands, per Step 3's rewrite-in-place rule. State what is current and drop what the quote restated, in the one edit.

### HISTORY

Rewrite the sentence or bullet carrying the quote to drop the narration and keep any current fact the same clause states. The quote narrates how the fact arrived rather than stating the fact, which a canonical doc excludes regardless of what wrote it.

A literal cut of the fragment alone would leave the rest of the clause grammatically stranded.

### MOVE

Do not cut. The verdict means correct content sits on the wrong surface, such as a rule written into a context entry that belongs in a path-scoped rule, and only the model layer returns it.

Report the finding instead, naming the surface the `reason` names as where the content belongs, and leave the file unedited. Cutting would delete content a fold with no model configured would never have flagged at all.

## Keeping a finding

Keep a non-`KEEP` finding without applying it only when the quote is itself the alternative a nearby decision states and lost, or the file already carries the current fact elsewhere. State the reason in one line in the report. A keep costs one line, where an incorrect apply costs a rewrite of prose nobody asked to change.

## When the verb is absent or refused

The verb ships with the CLI and this skill ships with the plugin, so a target holding an older installed binary carries no `context classify` subcommand. Never read a missing subcommand as a clean pass, which would report a run that never checked anything as one that found nothing.

| Case               | Report, then continue                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| Subcommand missing | `⚠ Classify: canon context classify not available on the installed binary. Skipped.` |
| Range refused      | `⚠ Classify: <message>`, naming the verb's own message                               |

Neither case stops the fold. This step checks what the fold wrote, and a check that cannot run is not a reason to leave the fold's own output unshipped.

## Report

Print one line naming what ran, `✅ Classify: <n> findings, regex ran, model <modelLayer>`, then one line per non-`KEEP` finding:

- `✏ Rewrote: <file>, "<quote>" (<reason>)`
- `✂ Cut: <file>, "<quote>" (<reason>)`
- `➡ Move needed: <file>, "<quote>" (<reason>)`, for a `MOVE` this step reported rather than cut
- `⏭ Kept: <file>, "<quote>", <reason for keeping>`
- `⚠ Not located: <file>, "<quote>" not found or found more than once`

When every finding reads `KEEP`, output `✅ Classify: <n> findings, all KEEP` and nothing further.
