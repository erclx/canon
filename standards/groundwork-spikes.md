---
title: Groundwork spikes reference
description: What each spike in a track's 08-spikes.md records, the sample rule, and the three folders that hold what a spike produced
---

# Groundwork spikes reference

Applies to `08-spikes.md` inside a groundwork track at `.canon/groundwork/<nn>-<slug>/`, and to the folders beside it that hold what a spike produced. It records evidence by experiment, beside the evidence by measurement `01-current-state.md` holds.

## Scope

Governs `08-spikes.md`, what each spike in it carries, how a spike is sized, and the `evidence/`, `scripts/`, and `clones/` folders in a track.

Does not govern:

- The track's folder layout, its other files, frontmatter, and numbering: `groundwork.md`
- Running a spike, which belongs to the surface driving the track

## What a working spike record looks like

A spike record works when a later reader can re-run each spike and trust what it settled:

- Which open question did each spike answer, and did it close it?
- Can the method be re-run from the file, against the fixture it names?
- What did it cost, and what does the result not prove?

## Spikes

The file is optional, since measuring what is already there settles most questions.

Each spike carries four things:

- The open question it answers, named by file and number. A spike attached to no question is a runaway.
- The method, stated fully enough for a later reader to re-run it. Name the fixture and where it lived, since an arm pointed at a fixture inside the project measured the project, plus the exact command and the repetition count.
- The result, and which question it closes. Record a spike that settles nothing too, so a later pass does not pay for it twice.
- The measured cost, even for a single read, and the caveats bounding what the result proves. Cost is a report rather than a limit, and it makes the next spike estimable.

Start a spike against a sample bounded on input size, duration, and spend, and scale up only once it shows the method works. Record the sample's bounds beside the figure for the full input.

## What a spike produced

A file a reader opens to verify how a result was produced or what it showed lives inside the track, and bulk input such as a large fixture stays outside it. Three unnumbered subfolders carry the first kind, since a reader reaches them from the citing claim rather than in read order:

- `evidence/`: what a run produced and the record cites, being a recording, a render, or a frame pulled from one, beside the file citing it.
- `scripts/`: the arm scripts and harnesses a spike ran, which a reader opens to check the method.
- `clones/`: checkouts and copies of outside material a claim rests on, kept small enough to hold in the folder. A checkout too large to keep is cited by its address and commit instead.

Open no other subfolder: `spikes/`, `web/`, and `research/` fold into these three, with a fetched page in `clones/` and a reference-site screenshot in `evidence/`.

Reach for a test harness the project already carries before building one. An experiment no existing harness can express is a finding for the folder, not a new abstraction.

Never count transcript matches to show a file was read. An instruction naming a path puts it in the transcript whether or not anything opened it, so the check is the tool call.

## Template

```markdown
# Spikes

## <nn>. <what the spike tests>

- Question: <file and number of the open question>
- Method: <fixture and where it lived, exact command, repetition count>
- Result: <what it showed, and which question it closes>
- Cost: <measured cost>, <sample bounds beside the full-input figure>
- Caveats: <what the result does not prove>
```
