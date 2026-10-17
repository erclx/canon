---
title: Markdown weights
description: The six density limits and their gate, where each checkpoint number sits and why, and the section markers that break a depth run
---

# Markdown weights

## Decisions

### Density gates on a fact

Six layout limits gate through `canon markdown audit`, each a count against a fixed number, so a finding is a fact.

| Limit      | Number                 |
| ---------- | ---------------------- |
| Paragraph  | 350 characters         |
| Paragraphs | 2 in a row             |
| Bullet     | 200 characters         |
| Bullets    | 5 plain in a row       |
| Heading    | No H4                  |
| H3 opening | A paragraph or a table |

Groundwork `154` overturned the report-only verdict, since the soft findings are why the corpus drifted.

### The scope list answers the old objection

A plan or a groundwork record takes no density finding at all, so the audit can gate without failing a record kept out of version control. The list lives in `src/markdown/scope.ts`.

`GATED_PATHS` turns each folder on as its rewrite batch reaches zero. Outside a canon checkout nothing gates, since the list describes this repository alone.

### A ratchet was rejected

Failing only touched lines leaves the existing failing files as the example the next session copies. The `bullet-stacks` and `paragraph-growth` stages retired into the `markdown` stage, which reads the one exit.

### Bullet runs gate everywhere they gated before

The bullet-run limit gates in context, docs, and skills before `GATED_PATHS` lists them, since the retired `bullet-stacks` stage already failed the push there. The measure lives in `src/markdown/stacks.ts`.

The seeds, the stack references, the wiki, and the root guides wait for their batch. Seven runs in the stack references would fail the push on landing.

### Why the cap is 5

A reader stops holding items one at a time at 5. The alternatives all lost.

- A cap of 8 left the worst of the corpus alone and still failed the common five-to-eight stack that reads as one list
- A ratchet failing only a branch that adds to the stack count needed a stored baseline per file and let the existing 36-bullet runs stand
- Report-only left nothing holding the shape once the sweep reshaped it

### Exempt runs

Two shapes are exempt without a marker, being a run whose every item opens with a bold label or a link, and numbered items. No escape marker exists, since a marker is how the ceiling's exemptions accumulated.

### Why a paragraph carries a weight number

A sentence cap alone is satisfied by writing fewer and longer sentences. 486 paragraphs across the corpus sat inside four sentences and past 400 characters, so the weight half lives in `claude/skills/markdown-craft/references/markdown.md` and in `CHECKPOINTS` as its own checkpoint.

Borrowing the bullet number fails twice. An author reading the sentence cap finds no weight rule, and retuning the bullet rule moves a paragraph rule nobody edited.

### The two numbers differ

The numbers are 200 for a bullet and 350 for a paragraph, because each was read against its own sample. Groundwork `154` set both after the operator read rewrites at each length.

### The sentence cap and code spans

The cap counts a paragraph whose next sentence opens on a code span. `SENTENCE_END` requires a capital after terminal punctuation, which a command name never carries, so the backtick sits in the lookahead as its own alternative.

The price is a span opening a fragment mid-paragraph reading as a sentence start.

### Moving a number is two edits

`CHECKPOINTS` in `src/markdown/structure.ts` is the definition the audit measures against, and `claude/skills/markdown-craft/references/markdown.md` states the same number for a reader. Nothing compares the two, so a number moved in one place drifts silently, and `structure.test.ts` asserts the code values alone.

### Depth names one run per file

The Depth stage names the longest run, not every run past the checkpoint. A section already over it stays unnamed until an edit makes it the file's longest, and the report then reads as a regression that edit introduced.

Stashing the file and re-running separates a run a change caused from one it merely lengthened.

### Bold markers break a run

A bold section marker holding its own line breaks a run, beside the heading break. `claude/skills/plan-feature/references/plan.md` gives `## Summary` a heading and marks the four sections below it this way.

Reading the heading alone reported all seven live plans at line 7 for their whole body, 106 to 166 rendered lines. Breaking on the marker clears two outright and moves the other five onto real seams at 42 to 77 lines. Measured at `48f7d46b` on 2026-08-28.

### The measure absorbed the fix

The trade is between a corpus every project reads and one this repository writes. Moving the four markers to headings clears no plan already written and disturbs the `- Suggested:` and `- Answer:` contract keyed off `**Questions:**`.

### What a marker is

The pattern takes the whole line at column zero, so a bold phrase opening a sentence stays emphasis and an indented one stays a label inside its list item.

A colon breaks at any width. `isSectionMarker` gives a colon-less label two further ways through, since one test cannot separate every marker from a sentence set in bold.

### A whole code span breaks at any width

The review bodies posted on this repository carry 81 colon-less markers, and 30 are the bold path heading `review-pr` writes per file, 20 to 70 characters. No ceiling reaches them.

No colon-less line in the records tree is a whole span, so the rule adds reach and no false break. Measured at `9960a4d7` on 2026-08-28.

### `MARKER_WIDTH` is 20

The width covers the rest. Of the remaining 51 markers in those review bodies 50 sit at or under it, and so do 48 of the 94 colon-less lines in the records tree, every one a label.

- The single miss is a 48-character hand-written heading, left as the cheap error
- Terminal punctuation separates nothing, since 45 of those 48 end in one

### The ceiling sits under the 21 to 30 band

Those 8 lines cannot be classified on sight. `One change across four files.` reads as a sentence and `Rule plus a mechanical half` reads as a seam.

The asymmetry decides the tie. A missed break costs one unbroken run, and a false one shortens every run around it until the measure stops reporting.

### Both signals govern the colon-less shape

A colon is its own evidence of a label. Capping the colon form too would take the break back from the four markers between 31 and 50 characters that already have it, each a genuine section marker.
