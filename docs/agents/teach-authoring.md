---
title: Teach authoring
description: Resolving what the next lesson needs before it is written, rendering a lesson body's blocks to HTML, and rewriting the root listing, a contents page, and each lesson's chrome and quiz stepper from its marker regions
---

# Teach authoring

The verbs a session runs while writing a lesson. Workspace resolution, the verbs that open and record into a workspace, and the refusal reasons they share are in `teach.md`.

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

`canon teach stylesheet <topic>` writes the pair every lesson in the workspace renders through, seeded from the design source so a workspace renders in the system every other surface does. The two halves are written on different terms. `assets/base.css` holds the generated design layer and is rewritten on every run, which is the only way a change to the shared chrome reaches a workspace that already exists. `assets/course.css` is the half a workspace owns, so it refuses to overwrite, reporting `written` as false where the workspace already carries one, and `--force` takes the seed back over it. Each workspace used to carry a hand-authored palette, which is how the course styling forked once per workspace, so a lesson adds its own rules under the seed and reaches a value through its custom property rather than restating the hex.

Each `quiz` entry carries `order`, the authored option indices in presentation order where index `0` is the correct answer, and `answer`, the one-based position that answer lands in. Both travel together because a caller deriving the position itself is a caller that can derive it wrongly.

The order is drawn here rather than instructed, and that is the point of the verb. An author told to vary the position still varies it by judgment, and the judgment settles on the first slot, which is the defect this design departs from. The draw is uniform over the options, so the position carries no information about which answer is correct.

## Render

`canon teach render` renders a lesson body's structural blocks to HTML, through the four lesson components. It takes no topic and no `--root`, since the verb is a stateless transform reading nothing off a workspace on disk.

```bash
echo '[{"type":"heading","level":1,"text":"Compass bearings"}]' | canon teach render --json
```

| Option   | Behavior                                 |
| -------- | ---------------------------------------- |
| `--json` | Emit a machine-readable record on stdout |

It reads a JSON array of blocks from stdin, each a `heading`, `paragraph`, `list`, `refs`, or `raw` block, and reports `{ ok: true, html }` on `--json` or the bare rendered HTML on stdout otherwise. Content none of the components can express takes a `raw` block, carrying its own HTML verbatim and unescaped, which is the shape the quiz and the teach-back block travel in.

A citation takes two shapes. A `paragraph` carries an optional `cites` array of reference numbers, rendered as `sup.cite` markers after its text. The one `refs` block carries `items` of `{ title, url?, note? }`, rendered as `ol.refs` and numbered from 1, so cite `1` links to the first item.

```json
[
  { "type": "paragraph", "text": "North is fixed.", "cites": [1] },
  {
    "type": "refs",
    "items": [{ "title": "Compass manual", "url": "https://example.com" }]
  }
]
```

It refuses `bad-input` on empty stdin, on malformed JSON, on stdin that does not parse to an array, and on a block carrying an unrecognized `type` or a field of the wrong shape for its type, naming the block's index in the message. Citations add four refusals, each naming the offending block: a cite that resolves to no reference, `cites` on a lede paragraph, a second `refs` block, and a reference `url` that is not `http` or `https`.

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

A lesson carries its chrome as four marker pairs the authoring skill writes empty: `canon:teach:style`, `canon:teach:header`, `canon:teach:footnav`, and `canon:teach:scripts`. This verb splices each one from the current workspace state, embedding the toolkit's favicon, the shared stylesheet, and the script that settles the course panel before the page paints, rebuilding the course sidebar, the breadcrumb and jump menus, the prev/next footer nav, and the behavior scripts. It leaves the authored `<h1>`, lede, body, and quiz between the header and the footnav as written, with two exceptions. It wraps them in `<main>` when the lesson holds none, since the column width hangs off that element, and a lesson that already carries a `<main>` keeps its own.

It also links each "lesson NNNN" mention in that region to the lesson file in the same workspace carrying that number, skipping text inside `a`, `code`, `pre`, `script`, `style`, `label`, `summary`, and comments. A link the verb writes carries `data-lesson-ref`, and it is the only kind the verb rewrites: every run points one at the current filename for its number, or unwraps it to plain text once that number names no lesson. A link an author wrote is never touched.

Every workspace label in that chrome, being the breadcrumb, the sidebar heading, the workspace switcher, and the root listing's row, reads the mission's `title` and falls back to the folder topic in sentence case where the mission names none.

It also deletes two links a session used to write by hand into a lesson's `<head>`, each matched as its exact string: the old icon link and `<link rel="stylesheet" href="../assets/course.css" />`. The page keeps only the icon and the stylesheets the `style` region carries. Any other link an author wrote stays.

A workspace carrying no `course.css` gets its stylesheet pair seeded first, so the contents page it links is never unstyled, and an existing `course.css` is never overwritten. The `style` region links `assets/base.css` ahead of an embedded copy of `course.css`, so the workspace's own rules still win the cascade. The embedded copy drops the seed's `@import` line, which resolved against the lesson's own folder and never loaded anything, and the link is what reaches the base sheet in its place. A workspace with no `assets/base.css`, one holding a hand-authored `course.css` from before the seed, gets no link rather than one pointing at a missing file.

That seeding fires on the absent file alone, so a workspace already holding a `course.css` has neither half rewritten here. A change to the shared chrome therefore takes `canon teach stylesheet <topic>` per workspace, which rewrites `assets/base.css`, and every lesson picks it up through its link with no run of this verb. Running this one alone leaves every lesson on the `base.css` the workspace already holds, and nothing reports it. Only an edit to a workspace's own `course.css` needs this verb, since that half is embedded.

A lesson missing one of the four marker pairs is refused by name rather than rewritten, and every other lesson in the run still rewrites. The record's `skipped` list carries the refused files and which marker each is missing.

A mention whose number names no lesson in its workspace stays plain text and lands in the record's `unresolved` list, one `{ file, lesson }` entry per distinct number per lesson, with `file` relative to the root the way a `skipped` entry is. The lesson still rewrites and counts toward `lessons`, and the exit stays 0. A mention of the lesson's own number stays plain and is not reported, and a refused lesson reports nothing.

The `style` region carries the quiz stepper after the workspace stylesheet, for every lesson but the one shape named three paragraphs down, so it wins the cascade at equal specificity and reaches a workspace seeded before it existed. The stepper is CSS over the radio inputs a quiz is written from: it hides every question that follows one holding no checked input, and hides a question's feedback until that question does. The general sibling combinator is what keeps that from depending on the markup contract holding, since it selects the same questions as the adjacent one for a quiz written correctly and goes on gating when anything sits between two of them, where the adjacent one matches nothing and shows them all at once. Gating there rather than in a script is what keeps a later stem from answering an earlier question with nothing to bind, and the whole block sits inside `@supports selector(:has(*))`, so an engine without `:has()` renders every question rather than a stepper showing nothing. Feedback there follows the workspace stylesheet, shown by one that says nothing about `.fb` and hidden by one grown under the retired script.

The block hides and shows and sets nothing else, which leaves a workspace's own layout for a question and its own appearance for an option and a feedback panel. The one value it names is `display: block` on revealed feedback, since every stylesheet grown under the retired script carries `.fb { display: none }` and nothing adds the class that used to reveal it.

One detector decides both regions. A lesson carrying `<button class="opt"`, the shape written before the stepper, takes the feedback script and no stepper, and every other lesson takes the stepper and no script. That is a detector rather than a mode, since a lesson has one shape or the other, and removing the script outright would leave the lessons already written showing no feedback at all.

Splicing the stepper into a lesson of either shape was measured against a browser and reverted. Its rules match a button question, which can never hold a checked radio, so a lesson given both hides every question past the first for good and outranks the class the script reveals feedback with. Nothing else caught that: the markup is valid, the splice succeeds, and the page renders.

### Reference pages

Each reference page is rendered to a `reference/<slug>.html` sibling carrying the same chrome, and the contents page links that sibling rather than the markdown, which `canon serve` hands over as plain text. The render drops the frontmatter, turns tables into `<table>` markup, and escapes raw HTML written in the markdown rather than passing it through. A body with no H1 gets one from the frontmatter `title`. A relative link to another reference page's markdown points at that page's `.html` sibling, and one to the workspace `GLOSSARY.md` points at the glossary on the contents page, `../index.html#gloss`. Every other link, such as `../RESOURCES.md`, stays as written. The markdown file is never touched.

Every rendered page carries a `<meta name="generator" content="canon teach nav">` tag. A `.html` file under `reference/` whose markdown is gone is deleted when it carries that tag, and a hand-written HTML file there, carrying none, is left alone. The record's `reference` field counts the pages rendered. On a Bun with no `Bun.markdown`, each reference page lands in `skipped` with `Bun.markdown` as what is missing, and the rest of the run goes on.
