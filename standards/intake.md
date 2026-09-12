---
title: Intake reference
description: Folder layout, ordinal naming, reserved index number, frontmatter and dating, the item template, the answer contract, and retrieval
---

# Intake reference

Applies to an intake folder at `.canon/intake/<nn>-<slug>/`. One folder holds one dump, filed by domain, and every finding in it is an item carrying a measured problem, one proposed fix, and a verdict.

The folder is gitignored, and backed wherever a records remote is configured: `canon records push` and `canon records pull` protect it against the machine being lost there, refuse with `no-remote` where it is not, and neither protects against a compaction dropping a session's reasoning before anyone has pushed. No check reaches its contents, so the shape below survives only by being read.

## Scope

Governs an intake folder under `.canon/intake/<nn>-<slug>/`: folder layout, ordinal naming, the reserved index number, frontmatter and dating, the item format, the answer contract, and retrieval.

Does not govern:

- One question measured in depth before anyone can plan against it: `groundwork.md`
- The feature plan a promoted item feeds, and the inverted answer contract it keeps: `plan.md`
- The task file promoting an item onto the board, and the origin line pointing back at the folder: `tasks.md`
- Voice, rhythm, and sentence construction: the `write-human` skill
- Headings, punctuation, word choice, and file references: `markdown.md`
- Which findings belong in a dump at all, and the procedure that files one, which belong to the surface driving it

## Folder name

- Name the folder `<nn>-<slug>`, a two-digit zero-padded ordinal followed by a kebab-case slug. This is the folder's own ordinal, distinct from the `NN-<domain>.md` numbering a cluster file carries inside it.
- Claim the ordinal through `canon records ordinal intake <slug> --claim`, which reads the highest one already present across both `.canon/intake/` and `.canon/groundwork/` and creates the folder in the same atomic act, closing the race a read-then-create sequence leaves open between two sessions opening at once. A listing then sorts by when each folder opened rather than alphabetically, and the count includes both kinds because the two share one creation-order line.
- With neither folder holding an entry, the first one opened takes `01`. Do not read this off the numbering inside a dump, which starts at `00` and disagrees with groundwork's own first required file.
- Never renumber an existing folder. The ordinal is the order it opened, and a later reader cites it by that name.

## What a working intake looks like

An intake works when a reader returning weeks later can act on it from the folder alone:

- Which items are ready to promote, and what does shipping each one cost?
- What measurement stands behind each problem line, and against which commit was it taken?
- Which items has the operator answered, and which has nobody reached?
- Which live board task does an item already overlap?

An intake failing these is non-conforming even when it satisfies every shape rule below.

## Files

| File                 | Holds                                                       | Required |
| -------------------- | ----------------------------------------------------------- | -------- |
| `00-overview.md`     | Index: cluster table, verdicts, open questions              | Always   |
| `NN-<domain>.md`     | One cluster of items, filed by the domain their fixes touch | Always   |
| `99-next-session.md` | What a compaction destroys that no cluster file carries     | Optional |

`00` is the only reserved number. Everything else is read order, and the domain rides in the filename so a reader knows what `07-tooling.md` holds without opening it.

Do not reserve mid-range numbers. Clusters differ per dump, so a contract over `06` would force every future intake into one dump's shape. A folder whose shape is fixed can reserve its numbers, and that half of the convention does not transfer.

Let the file count follow the number of separable domains. A large dump with two domains is a small folder.

## Frontmatter and dating

Every file carries `title` and `description`. `00-overview.md` carries one field the others do not.

- `title` (required): the dump subject in sentence case
- `description` (required): one line naming what the dump covers
- `date` (required, `00-overview.md` only): the day the folder opened, as `YYYY-MM-DD`

Carry the opening date as a frontmatter field rather than a sentence in the body. A date written into prose is readable by a person and by nothing that walks the folder, and the two spellings drift once both are permitted.

Date the folder once rather than every file. Twelve dated files leave eleven stale the first time one cluster is edited, and the opening date never rots. The checkable half is the commit, which the overview body names as what the claims were measured against.

## 00-overview.md

The index. It points at items and answers nothing itself.

- The answer contract stated out loud, since it inverts the plan file's
- A cluster table of file, what it holds, item count, and open count
- The verdict counts across the folder
- A ready list, grouped by what shipping one actually costs
- The open questions, each a labeled markdown link to its owning item's heading anchor

The index carries no answer slot. One question in two answerable places has no rule for which wins, and retrieval walks item headings, so an answer typed into the index is found by nothing and lost silently.

Where an item touches a task already on the board, say so in the index rather than only inside the item. A reader deciding what to promote reads the index first.

## Item format

```markdown
### N. Short title stating the defect

- **Problem:** what is wrong today, stated against the tree and carrying a number or a file path
- **Fix:** the one change proposed
- **Worth it:** yes, later, or no, with the reason
- **Open:** only where the call is the operator's
- **Suggested:** the pick in one sentence, then the reason and the main tradeoff in one or two
- **Overlaps:** the live board task that already owns this item
- **You:**
```

- `Problem:`, `Fix:`, `Worth it:`, and the empty `You:` slot ship on every item. The other two are conditional.
- Number items per cluster file, and give a finding split after the fact a letter suffix on the number it came from, as in `3a` beside `3`. Renumbering the items below it instead moves every label a reader or an answer already cited.
- `Suggested:` is required whenever `Open:` is present. A bare question invites a bare answer, and `ok` against two defensible options carries no information. Where the answer is the operator's preference rather than a technical call, say so in that form rather than inventing a default.
- `Overlaps:` never replaces `Worth it:`. The items where a live board task might be the thing that is wrong are exactly the ones whose verdict matters most.

Two heading levels is the right depth inside a cluster file. A third means the cluster should have been its own file.

An item may carry a bolded standalone line between the bullets where a finding needs a name of its own. Keep it rare. Everything fitting the four bullets belongs in them.

## The answer contract

`You:` belongs to the operator and ships empty on every item.

Empty means unread. It never means agreement. Accepting a verdict is typed as one token, `- **You:** ok`.

That inverts the plan file's contract, where a blank answer slot means accept the suggestion, and the inversion is deliberate. A plan is read in one sitting with every question already surfaced in conversation. An intake folder is read over weeks, so an empty slot is ambiguous between accepting the verdict and never having reached the item, and the second reading is far more likely. Acting on silence as consent ships a change nobody approved.

Never fill a `You:` slot, and never infer a disposition from an empty one. On a resume pass, report unread items by count rather than deciding them.

A slot is filled two ways. The operator types into the cluster file, or answers in chat and a verb lands the selection on the item. Both put the answer on the item, which is what keeps retrieval working, and neither lets a session decide one. An answer given in conversation and never written back leaves the item unread, since the file rather than the conversation is the record.

An item already carrying an answer is refused rather than overwritten, whichever route the second answer arrives by. A filled slot is a decision already made, and revising one is the operator editing their own line.

## Retrieval

Answers live on items, so one pass over the folder reports every touched slot.

A session with the toolkit CLI on PATH reads the folder through `canon intake list`, which reports per-folder counts bare and one folder's items with `--json`, and takes `--unread` to keep only the empty slots. It is the surface under test, and it skips the index and every fenced sample, which the greps below cannot do.

The greps stay for a reader without the CLI, and they overcount by whatever the folder displays in a fence.

```bash
awk '/^### /{h=FILENAME": "$0} /^- \*\*You:\*\*./{print h; print "   "$0}' *.md
```

Counting what is still unread runs against the empty slot instead.

```bash
grep -c '^- \*\*You:\*\*$' *.md
```

Both walk `###` headings, which is the mechanical reason an answer typed anywhere else is lost.

## Conventions

- State a number with what it settles. The strongest items are the ones where a measurement decides the verdict and says so.
- File an item under the domain its fix touches, not the domain the complaint arrived from.
- Name a live board task an item overlaps, and keep the verdict beside it.
- Revise a verdict the tree has moved under rather than appending a second one narrating the change.
- Report unread items by count on a resume pass. Never decide one.

## Anti-patterns

- **Silence read as consent.** An empty slot on a folder read over weeks means nobody reached the item, and treating it as acceptance ships a change nobody approved.
- **A verdict with nothing behind it.** An item whose problem line carries no number is an opinion, and it reads exactly like the ones that were measured.
- **The overlap that ate the verdict.** Replacing `Worth it:` with `Overlaps:` drops the call on the items most likely to change what a live task should do.
- **A question in two places.** An open question answerable in the index and on the item resolves to whichever a reader happens to open.
- **The dump filed as one concern.** Forty findings under one heading is a folder nobody can promote from, and the split by domain is what makes each item liftable on its own.
- **The date left in the body.** A frontmatter field and a sentence both claiming the opening date resolve to whichever a reader happens to hit, and only one of them is readable by a walker.

## Template

```markdown
---
title: <Dump subject>
description: <one line naming what the dump covers>
date: <YYYY-MM-DD>
---

# <Dump subject>

<One line on what the dump covers and the commit it was measured against.>

## The answer contract

`You:` ships empty and empty means unread. Accepting a verdict is typed as
`- **You:** ok`. Nothing here is decided by silence.

## Clusters

| File             | Holds           | Items | Open |
| ---------------- | --------------- | ----- | ---- |
| `NN-<domain>.md` | <what it holds> | <n>   | <n>  |

## Verdicts

<counts across the folder>

## Ready

- <item, grouped by what shipping it costs>

## Open questions

1. [<question>](NN-<domain>.md#n-short-title-stating-the-defect)
```
