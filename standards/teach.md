---
title: Teach reference
description: Workspace layout, ordinal naming, frontmatter, and the mission and learning-record formats for a learning workspace
---

# Teach reference

Applies to a learning workspace at `.canon/teach/<nn>-<topic>/`. One workspace holds one subject studied across sessions, and it carries both halves of what studying produces: the durable reference material a reader consults later, and the disposable lessons a learner works through once.

The folder is gitignored. Its markdown half is written in a format the authoring gates read, so a page promoted out of it later needs no conversion.

## Scope

Governs a learning workspace under `.canon/teach/<nn>-<topic>/`: folder layout, ordinal naming, frontmatter, and the mission and learning-record formats.

Does not govern:

- The frontmatter, entry shape, and ordering of the glossary the workspace holds: the `teach-workspace` skill, which carries that reference
- What a lesson teaches, how it sequences difficulty, and what makes one worth returning to, which belong to the surface driving the workspace
- Where a durable page goes once it leaves the workspace, which belongs to the routing test the destination surface states
- One question measured in depth before anyone can plan against it: `groundwork.md`
- A dump of many findings filed by domain, each carrying its own verdict: `intake.md`
- Voice, rhythm, and sentence construction: the `write-human` skill
- Headings, punctuation, word choice, and file references: `markdown.md`
- When a workspace opens at all, and the procedure that runs one, which belong to the surface driving it

## What a working workspace looks like

A workspace works when a session returning after weeks can resume from the folder alone:

- Which subject is being learned, and what will the learner be able to do when the mission is finished?
- Which sources stand behind the material, and which were found and never opened?
- What has the learner already been through, and what did they get wrong?
- Which pages here are durable reference material, and which are disposable?

A workspace failing these is non-conforming even when it satisfies every shape rule below.

## Folder name

- Name the folder `<nn>-<topic>`, a two-digit zero-padded ordinal followed by a kebab-case topic slug.
- Take the ordinal from the highest one already present, incremented. A listing then sorts by when each workspace opened rather than alphabetically.
- Use two digits on the folder and four inside it. A person opens far fewer workspaces than one workspace holds lessons.
- Never renumber an existing folder. The ordinal is the order it opened, and a later reader cites it by that name.

## Layout

| Path                    | Holds                                                                   | Required |
| ----------------------- | ----------------------------------------------------------------------- | -------- |
| `MISSION.md`            | The subject, the learner's starting point, and success                  | Always   |
| `RESOURCES.md`          | Sources read and sources found but not opened                           | Always   |
| `GLOSSARY.md`           | Terms the subject defines, one entry each                               | Always   |
| `NOTES.md`              | Session scratch that belongs to no other file                           | Optional |
| `reference/<slug>.md`   | Durable reference pages, the promotable half                            | Optional |
| `reference/<slug>.html` | Each reference page rendered by `canon teach nav`, never edited by hand | Optional |
| `learning-records/`     | Numbered records of what the learner was taken through                  | Optional |
| `lessons/`              | Numbered lessons, generated and disposable                              | Optional |
| `assets/`               | Files several lessons share, including the stylesheet                   | Optional |

Only the markdown half answers to a conformance check: `MISSION.md`, `RESOURCES.md`, `GLOSSARY.md`, `NOTES.md`, the markdown under `reference/`, and `learning-records/`. A lesson is generated markup that nothing downstream cites, so this standard fixes its filename and its location and says nothing about what it contains. A rendered reference page is the same kind of output, rewritten from its markdown on every `nav` run.

## Frontmatter

Every markdown file carries `title` and `description`. `MISSION.md` carries one field the others do not.

- `title` (required): what the file covers, in sentence case
- `description` (required): one line naming what a reader gets from it
- `date` (required, `MISSION.md` only): the day the workspace opened, as `YYYY-MM-DD`

Date the workspace once rather than every file. A per-file date leaves every other file stale the first time one is edited, and the opening date never rots.

## File naming

- Number a lesson and a learning record `0001` upward, as `<nnnn>-<slug>.html` and `<nnnn>-<slug>.md`. The number is read order and never changes.
- Name a reference page for its subject alone, with no number. A reference page is looked up rather than worked through, so an ordinal on one implies an order no reader follows.
- Keep one shared stylesheet under `assets/` and embed it in every lesson. A lesson restating its own styles makes a workspace read as a pile of one-offs rather than as one course.

## MISSION.md

Fixes what the workspace is for. Everything else in the folder answers to it.

- A one-line statement of the subject
- A `## Starting point` section stating what the learner already knows, so difficulty has a floor to sit above
- A `## Success looks like` section listing specific observable things the learner will be able to do
- A `## Out of scope` section naming what this workspace deliberately does not cover

Write each success line as something a learner can be asked to do rather than something they will understand. A line nobody can test is a line nothing can report progress against.

## Learning records

One record per session the learner worked through, holding what happened rather than what was taught.

- The lessons covered, by number
- What the learner retrieved correctly without help
- What they got wrong, and what the wrong answer was, including what an explanation the learner produced left out
- A `## Revisit` section scheduling what comes back up

Record the wrong answer rather than the fact of an error. A wrong answer names the misconception, and the count alone names nothing.

A produced explanation and a selected option are both retrieval, so a gap in an explanation goes under what the learner got wrong rather than under a heading of its own. Name the concept and where the explanation broke. Splitting the two puts one input to the next session's placement across two sections, and the placement reads both or neither.

### The revisit section

Write one bullet per item, in this shape and no other:

```markdown
## Revisit

- **<what comes back up>**: due <YYYY-MM-DD>, rung <n>
```

The rung is where the item sits on the spacing ladder, and it travels in the record rather than being counted from how many records name the item, since a miss drops it back and a count only climbs. A later record naming the same item supersedes an earlier one, so revise the schedule by writing the new entry rather than editing the old record.

Take the date and the rung from what the surface driving the workspace reports rather than picking either. An entry outside this shape schedules nothing, and nothing reports that it was skipped.

## GLOSSARY.md

Required in every workspace, holding one entry per term the subject defines. The glossary reference the `canon:teach-workspace` skill carries fixes what an entry looks like, how the file orders and groups them, and which terms it carries, so this standard states only that the file exists and sits at the workspace root. That reference ships with the plugin rather than installing here, because a promoted glossary keeps its shape wherever it lands and no project folder covers every destination. Say so and stop rather than working the shape from memory when the project has no plugin to read it from.

Name the lesson or reference page a term first appears in as that reference requires. A workspace is the case it was written for, so a glossary here has a first appearance to name.

## RESOURCES.md

Splits what was read from what was found.

- List every source that stands behind the material, each with a link
- List under a leads heading any source found and not opened, and never cite one
- Say which claims in the workspace rest on which source

A source found and not read is listed as a lead because a link attached to a page nobody opened is worse than no link. Listing it still pays, since it stops a later session searching for what this one already surfaced.

## Conventions

- Write the markdown half in the format the authoring gates read, so a page promoted later needs no conversion.
- Keep a reference page free of the learner. A page carrying a second person or a quiz is a lesson wearing the wrong extension, and it cannot be promoted.
- Revise a file the subject has moved under rather than appending a second version narrating the change.

## Anti-patterns

- **The mission with no test.** Success stated as understanding rather than as a task leaves nothing able to say the mission is finished.
- **The lesson filed as reference.** A page written to be worked through once sits in `lessons/`, and putting it in `reference/` puts disposable output in the half that gets promoted.
- **The record that counts errors.** A tally of how many were missed carries none of the misconception, which is the only part a later session can act on.
- **The revisit note with no date.** A line naming what to come back to and not when is read by nothing and schedules nothing, so the next session picks from the last record alone, which is the state the section exists to end.
- **The date left in the body.** A frontmatter field and a sentence both claiming the opening date resolve to whichever a reader happens to hit, and only one of them is readable by a walker.
- **The renumbered folder.** Closing a gap in the ordinals moves every name a reader or a record already cited.

## Template

```markdown
---
title: <Subject>
description: <one line naming what a learner gets from this workspace>
date: <YYYY-MM-DD>
---

# <Subject>

<One line stating the subject.>

## Starting point

<What the learner already knows.>

## Success looks like

- <a specific thing the learner will be able to do>
- <a specific thing the learner will be able to do>

## Out of scope

- <what this workspace deliberately does not cover>
```
