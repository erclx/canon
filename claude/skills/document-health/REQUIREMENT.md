---
name: document-health
description: What the document health check is for, the gap it closes, and why it reports three axes rather than one number
---

# Document health requirement

## Gap

Without this skill, a project learns which documents are missing and never learns which have rotted. `target-check` reports per domain what a target holds against what the toolkit ships, and every one of its domains asks a structural question: does the file exist, does it hold the required sections, do the bytes match what shipped. A document that exists, holds every section, and describes a tree that moved six months ago passes every one of them.

The second half of the gap is the axes being read as one thing. Length, placement, and staleness answer to different evidence, and a run that reports them in one undifferentiated list hands the reader a judgment wearing the authority of a measurement. The operator's own complaint was staleness, which is the axis with nothing behind it, so the flattening runs in the direction that overstates the weakest finding.

The third is silence on an unread axis. Both measured verbs resolve their folders by surface root, so a project whose layout differs resolves nothing and the verb refuses. A run reading that refusal as an empty finding set reports a healthy corpus for documents nothing looked at.

## Must

- Report per document across three named axes, so a reader can tell which question a finding answers
- Read length and placement through the verb that already owns each measurement, rather than re-deriving either by hand
- Mark every finding with its evidence class, so a judgment is never read as a measurement
- Ship the staleness axis, and mark it as a reading rather than cutting it for lacking a verb
- Report a refusal, an absent key, and a missing subcommand as an unread axis, naming the cause
- Say which layer answered the classifier sweep, since its model layer being off narrows the read without refusing it
- Take every checkpoint from the record the verb returns rather than from a number written into the skill
- Run standalone, and stay callable from the structural check rather than reachable only through it

## Must not

- Repair a finding, write a file in the project, or open a pull request. A check that repaired as it read leaves the reader unable to tell a finding from a fix.
- Emit a verdict across the three axes, or a score across the documents. Two axes answer from verbs and one answers from a reading, so any roll-up is a figure that lies about the third.
- Report a finding against a file nobody hand-authors. A generated index, a gitignored file, and a copied reference each name a file an author cannot fix.
- Answer an axis by file inspection where a verb answers it. The verb is the surface under test and a hand-rolled read of the same files is not.
- Read a document's modification time as its staleness. A file untouched beside code untouched is current, and the timestamp answers a different question.

## Guards

- `canon` absent from the path: stop, since neither measured axis can be read
- No tracked markdown under the working root: stop, since there is no corpus to read

## Out of scope

- Whether a document exists or holds its required sections, which is the structural question `target-check` answers across six domains
- Conformance of changed markdown to the authoring standards declaring jurisdiction over its paths, which is `standards-audit`. That skill is diff-scoped and standard-declared, taking a changed file and reporting which stated rule it breaks with a line number. This one is corpus-scoped and reads rot in documents nobody changed, which is the case a diff-scoped audit never reaches. The two sit beside each other rather than one absorbing the other.
- Rewriting a stale claim once this run has named it, which is `markdown-propose`
- Running the toolkit's own checks as one gating set over its own corpus, which is `canon audits run`. That set gates a push and this reports to a reader.
- Repairing anything an axis names. Each routes to the command or skill that owns it.
