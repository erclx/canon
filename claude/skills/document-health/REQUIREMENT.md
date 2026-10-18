---
name: document-health
description: What the document health check is for, the gap it closes, and why it reports three axes rather than one number
---

# Document health requirement

## Gap

A project learns which documents are missing and never which have rotted. `target-check` asks structural questions, and a document that exists, holds its sections, and matches what shipped can still describe a tree that moved long ago.

Length, placement, and staleness answer to different evidence, and one list hands the reader a judgment wearing a measurement's authority. A verb that refuses on an unfamiliar layout reads as an empty set, so a healthy corpus is reported for documents nothing looked at.

## Must

- Report per document across the length, placement, and staleness axes, marking each finding with its evidence class
- Read length and placement through the verb owning each measurement, and take every checkpoint from the record the verb returns
- Ship the staleness axis as a reading rather than cutting it for lacking a verb
- Report a refusal, an absent key, or a missing subcommand as an unread axis naming the cause, and say which layer answered the classifier sweep
- Run standalone, read the requirements record for identity drift when the scope reaches it, and print the `canon records stale canonical` reminder

## Must not

- Repair a finding, write a file in the project, or open a pull request
- Emit a verdict or score across the axes, or report a finding against a generated, gitignored, or copied file
- Answer an axis by file inspection where a verb answers it, or read a modification time as staleness
- Trigger itself or ask a hook, gate stage, or CI to, and run without `canon` or tracked markdown

## Out of scope

- Whether a document exists or holds its sections, which `target-check` owns
- Banned tokens and structural checkpoints, which `canon markdown audit` owns
- Rewriting a stale claim once named, which the operator or the owning skill owns
- Gating the toolkit's own corpus as one set, which `canon audits run` owns
