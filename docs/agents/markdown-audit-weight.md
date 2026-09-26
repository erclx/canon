---
title: Markdown audit weight
description: The structural half of the markdown audit, being bullet and paragraph weight, run depth, the two cadence numbers, and the length ceiling, with the samples behind each checkpoint and why none of them gates
---

# Markdown audit weight

## Bullets, paragraphs, and depth

Bullet weight and depth are the checks that moved off `canon context audit`, carrying what they measured at the time. A top-level bullet reports past roughly 400 characters with continuation lines folded in and nested items left out. A run reports past roughly 40 rendered lines, measured at 80 columns, where a heading breaks one and so does a bold section marker taking the whole line at column zero, either ending in a colon, or holding one whole code span at any width, or running to 20 characters or fewer, skipping fenced blocks and exempting a flat peer list averaging under 130 characters a bullet and a run that is entirely table rows. Each file reports its longest run alone, so a second run past the checkpoint in the same file is never named.

Every weight and depth measure counts the text a reader is shown. A link reduces to its anchor text and an autolink drops whole, since no reader is shown either destination. A backticked path stays counted, which is where these measures part from the ban scan `markdown-audit.md` describes: that one blanks a code span so a standard quoting its own banned character does not report itself, and discounting the same span here would under-report a paragraph carrying several. One file holds both span sets and each answers its own question.

A code span is walked around rather than through, so a path quoting link or angle-bracket syntax keeps the width the page gives it. Masking inside one takes back the decision to count it, and the placeholders this toolkit writes are where that shows.

The paragraph check measures both halves of one rule. `markdown.md` caps a paragraph at four sentences, and a sentence cap on its own is satisfied by writing fewer and longer ones: 15 paragraphs in this corpus sit inside four sentences and past the weight checkpoint, and the heaviest of those runs 886 characters. The standard therefore states a weight beside the sentence cap, and the verb reads it as its own checkpoint.

A sentence boundary closes on terminal punctuation ahead of a capital or a code span. The capital is what keeps a version pin and a decimal from each reading as two sentences, and the code span is admitted beside it because a command name opening a sentence carries no capital to find.

The paragraph weight sits at 700 and the bullet weight at 400. Both shipped at 400, because the paragraph number was borrowed from the bullet rule when the two checks landed together, and each has since been read against a sample of its own. They are separate checkpoints in the standard and separate patterns in the parser, so a read that moves one leaves the other where it is.

### The sample behind the paragraph number

The checkpoint shipped at 400 as a borrowed number and was decided against a read of the prose it reports. Thirty-six findings were sampled, six from each of six weight bands, drawn at even spacing through each band ordered by path and line, and each was classed as prose a reader wants split or prose the checkpoint should not have reported.

Every band below was measured before the scan stopped counting link syntax as prose, so a paragraph sitting in one of these bands is heavier than a paragraph reported at the same number today. The re-sample in the section below re-reads the same range against the corrected measure and reaches the opposite verdict on it, which is the measure moving rather than the reader.

| Band      | Wants the split | Reads as written |
| --------- | --------------- | ---------------- |
| 400 - 425 | 1               | 5                |
| 425 - 450 | 2               | 4                |
| 450 - 500 | 2               | 4                |
| 500 - 600 | 2               | 4                |
| 600 - 750 | 6               | 0                |
| Past 750  | 6               | 0                |

Precision is what moved the number rather than the finding count. Below 600 the checkpoint was right about seven of twenty-four sampled paragraphs, and past 600 it was right about all twelve. A checkpoint is a prompt to look, and a prompt wrong three times in four teaches a reader to stop looking. The distribution offers no seam to place the number against, with a median of 487 and a seventy-fifth percentile of 563, so the read is the whole of the evidence.

Nothing inside the 500 to 600 band separated the two classes by length, which is the reason the number did not land there. The two paragraphs wanting a split ran 543 and 590 characters against four reading well at 515, 532, 555, and 569.

The sample is thirty-six paragraphs against a reported population in the hundreds, and one reader classed all of them. Treat a band's rate as the order of magnitude it is rather than as a measured precision, and re-sample before moving the number again.

### The re-sample that moved the number to 700

That re-sample ran once the scan stopped counting link syntax as prose. Findings at 604, 633, and 677 characters each read as an ordinary four-sentence paragraph on one topic, density arrived around 760 and was plain by 860, and the move cut the weight half of the report roughly in half while leaving the sentence cap untouched.

A bullet, a heading, a table row, a blockquote, a blank line, and a fence each end a paragraph, so a heavy bullet is reported by the bullet check alone and never counted twice.

## Cadence

Uniform cadence is the failure a ban list cannot express. A ban set states negatives, and fragments, verbless clauses, and sentences that all run one length are each the absence of something, so no word added to a ban list reaches any of them. The shape layer already measured a bullet, a paragraph, and a run, and stopped one level above where that failure lives.

Cadence measures a paragraph on two numbers. The spread is the words between its longest and shortest sentence, and the opener count is the times one word opens a sentence in it. A spread of five words or under reads as one cadence, and a word opening more than two sentences is a pattern rather than a coincidence. Both come from `## Rhythm` in the `write-human` skill, which states them about prose a person reads, and this measures against that statement rather than setting a threshold of its own.

Words are counted off the text a reader is shown. A link contributes its anchor text, an autolink contributes nothing, and the sentence boundaries do not move under that masking, since the boundary pattern requires whitespace after the terminal punctuation and no destination carries any. An opening word is lowercased and stripped of punctuation, so a sentence opening on a backticked command name reports the command.

A paragraph carrying fewer than three sentences is skipped rather than scored. A two-sentence configuration note has no spread worth reading, and the opener rule is written about a third sentence turning a coincidence into a pattern, so neither number says anything before the floor. That is the cheap form of a wider exemption: a shape-aware one, exempting a short reference block by what it is rather than by how many sentences it holds, waits on a second case.

The unit is the paragraph and each file names its worst on each measure, which follows the depth check rather than setting a precedent. A file's flattest paragraph and its most repetitive one are named only when each crosses its checkpoint, so a file reading healthy names nothing rather than offering its least healthy paragraph as a finding.

Neither number gates and neither names a file wrong. This is a weaker claim than the one the weight checkpoints make, because a healthy range differs by surface: a catalog entry is several short sentences carrying one fact each, and a page arguing a decision is not, so one range applied across the corpus would report the surfaces that are correct. The run therefore states where the numbers came from beside them, and the counts are what a reader compares against.

A reading of that spread across the whole corpus is what backs the range above, taken once against this repository's own tracked markdown rather than against a target project's.

That reading travels with the command rather than staying here. `BASELINE` in `src/markdown/structure.ts` carries the overall share, the per-file range, and the ten-paragraph floor beneath which a file's own rate says nothing, and the run prints all four in the legend beside the rate it measured. A count with no range beside it reads as a finding, and naming that a healthy range differs by surface states that a range exists rather than what it looks like. This page is toolkit-internal, so a reader running the command in a project that installed no standards would otherwise have two counts and nothing to place them against.

Two of the rules `write-human` states are deliberately not implemented. A sentence's grammatical shape and whether it carries a finite verb each need a parse rather than a match, and an imperative would read as a defect under a pattern that approximated either. The verbless share is the measure closest to the reported symptom, which is exactly why shipping it wrong would discredit the two that hold.

The condition on that was something identifying a finite verb rather than guessing at one, and two parsers have now been run against it over 11,389 paragraph sentences. They disagree by a factor of four. `compromise` reports 2 percent and reads a fronted past participle as a finite verb, so `Measured at <sha> on <date>.` counts as carrying one. `wink-pos-tagger` reports 9 percent, fixes that class, and is still wrong on roughly three in four, because an imperative's verb tags as a proper noun and a noun-ambiguous predicate tags as a noun, which makes `Each maps to a skill.` read verbless. Separating those needs to know which token is the predicate, and that is syntax rather than a tag. The measure stays unimplemented, now against a mechanism rather than against the idea of one.

## Length

The Length step sums rendered lines over the whole source, frontmatter and fenced blocks included, and lists each document past the 300-line ceiling, longest first. A changelog and a document carrying a whole-line `<!-- canon-length-exempt: <reason> -->` outside a fence are counted in one line rather than listed. Each `--json` entry carries `renderedLines` and `exempt`, the stated reason or `null`, and `checkpoints` carries `ceiling`.
