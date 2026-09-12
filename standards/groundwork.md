---
title: Groundwork reference
description: Folder layout, ordinal naming, reserved numbering, frontmatter and dating, required file contents, and conventions for a measurement track
---

# Groundwork reference

Applies to a groundwork track at `.canon/groundwork/<nn>-<slug>/`. A track measures one question that has to be settled before anyone can plan against it. The numbering inside the folder is the table of contents, so a reader opens the folder and knows where to start and what follows without an index maintained inside each file.

The folder is gitignored, and backed wherever a records remote is configured: `canon records push` and `canon records pull` protect it against the machine being lost there, refusing with `no-remote` where no remote is set, and neither protects against a compaction dropping a session's reasoning before anyone has pushed. No check reaches its contents, so every rule here holds only while a session reads it, and the handoff file has to be self-contained.

## Scope

Governs a groundwork track under `.canon/groundwork/<nn>-<slug>/`: folder layout, ordinal naming, reserved numbering, frontmatter and dating, what each required file holds, and the conventions a track keeps.

Does not govern:

- A dump of many findings filed by domain, each carrying its own verdict: `intake.md`
- The feature plan a closed track feeds, and the contract its answer slots keep: `plan.md`
- The task file a closing track writes, and the origin line pointing back at the folder: `tasks.md`
- Voice, rhythm, and sentence construction: the `write-human` skill
- Headings, punctuation, word choice, and file references: `markdown.md`
- When a project opens a track at all, and the procedure that runs one, which belong to the surface driving it

## Folder name

- Name the folder `<nn>-<slug>`, a two-digit zero-padded ordinal followed by a kebab-case slug.
- Take the ordinal from the highest one already present across both `.canon/groundwork/` and `.canon/intake/`, incremented. A listing then sorts by when each folder opened rather than alphabetically, and the count includes both kinds because the two share one creation-order line.
- With neither folder holding an entry, the first one opened takes `01`. Do not read this off the numbering inside a track, which starts at `00` on a large one and disagrees with intake's own first file.
- Never renumber an existing folder. The ordinal is the order it opened, and a later reader cites it by that name.

## What a working track looks like

A track works when a session that has never seen it re-enters from the folder alone and can answer each of these:

- Which single question is being measured, and why is it running now?
- What is the current state, measured during this pass rather than carried in from an earlier one?
- Which questions are still open, where does the evidence point, and what would overturn that?
- What was decided, and what was considered and dropped?

A track failing these is non-conforming even when it satisfies every shape rule below.

## Frontmatter and dating

Every file carries `title` and `description`. `README.md` carries one field the others do not.

- `title` (required): the track subject in sentence case
- `description` (required): one line naming what the track measures
- `date` (required, `README.md` only): the day the folder opened, as `YYYY-MM-DD`

Carry the opening date as a frontmatter field rather than a sentence in the body. A date written into prose is readable by a person and by nothing that walks the folder, and the two spellings drift once both are permitted. State it once and remove the body sentence rather than leaving the pair in place.

Date the folder once rather than every file. A per-file date leaves every other file stale the first time one is edited, while the opening date never rots. The checkable half is the commit each measurement was taken against, which the file holding that measurement names.

## Reserved numbers

Five slots carry a fixed meaning. The rest are free, which is what lets the middle of a folder follow its subject.

| Number       | Holds                                           | Required                    |
| ------------ | ----------------------------------------------- | --------------------------- |
| `00`         | Scope: constraints, risks, question list        | Large tracks only           |
| `01`         | Current state, measured                         | Always                      |
| `02` to `05` | Topic files, whatever the subject demands       | As needed                   |
| `06`         | Decision                                        | To close                    |
| `07`         | Handoff, self-contained                         | To close                    |
| `08`         | Spikes: method, result, and cost per experiment | Tracks that run experiments |

A folder missing `06` and `07` is live. That is the only status marker, and no separate tracking is needed.

`08` sits after the closing files because it is an appendix. It holds evidence rather than a topic, so folding it into the `02` to `05` range buries it, and a track closes with or without one.

## README.md

Orients. Holds no findings.

- A one-line definition of the investigation
- A `## Why` section stating why the track is running now
- A file-map table of filename and what it holds, kept current as files are added or retired
- A `## Method` section splitting internal sources from external ones, naming which were used and which were not yet done, and listing under a leads heading any external source found but not opened
- A `## Prior art` section
- A `## Source citation` section stating the rule below, so a returning session picks it up from the folder
- The phase stated out loud in the first three lines, in the form `Groundwork phase. Nothing here is a feature plan.`

The file map is how a returning reader re-enters. After the decision, it is the highest-value thing in the folder.

Every claim about a source outside the project carries a link to it, wherever the claim appears in the folder. A sentence asserting that a vendor documents something reads the same whether it came from a fetched page or from recall, and a later reader can neither check it nor tell the two apart.

A source found and not read is listed as a lead and is never cited. That half is what keeps the rule from producing citation theater, because a link attached to a page nobody opened is worse than no link. Listing it still pays, since it stops a later pass re-searching for what this one already surfaced.

Where the track supersedes an earlier plan or an earlier folder, name it and say not to go looking for it. Without that, the old reasoning keeps circulating.

## 01-current-state.md

Facts before opinion. Verified measurement only, taken during this pass.

- Never carry a figure from a previous session without re-measuring. Stale ratios survive a sunset that invalidates them, and every number built on one is quietly wrong.
- Mark an inference as an inference where one is unavoidable.
- Measure only what an open question needs. A number with no question attached is the mechanism by which the groundwork becomes the work.

## 00-scope.md

Written when the subject is large enough to run away. Holds constraints, risks, the open question list, and the downstream surfaces a decision would touch. A small track skips it and carries its questions inside the topic files.

## 06-decision.md

Closes the folder. Everything above it is input.

- The problem stated once
- The goal
- The items to do
- What was considered and dropped

The dropped list pays off later. It is what stops a future session re-proposing something already rejected.

## 07-next-session.md

Written to survive a compaction that loses the conversation. It repeats facts held elsewhere in the folder rather than pointing at them. That duplication is correct here and wrong everywhere else.

## 08-spikes.md

Evidence by experiment, sitting beside the evidence by measurement that `01-current-state.md` holds. Optional, and most tracks never open it, because measuring what is already there settles most questions.

Each spike carries four things:

- The open question it answers, named by file and number. A spike attached to no question is the same runaway the current-state file is capped against.
- The method, stated fully enough for a later reader to re-run it. Name the fixture and where it lived, the exact command, and how many repetitions were run. An arm pointed at a fixture inside the project measured the project, so the fixture location is part of whether the result stands.
- The result, and which question it closes. A spike that settles nothing is still recorded, so a later pass does not pay to learn the same thing twice.
- The measured cost, and the caveats bounding what the result proves.

Cost is a report rather than a limit, and it is what makes the next spike estimable before anyone commits to it. Record it even when it comes to a single read.

A spike also leaves files behind, and they split on whether the track cites them rather than on whether they are markdown. An input the run reads, being a fixture page, an arm script, or a copied asset, is re-runnable and cited by nothing, so it stays outside the track wherever the surface driving the spike puts it. Evidence the record cites, being a recording, a render, or a frame pulled from one, is what a later reader opens to check a claim, so it lives in `evidence/` inside the track beside the file citing it. Name the split rather than the file types, which is what keeps this from going stale on the next kind of artifact a spike produces.

`evidence/` takes no number, since numbering is the read order over the files a reader opens in sequence and an artifact is reached from the claim that cites it instead.

Reach for a test harness the project already carries before building one. A track needing an experiment no existing harness can express has found a finding, and it belongs in the folder rather than in a new abstraction.

One method error is worth naming, because it is made rather than imagined. Counting matches in a transcript overstates whether a file was read, since an instruction naming a path puts that path in the transcript whether or not anything opened it. The check is the tool call.

## Open questions

Every open question carries a lean, wherever it appears. A bare numbered list hands the reader a quiz and defers the judgment the track exists to inform.

```markdown
1. <question>
   - Leaning: <where the evidence currently points>
   - Overturned by: <the finding that would change it>
```

- Pair every lean with what would overturn it. A lean with no falsifier is an opinion.
- On a measurement rather than a judgment, write `- Leaning: none, needs measuring` and drop the overturn line. A guess at a number is worse than an admission.
- Mark each question open or answered, and repeat the open ones at the end of the file they belong to. That gives the decision file its agenda for free.

A lean is weaker than the suggestion a plan file carries. It records the current read on a question still open by definition, not a decision to accept by default at execution time.

## Conventions

- State a number with what it settles. The strongest sections are the ones where a measurement answers a named question and says so.
- Route a finding that would change an existing standard or rule through `plan-intake`. Only a demonstrated failure changes one.
- Let the file count follow the number of genuinely separable questions, not the importance of the topic. A large topic with one question is a small folder.

## Anti-patterns

- **The groundwork becomes the work.** Gathering expands until the measuring costs more than the change it justifies. Cap it, and drop any thread with no question attached.
- **Deciding by omission.** Closing a track while an unresolved question quietly fails an outcome. Resolve it or record it as knowingly accepted.
- **Recording a constraint discovered while defending a decision.** Check a constraint against the alternative design before writing it down, or a fact about the current shape gets written up as inherent to the problem.
- **A plan written before the groundwork.** Every track that has done this had to supersede the plan it wrote.
- **The date left in the body.** A frontmatter field and a sentence both claiming the opening date resolve to whichever a reader happens to hit, and only one of them is readable by a walker.

## Template

```markdown
---
title: <Track subject>
description: <one line naming what the track measures>
date: <YYYY-MM-DD>
---

# <Track subject>

Groundwork phase. Nothing here is a feature plan.

<One line defining the investigation.>

## Why

<Why the track is running now.>

## Files

| File                  | Holds           |
| --------------------- | --------------- |
| `01-current-state.md` | <what it holds> |

## Method

<Internal sources used, external sources used, and what is not yet done.>

### Leads

- <external source found but not opened>

## Prior art

<Earlier plans, folders, or decisions this track supersedes or builds on.>

## Source citation

Every claim about a source outside the project carries a link. A source found
and not read is listed as a lead and is never cited.
```
