---
title: Teach
description: Listing learning workspaces with what their records schedule next, opening one with its required files, recording sources and glossary terms, resolving what the next lesson needs before it is written, rewriting the root listing, a contents page, and each lesson's chrome and quiz stepper from its marker regions, the refusal reasons, and why every write here runs through a verb
---

# Teach

Learning workspaces sit under `.canon/teach/<nn>-<topic>/`, and `standards/teach.md` fixes their layout, naming, and file formats, apart from the glossary, whose shape `standards/glossary.md` fixes, cited from the `teach-workspace` skill, so it travels with the file wherever a promotion lands it. Every verb here resolves that folder against the main worktree root rather than against the working directory, so a session standing in a linked worktree reaches the one workspace the learner has rather than opening a second.

That root resolution is also why the writing verbs exist at all. The file-editing tools refuse a main-root path from a linked worktree and offer a worktree copy instead, and a caller naming only the destination reports a success that did not happen. A whole-file create still goes out as a shell heredoc. Changing a line inside a file that already exists has no shell route, because the stream editors are banned, so `resource` and `glossary` are the route for the two files a running workspace edits.

## List

`canon teach list` reports the workspaces under `.canon/teach/`, or what one workspace holds. It reads and never writes.

```bash
canon teach list
canon teach list regular-expressions --json
```

| Option          | Behavior                                    |
| --------------- | ------------------------------------------- |
| `--json`        | Emit a machine-readable record on stdout    |
| `--root <path>` | Teach root, defaulting to the main worktree |

With no topic it reports one line per workspace, carrying the lesson, learning-record, reference-page, and glossary-term counts, plus `next`, the ordinal an open would take. With one it reports the filenames behind each count and the glossary entries themselves.

A folder not named `NN-<topic>` is still listed rather than dropped, since dropping it hides the one folder that needs a fix. Its ordinal reads as absent, it sorts last, and it moves no ordinal, so a malformed name cannot push a new workspace into a number a reader already cites.

The listing also names the required files a workspace does not carry, which is `MISSION.md`, `RESOURCES.md`, and `GLOSSARY.md`. That is a report rather than a refusal, because a workspace missing one is still a workspace a session can resume.

Every record carries `due`, read from the `## Revisit` sections of the workspace's learning records and sorted soonest first. Each entry names the `item`, its `date`, the `rung` it has reached on the spacing ladder, `overdue` once that date has arrived or passed, and the `record` the surviving entry was written in. A later record supersedes an earlier entry for the same item, matched without regard to case, since the schedule is the state of one topic rather than a log of every time it was set.

Each entry also carries `hit` and `miss`, the two dates the next record could write. The ladder is 1, 3, 7, 16, and 35 days, a retrieval the learner passed unaided moving up a rung and a miss dropping back one, both held inside the ladder at either end. Reporting both dates is what lets a session copy one rather than compute it, on the same reasoning that put quiz option order in `canon teach lesson`.

The field rides on the listing rather than on `canon teach lesson`, because a session needs the schedule before it has chosen what to teach and that verb takes a `--slug` naming a choice already made. An entry not written in the shape the standard fixes is skipped rather than reported, since a note carrying no date has no date to schedule.

## Open

`canon teach open` creates a workspace at the next ordinal and writes all three required files.

```bash
canon teach open regular-expressions \
  --subject "Reading and writing regular expressions" \
  --starting-point "Comfortable with the shell, has never written a group" \
  --success "Write a pattern matching a date" \
  --success "Explain what a backreference does"
```

| Option                    | Behavior                                                    |
| ------------------------- | ----------------------------------------------------------- |
| `--subject <line>`        | One line stating what the workspace covers, required        |
| `--starting-point <text>` | What the learner already knows, required                    |
| `--success <line>`        | Observable thing the learner will be able to do, repeatable |
| `--out-of-scope <line>`   | What the workspace does not cover, repeatable               |
| `--title <text>`          | Title, defaulting to the topic in sentence case             |
| `--date <YYYY-MM-DD>`     | Opening date, defaulting to today                           |
| `--json`                  | Emit a machine-readable record on stdout                    |
| `--root <path>`           | Teach root, defaulting to the main worktree                 |

The ordinal comes from the highest already present, incremented, so the caller derives no name and composes no path. A topic another workspace already covers is refused rather than opened beside it, since two workspaces on one subject fork the learning records the folder exists to keep whole.

`--starting-point` is required rather than defaulted because difficulty with no floor under it teaches nobody, and a mission written without one cannot say what the lessons sit above. At least one `--success` line is required for the same reason in the other direction: a mission nothing can test is a mission nothing can call finished.

## Resource

`canon teach resource` records sources in a workspace `RESOURCES.md`, keeping what was read apart from what was only found.

```bash
canon teach resource regular-expressions \
  --read "MDN regular expressions=https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions" \
  --lead "RE2 syntax=https://github.com/google/re2/wiki/Syntax"
```

| Option               | Behavior                                           |
| -------------------- | -------------------------------------------------- |
| `--read <title=url>` | Source that stands behind the material, repeatable |
| `--lead <title=url>` | Source found and not opened, repeatable            |
| `--json`             | Emit a machine-readable record on stdout           |
| `--root <path>`      | Teach root, defaulting to the main worktree        |

The pair splits on the first `=`, so a URL carrying its own separator survives intact. Say in the title which claims rest on the source, since the entry is the only place a later session reads that from.

A URL either heading already lists is refused rather than written twice. Two entries for one source split what rests on it across two lines, and a reader checking a claim then finds half of the answer.

A URL a file displays inside a fence does not count as listed, which is how a workspace quoting the entry format in its own prose is read as the sample it is.

## Glossary

`canon teach glossary` adds terms to a workspace `GLOSSARY.md`, alphabetically.

```bash
canon teach glossary regular-expressions \
  --term "capture group=A parenthesised part of a pattern whose match is kept" \
  --first-seen 0002-groups.html
```

| Option                     | Behavior                                                  |
| -------------------------- | --------------------------------------------------------- |
| `--term <term=definition>` | Term the subject defines, repeatable                      |
| `--first-seen <file>`      | Lesson or reference page the batch first defines these in |
| `--json`                   | Emit a machine-readable record on stdout                  |
| `--root <path>`            | Teach root, defaulting to the main worktree               |

One call writes one file, which keeps a batch of terms from racing on the glossary every one of them shares. `--first-seen` names one page for the whole batch rather than one per term, because a batch comes from one lesson.

A term already defined is refused rather than replaced. A definition the subject has moved under is a revision of the entry that exists, and nothing on the command line tells that apart from a second definition arriving by mistake.

The entry lands as the standard's shape, leading with the term as a bolded span. A definition not ending in sentence punctuation is terminated before the citation is appended, so a bare phrase does not run into the sentence naming where the term first appears.

## Lesson

`canon teach lesson` resolves what the next lesson needs before it is written. It reads and never writes.

```bash
canon teach lesson regular-expressions \
  --slug capture-groups \
  --questions 3 \
  --options 4
```

| Option            | Behavior                                                  |
| ----------------- | --------------------------------------------------------- |
| `--slug <kebab>`  | The lesson's own topic, required                          |
| `--questions <n>` | How many questions the quiz carries, required             |
| `--options <n>`   | How many options each question carries, defaulting to `4` |
| `--json`          | Emit a machine-readable record on stdout                  |
| `--root <path>`   | Teach root, defaulting to the main worktree               |

It reports three things. `lesson` is the numbered path the lesson takes, derived from the highest ordinal already in `lessons/` the way an open derives a workspace ordinal. `success` carries the mission's success lines, so a session reports progress against the exit criteria without a second read of `MISSION.md`. `quiz` carries one entry per question.

A lesson written against this record carries its chrome as four empty marker pairs rather than hand-composed markup: `canon:teach:style`, `canon:teach:header`, `canon:teach:footnav`, and `canon:teach:scripts`. `canon teach nav`, below, fills them from what the workspace holds on disk.

`canon teach stylesheet <topic>` writes the one file every lesson in the workspace embeds, seeded from the design source so a workspace renders in the system every other surface does. It refuses to overwrite, reporting `written` as false where the workspace already carries one, and `--force` takes the seed back over it. Each workspace used to carry a hand-authored palette, which is how the course styling forked once per workspace, so a lesson adds its own rules under the seed and reaches a value through its custom property rather than restating the hex.

Each `quiz` entry carries `order`, the authored option indices in presentation order where index `0` is the correct answer, and `answer`, the one-based position that answer lands in. Both travel together because a caller deriving the position itself is a caller that can derive it wrongly.

The order is drawn here rather than instructed, and that is the point of the verb. An author told to vary the position still varies it by judgment, and the judgment settles on the first slot, which is the defect this design departs from. The draw is uniform over the options, so the position carries no information about which answer is correct.

## Render

`canon teach render` renders a lesson body's structural blocks to HTML, through the same components the fixture lesson under `examples/teach/00-fixture/` is generated from. It takes no topic and no `--root`, since the verb is a stateless transform reading nothing off a workspace on disk.

```bash
echo '[{"type":"heading","level":1,"text":"Compass bearings"}]' | canon teach render --json
```

| Option   | Behavior                                 |
| -------- | ---------------------------------------- |
| `--json` | Emit a machine-readable record on stdout |

It reads a JSON array of blocks from stdin, each a `heading`, `paragraph`, `list`, or `raw` block, and reports `{ ok: true, html }` on `--json` or the bare rendered HTML on stdout otherwise. Content none of the three components can express takes a `raw` block, carrying its own HTML verbatim and unescaped, which is the shape the quiz and the teach-back block travel in.

It refuses `bad-input` on empty stdin, on malformed JSON, on stdin that does not parse to an array, and on a block carrying an unrecognized `type` or a field of the wrong shape for its type, naming the block's index in the message.

## Nav

`canon teach nav` rewrites the teach-root listing, a workspace's contents page, and each of its lessons' chrome, from what the workspace holds on disk.

```bash
canon teach nav
canon teach nav regular-expressions --json
```

| Option          | Behavior                                          |
| --------------- | ------------------------------------------------- |
| `[topic]`       | Workspace folder or topic, scoping the run to one |
| `--json`        | Emit a machine-readable record on stdout          |
| `--root <path>` | Teach root, defaulting to the main worktree       |

With no topic it rewrites every workspace. The teach-root listing is always rewritten regardless, since it reports on every workspace and a scoped run leaving it stale would be a second kind of drift this verb exists to end.

A lesson carries its chrome as four marker pairs the authoring skill writes empty: `canon:teach:style`, `canon:teach:header`, `canon:teach:footnav`, and `canon:teach:scripts`. This verb splices each one from the current workspace state, embedding the shared stylesheet, rebuilding the breadcrumb and jump menus, the prev/next footer nav, and the behavior scripts, and leaves the authored `<h1>`, lede, body, and quiz between the header and the footnav untouched.

A lesson missing one of the four marker pairs is refused by name rather than rewritten, and every other lesson in the run still rewrites. The record's `skipped` list carries the refused files and which marker each is missing.

The `style` region carries the quiz stepper after the workspace stylesheet, for every lesson but the one shape named three paragraphs down, so it wins the cascade at equal specificity and reaches a workspace seeded before it existed. The stepper is CSS over the radio inputs a quiz is written from: it hides every question that follows one holding no checked input, and hides a question's feedback until that question does. The general sibling combinator is what keeps that from depending on the markup contract holding, since it selects the same questions as the adjacent one for a quiz written correctly and goes on gating when anything sits between two of them, where the adjacent one matches nothing and shows them all at once. Gating there rather than in a script is what keeps a later stem from answering an earlier question with nothing to bind, and the whole block sits inside `@supports selector(:has(*))`, so an engine without `:has()` renders every question rather than a stepper showing nothing. Feedback there follows the workspace stylesheet, shown by one that says nothing about `.fb` and hidden by one grown under the retired script.

The block hides and shows and sets nothing else, which leaves a workspace's own layout for a question and its own appearance for an option and a feedback panel. The one value it names is `display: block` on revealed feedback, since every stylesheet grown under the retired script carries `.fb { display: none }` and nothing adds the class that used to reveal it.

One detector decides both regions. A lesson carrying `<button class="opt"`, the shape written before the stepper, takes the feedback script and no stepper, and every other lesson takes the stepper and no script. That is a detector rather than a mode, since a lesson has one shape or the other, and removing the script outright would leave the lessons already written showing no feedback at all.

Splicing the stepper into a lesson of either shape was measured against a browser and reverted. Its rules match a button question, which can never hold a checked radio, so a lesson given both hides every question past the first for good and outranks the class the script reveals feedback with. Nothing else caught that: the markup is valid, the splice succeeds, and the page renders.

## Opening a workspace

No `canon teach` verb serves the workspace. `canon serve` does, taking the teach root as its directory and the workspace contents page as its entry:

```bash
canon serve .canon/teach --entry 03-fde-system-design/index.html --json
```

It stays general rather than becoming `canon teach serve`, because nothing about serving a directory is specific to a learning workspace, and the same verb carries a slide render and a design preview.

Read `url` off the record rather than building one from the port that was asked for. The verb walks forward past a port already in use, which is routine when a second workspace is already open, and the port it took is the one thing a composed URL gets wrong.

## Refusal reasons

| Reason         | Raised when                                                     |
| -------------- | --------------------------------------------------------------- |
| `no-teach`     | The root carries no `.canon/teach/` folder                      |
| `no-workspace` | No workspace matches the topic, with the folder names as detail |
| `ambiguous`    | Two workspaces claim one topic, with both names as detail       |
| `exists`       | A workspace already covers the topic an open names              |
| `no-file`      | The workspace carries no file the verb writes into              |
| `no-section`   | `RESOURCES.md` carries no heading the entries belong under      |
| `listed`       | A URL is already listed under either heading                    |
| `defined`      | A term already carries a glossary entry                         |
| `bad-input`    | The command line is malformed, before any folder is read        |

A `bad-input` refusal reports the working directory as its root rather than the resolved one, since the command line is rejected before the root is worth resolving. `lesson` raises it for a slug that is not kebab-case, for a quiz carrying no question, and for a question carrying fewer than two options, since a question with one option has nothing to confuse the right answer with.
