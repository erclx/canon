---
title: Groundwork reference
description: Folder layout, ordinal naming, reserved numbering, frontmatter and dating, required file contents, and conventions for a measurement track
---

# Groundwork reference

Applies to a groundwork track at `.canon/groundwork/<nn>-<slug>/`. A track measures one question that has to be settled before anyone can plan against it. The numbering inside the folder is its table of contents.

The folder is gitignored, and backed by `canon records push` wherever a records remote is configured. Nothing backs it against a compaction dropping a session's reasoning before a push, so the handoff file has to be self-contained.

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
- The ordinal marks a folder per track, opened once and worked over time, distinct from a file addressed by name, one already carrying its own sorting prefix, or one deliberately overwritten.
- Claim the ordinal through `canon records ordinal groundwork <slug> --claim`, which reads the highest one across both `.canon/groundwork/` and `.canon/intake/` and creates the folder in one atomic act, so two sessions opening at once never share a number. The two kinds share one creation-order line.
- With neither folder holding an entry, the first one opened takes `01`, whatever number a track's own files start at.
- Never renumber an existing folder. The ordinal is the order it opened, and a later reader cites it by that name.

## What a working track looks like

A track works when a session that has never seen it re-enters from the folder alone and can answer each of these:

- Which single question is being measured, and why is it running now?
- What is the current state, measured during this pass rather than carried in from an earlier one?
- Which questions are still open, where does the evidence point, and what would overturn that?
- What was decided, and what was considered and dropped?

A track failing these is non-conforming even when it satisfies every shape rule below.

## Frontmatter and dating

- `title` (required): the track subject in sentence case
- `description` (required): one line naming what the track measures
- `date` (required, `README.md` only): the day the folder opened, as `YYYY-MM-DD`

Carry the opening date as a frontmatter field rather than a sentence in the body, since nothing that walks the folder reads prose. Date the folder once rather than every file, because a per-file date goes stale on the first edit. The checkable half is the commit each measurement was taken against, which the file holding that measurement names.

## Reserved numbers

Five slots carry a fixed meaning, and the rest are free.

| Number       | Holds                                           | Required                    |
| ------------ | ----------------------------------------------- | --------------------------- |
| `00`         | Scope: constraints, risks, question list        | Large tracks only           |
| `01`         | Current state, measured                         | Always                      |
| `02` to `05` | Topic files, whatever the subject demands       | As needed                   |
| `06`         | Decision                                        | To close                    |
| `07`         | Handoff, self-contained                         | To close                    |
| `08`         | Spikes: method, result, and cost per experiment | Tracks that run experiments |

A folder missing `06` and `07` is live, and that is its only status marker.

`08` sits after the closing files because it is an appendix of evidence rather than a topic, and a track closes with or without one.

## README.md

Orients. Holds no findings.

- A one-line definition of the investigation
- A `## Why` section stating why the track is running now
- A file-map table of filename and what it holds, kept current as files are added or retired
- A `## Method` section splitting internal sources from external ones, naming which were used and which were not yet done, and listing under a leads heading any external source found but not opened
- A `## Prior art` section
- A `## Source citation` section stating the rule below, so a returning session picks it up from the folder
- The phase stated out loud in the first three lines, in the form `Groundwork phase. Nothing here is a feature plan.`

Every claim about a source outside the project carries a link to it, wherever the claim appears in the folder. Without one, a later reader cannot tell a fetched page from recall. A source found and not read is listed as a lead and is never cited, since a link to a page nobody opened is worse than no link. Listing it stops a later pass re-searching for it.

Where the track supersedes an earlier plan or an earlier folder, name it and say not to go looking for it. Without that, the old reasoning keeps circulating.

## 01-current-state.md

Facts before opinion. Verified measurement only, taken during this pass.

- Never carry a figure from a previous session without re-measuring, since every number built on a stale one is quietly wrong.
- Mark an inference as an inference where one is unavoidable.
- Measure only what an open question needs. A number with no question attached is the mechanism by which the groundwork becomes the work.

## 00-scope.md

Written when the subject is large enough to run away. Holds constraints, risks, the open question list, and the downstream surfaces a decision would touch. A small track skips it.

## 06-decision.md

Closes the folder. Everything above it is input.

- The problem stated once
- The goal
- The items to do
- What was considered and dropped

The dropped list is what stops a future session re-proposing something already rejected.

## 07-next-session.md

Written to survive a compaction that loses the conversation. It repeats facts held elsewhere in the folder rather than pointing at them. That duplication is correct here and wrong everywhere else.

## 08-spikes.md

Evidence by experiment, beside the evidence by measurement `01-current-state.md` holds. Optional, since measuring what is already there settles most questions.

Each spike carries four things:

- The open question it answers, named by file and number. A spike attached to no question is a runaway.
- The method, stated fully enough for a later reader to re-run it. Name the fixture and where it lived, since an arm pointed at a fixture inside the project measured the project, plus the exact command and the repetition count.
- The result, and which question it closes. Record a spike that settles nothing too, so a later pass does not pay for it twice.
- The measured cost, even for a single read, and the caveats bounding what the result proves. Cost is a report rather than a limit, and it makes the next spike estimable.

Start a spike against a sample bounded on input size, duration, and spend, and scale up only once it shows the method works. Record the sample's bounds beside the figure for the full input.

A file a reader opens to verify how a result was produced or what it showed lives inside the track, and bulk input such as a large fixture stays outside it. Three unnumbered subfolders carry the first kind, since a reader reaches them from the citing claim rather than in read order:

- `evidence/`: what a run produced and the record cites, being a recording, a render, or a frame pulled from one, beside the file citing it.
- `scripts/`: the arm scripts and harnesses a spike ran, which a reader opens to check the method.
- `clones/`: checkouts and copies of outside material a claim rests on, kept small enough to hold in the folder. A checkout too large to keep is cited by its address and commit instead.

Open no other subfolder: `spikes/`, `web/`, and `research/` fold into these three, with a fetched page in `clones/` and a reference-site screenshot in `evidence/`.

Reach for a test harness the project already carries before building one. An experiment no existing harness can express is a finding for the folder, not a new abstraction.

Never count transcript matches to show a file was read. An instruction naming a path puts it in the transcript whether or not anything opened it, so the check is the tool call.

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

A lean is weaker than a plan's suggestion: it records the current read on an open question, not a decision to accept at execution time.

## Conventions

- State a number with what it settles. The strongest sections are the ones where a measurement answers a named question and says so.
- Route a finding that would change an existing standard or rule through `plan-intake`. Only a demonstrated failure changes one.
- Let the file count follow the number of genuinely separable questions, not the importance of the topic. A large topic with one question is a small folder.

## Anti-patterns

- **The groundwork becomes the work.** Gathering expands until the measuring costs more than the change it justifies. Cap it, and drop any thread with no question attached.
- **Deciding by omission.** Closing a track while an unresolved question quietly fails an outcome. Resolve it or record it as knowingly accepted.
- **Recording a constraint discovered while defending a decision.** Check it against the alternative design first, or a fact about the current shape reads as inherent to the problem.
- **A plan written before the groundwork.** Every track that has done this had to supersede the plan it wrote.

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
