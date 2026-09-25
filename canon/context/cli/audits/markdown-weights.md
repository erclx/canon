---
title: Markdown weights
description: The bullet, paragraph, and depth checkpoints, where each number sits and why, and the section markers that break a depth run
---

# Markdown weights

## The paragraph and bullet checkpoints

- The paragraph check closed a gap in the standard rather than working around it. A sentence cap alone is satisfied by writing fewer and longer sentences, and 486 paragraphs across the corpus sit inside four sentences and past 400 characters, so the weight half was added to `standards/markdown.md` and parses as its own checkpoint.
- Borrowing the bullet number was the first shape and it fails twice over: an author reading the sentence cap finds no weight rule to read, and retuning the bullet rule moves a paragraph rule nobody edited. The two numbers diverge, at 400 for a bullet and 700 for a paragraph, because each was read against its own corpus once the shapes were measured apart.
- The sentence cap counts a paragraph whose next sentence opens on a code span. `SENTENCE_END` requires a capital after the terminal punctuation, which a command name never carries, so the backtick sits in the lookahead as its own alternative. The price is a span opening a fragment mid-paragraph reading as a sentence start.

The bullet number stays at 400. Findings sampled at 404, 420, and 458 characters read as three dense but scannable bullets, and the ones at 508 and 598 read as prose wearing a bullet, which is the rule working rather than the number sitting wrong. Moving the line to 500 would cut the open set from 104 findings to 51 and would exempt the band the sample judged worst.

The paragraph weight number moves from 600 to 700. Samples at 604, 633, and 677 characters each read as an ordinary four-sentence paragraph on one topic, which is a finding reading well past its checkpoint and the signal that the number is low. Density arrives around 760 and is plain by 860, so 700 is where the reading stops being comfortable. The move takes the weight half from 146 findings to 78 and leaves the sentence cap untouched, since 96 of its hits sit at 700 characters or under and fire on sentence count alone.

Moving a number in a standard is two edits rather than one. `DEFAULT_CHECKPOINTS` in `src/markdown/structure.ts` holds the value applied when the standard's sentence cannot be parsed, and `structure.test.ts` parses `standards/markdown.md` and asserts the result against that constant, so a number moved in prose alone fails the test and leaves the fallback measuring against the retired figure. The parse is what runs on every ordinary invocation, which is why the mirror is easy to miss and why the test is the thing that catches it.

## Depth and section markers

- The Depth stage names one run per file, the longest, rather than every run past the checkpoint. A section already over it stays unnamed until an edit makes it the file's longest, and the report then reads as a regression that edit introduced. Stashing the file and re-running separates a run a change caused from one it merely lengthened.
- A bold section marker holding its own line breaks a run, alongside the heading break. `standards/plan.md` gives `## Summary` a heading and marks the four sections below it this way, so reading the heading alone reported all seven live plans at line 7 for their whole body, 106 to 166 rendered lines, and a measure firing on a whole corpus says nothing about it. Breaking on the marker clears two outright and moves the other five onto real seams inside their constraint stacks, at 42 to 77 lines. Measured at `48f7d46b` on 2026-08-28.
- The measure absorbed that fix rather than the plan template, which is the trade between a corpus every project reads and one this repository writes. Moving the four markers to headings clears no plan already written, leaving each flagged until someone rewrites it, and it disturbs the `- Suggested:` and `- Answer:` contract keyed off `**Questions:**`.
- The pattern takes the whole line at column zero, so a bold phrase opening a sentence stays emphasis and an indented one stays a label inside its list item. A colon breaks at any width, and `isSectionMarker` gives a colon-less label two further ways through, because one test cannot separate every marker from a sentence set in bold.
- A colon-less label that is one whole code span breaks at any width. The review bodies posted on this repository carry 81 colon-less markers and 30 of them are the bold path heading `review-pr` writes per file, running from 20 to 70 characters, so no ceiling reaches them. No colon-less line in the records tree is a whole span at all, so the rule adds reach and no false break. Measured at `9960a4d7` on 2026-08-28.
- `MARKER_WIDTH` is 20 and covers the rest. Of the remaining 51 markers in those review bodies 50 sit at or under it, and so do 48 of the 94 colon-less lines in the records tree, every one a label. The single miss is a 48-character heading written by hand, left as the cheap error rather than bought back by raising the ceiling. Terminal punctuation separates nothing, since 45 of those 48 end in one.
- The ceiling sits under the 21 to 30 band rather than over it. Those 8 lines cannot be classified on sight, where `One change across four files.` reads as a sentence and `Rule plus a mechanical half` reads as a seam, and the asymmetry decides the tie: a missed break costs one unbroken run, and a false one shortens every run around it until the measure stops reporting.
- Both signals govern the colon-less shape alone, since a colon is its own evidence of a label. Capping the colon form too would take the break back from the four markers between 31 and 50 characters that already have it, every one a genuine section marker.
