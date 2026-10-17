---
title: Markdown cadence
description: The sentence-spread and opener measures read off the write-human rhythm rules, why the verbless share is not measured, and the shipped reading baseline
---

# Markdown cadence

## Decisions

### Why no ban list reaches it

The reported defect was fragments, verbless clauses, uniform sentence length, and no rhythm. Each symptom is the absence of something, and a ban list expresses negatives only.

The arithmetic rules out the obvious fix. Thirteen words sit against a vocabulary of thousands, each addition buys a false-positive class, and `just`, `allows`, and `very` carry honest uses no literal match separates.

### It reports like the weights

Bullet, paragraph, and depth weight report without gating because they are judgments a reader settles, and a distribution belongs on the reporting side by the same test. The measure sits one level below where the shape layer stopped, at the sentences inside a paragraph.

### The numbers come from the skill

Both numbers are read off the `## Rhythm` section of the `write-human` skill. The skill states what good rhythm is and this measures against the statement, so building the measure first would have set thresholds with nothing behind them.

- A spread of five words or under is one cadence
- A word opening more than two sentences is a pattern

### Two rules stay unimplemented

A sentence's grammatical shape and whether it carries a finite verb each need a parse rather than a match. A regex approximating either reads an imperative as a defect.

The verbless share is closest to the reported symptom, which argues against shipping it. A wrong number on the exact failure named would discredit the two that hold.

### The deferral named its release condition

The condition was something that identifies a finite verb rather than guessing at one. Two parsers were measured against it over 11,389 paragraph sentences across 503 markdown files.

| Parser            | Verbless share | Failure                                                      |
| ----------------- | -------------- | ------------------------------------------------------------ |
| `compromise`      | 2 percent      | Tags a fronted past participle as finite                     |
| `wink-pos-tagger` | 9 percent      | Wrong on roughly three of every four it flags, in two shapes |

A factor of four on one number means one of them is wrong.

### `compromise` splits on the preposition

All twelve fronted-participle sentences in the architecture record read as carrying a verb, eleven opening `Measured at` and one `Overturned by`. `Measured at` tags a verb where `Measured against` tags an adjective.

### `wink-pos-tagger` errs in two untunable shapes

Hand-classifying every 21st of its 1,071 flagged sentences put 12 of 51 genuinely verbless. The other 39 split almost evenly.

- Nineteen were imperatives, whose verb tags as a proper noun as often as a verb
- Twenty were declaratives whose noun-ambiguous predicate tags as a noun, so `Each maps to a skill.` and `Nothing checks either one.` both report verbless
- This corpus runs on those words, being reports, answers, checks, maps, holds, names, carries, records, and measures

### No tagger knows the predicate

Telling the cases apart means knowing which token is the predicate, which is syntax rather than a tag. Neither tagger carries one, and nothing was worth taking for a number nothing gates on.

Three of the four shapes that would inflate the count never reach the measure, since `paragraphBlocks` ends a paragraph on a heading, a list item, and a table row. The imperative inside paragraph prose is the one neither parser separated. The full record sits on `measureCadence` in `src/markdown/structure.ts`.

### The floor is a cheap exemption

A paragraph under three sentences is skipped. That answers a two-sentence configuration note that scored a spread of 2 on the writing-rules arm, where a rule written for prose bit on a shape it should not govern.

A shape-aware exemption, reading what a block is rather than its sentence count, waits on a second case.

### Neither number gates

The claim is weaker than the one the weight checkpoints make. Those apply one judgment to one corpus, while a healthy cadence range moves with the surface. A catalog entry is several short sentences carrying one fact each and a page arguing a decision is not, so one range would report surfaces that are correct.

The run states where the numbers came from beside them, so a reader can read a flat number as correct for their surface.

### The unit is the paragraph

The file names its worst paragraph on each measure, following the depth check. A worst is named only when it crosses its checkpoint, since a healthy file offering its least healthy paragraph reads as a finding whatever the step is called.

### `splitSentences` owns the boundaries

`splitSentences` replaced the match count `countSentences` held, and the count derives from it so the two cannot disagree. It drops a trailing span no punctuation closes, which is a fragment to both measures.

`paragraphBlocks` came out of `heavyParagraphs` for the same reason, since two walks deciding what a paragraph is would drift.

### Visible text moves counts, never boundaries

Cadence counts visible text where `heavyParagraphs` counts sentences off the raw line. The boundary pattern requires whitespace after terminal punctuation and neither a link destination nor an autolink carries any, so masking moves word counts and never boundaries.

### The shipped reading

Measured at `6c273324`, 2119 paragraphs reached the floor, 165 sat at or under the spread checkpoint, and 50 sat past the opener checkpoint. Across the 60 files with at least ten measured paragraphs the flat rate runs zero to 21 percent against a median near 6, which is the spread that makes the number worth printing.

### `BASELINE` sits in the legend

`BASELINE` carries that reading into the legend and sits apart from `CHECKPOINTS`, since nothing measures against it and no exit code reads it. This entry is toolkit-internal, so a reader running the command elsewhere would otherwise get two counts and no range.

The run prints its own rate beside the shipped one, which makes twelve flat paragraphs out of forty read differently from two.

### Discrimination was checked on real files

Holding the surface fixed makes the comparison mean something. A catalog page reported 19 percent, its flattest paragraph five sentences within four words of each other and three verbless. A narrative page reported none.

`canon/context/cli/audits/markdown-triage.md` already records the catalog shape as an entry, so the finding is the surface caveat firing rather than a defect caught.

### The README reads worse than the corpus

The README is the one recorded healthy sample that reads worse, and reading a rate off it is the error. It carries seven measured paragraphs against a corpus median drawn from files with ten or more.

Its flattest is a three-sentence development preamble at 9, 10, and 11 words, where the measure is right. A per-file rate needs a denominator before it means anything, wherever this record is used to judge one file.
