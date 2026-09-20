---
name: document-health
description: Reports which of a project's documents have rotted, one section per document, across length, placement, and staleness. Reads each axis through the verb that owns it and marks the evidence class each answer carries. Use when asked to "check document health", "which docs have gone stale", "audit the docs for rot", "are these documents still accurate", "which docs are too long", or after a target check reports the structural side. Do NOT use to repair a finding, which the owning command or skill does, and do NOT use to check whether a document exists or holds the right sections, which is `target-check`.
---

# Document health

Reports which documents have rotted rather than which are missing. `target-check` answers whether a project's documents exist and hold the right kind of content, and this answers whether the ones that exist still earn their place. It reports and never repairs, matching the structural check beside it.

Three axes carry the report. Two answer from a verb and the third answers from a reading, which it says rather than hiding. `${CLAUDE_SKILL_DIR}/references/axes.md` holds what each axis measures, the checkpoint it reads against, and where a finding routes. This body holds the order, the guards, and the report shape.

## Guards

- `canon` absent from the path: stop. `❌ canon is not on PATH, so neither measured axis can be read.`
- `git ls-files '*.md'` listing nothing: stop. `❌ No tracked markdown here, so there is no corpus to read.`
- Run every command under `CANON_NON_INTERACTIVE=1` and prompt at no point. A caller reaching this from a rollout wave has nobody present to answer.
- Branch on each record's own fields rather than on an exit status. An operator's shell profile may wrap `canon` in a function whose status comes from a trailing command, which reports every refusal as success.
- Repair nothing, write no file in the project, and open no pull request. Whoever read the report decides what to fix.

## Step 1: scope the corpus

Take the documents the project hand-authors, defaulting to every tracked markdown file the two measured verbs reach. Narrow to a path the caller named when one was given, and say which scope the run took.

Drop what nobody hand-authors before reporting a finding against it: a generated `index.md`, a file under a gitignored folder, and a bundled reference a generator copied out to its consumers. A finding against a copy names a file an author cannot fix, since the next regeneration overwrites it.

## Step 2: read the two measured axes

Run these from the project root, in parallel:

```bash
CANON_NON_INTERACTIVE=1 canon markdown audit --json
CANON_NON_INTERACTIVE=1 canon context audit --json
```

The first answers length, carrying the bullet, paragraph, and depth checkpoints and the per-file weights read against them. The second answers placement for the folders it resolves, carrying entry length, reference form, and index drift.

Then read which classifier would run, and deepen placement with the verdicts per section:

```bash
CANON_NON_INTERACTIVE=1 canon context classifier show
CANON_NON_INTERACTIVE=1 canon context classify sweep --json
```

The first names the backend, the model, and the source that decided both. Report which layer answered, since a project with the model layer off reads from the regex layer alone and the sweep says nothing about which one it used.

Take the checkpoints from the record each verb returns rather than from a number written here. A checkpoint the CLI moves reaches this report with no edit, and a number held in this body goes stale on its own cadence.

### An unread axis is not a healthy one

A refusal, an absent key, and a subcommand the project's binary does not carry each leave an axis unread. Report it as unread against the documents it would have covered, name the read that could not be taken, and name the cause.

`canon context audit` refuses with `reason: "no-folders"` in a project whose folders resolve to nothing, which is the ordinary shape where the layout differs from the one the verb looks for. That refusal is the honest answer rather than a failure, and reading it as an empty finding set reports a healthy corpus for documents nothing looked at.

A narrower read is not an unread one. The sweep running on its regex layer alone still answered, so it is reported with the layer named rather than as an axis nothing reached.

## Step 3: read the staleness axis

No verb answers whether a document still describes the tree it was written about. Read each document against the surfaces it names and report where the two have parted, taking the file paths, commands, and counts it states as the claims to test.

Mark every staleness finding as a reading. It is this session's judgment rather than a measurement, and a report that sets it beside two verb-backed axes without marking it implies evidence the axis does not carry.

## Step 4: report per document

Give each document its three axes, and give each axis three things: the state, the evidence class, and the command or skill that repairs it. Naming the repair is not running it.

The three classes are what keep the axes apart:

- `measured`: a verb returned a number read against a stated checkpoint
- `classified`: a verb returned a verdict carrying its own confidence
- `read`: this session's judgment, backed by no verb

Emit no verdict across the three. Two answer from verbs and one answers from a reading, so a roll-up is a figure that lies about the third. Emit no score across the documents either, for the same reason one level up.

## Output

Lead with the table, then one detail block per document carrying a finding:

```markdown
Document health: `<scope>`, <n> documents read.

| Document         | Length              | Placement           | Staleness        |
| ---------------- | ------------------- | ------------------- | ---------------- |
| `path/to/doc.md` | ok / heavy / unread | ok / moved / unread | ok / stale / n/a |

Length and placement are measured. Staleness is a reading.
```

Keep the evidence line under the table on every run. A table read without it flattens a judgment into a measurement, which is the one shape the three classes exist to prevent.
