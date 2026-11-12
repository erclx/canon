---
name: code-health
description: Reports which of a project's source files have rotted, one row per file, across file length, function length, comment blocks, inline code, and folder layout. Reads each axis through the verb that owns it and marks the evidence class each answer carries. Use when asked to "check code health", "which source files are oversized", "audit the source tree for rot", "which functions need splitting", "where have code comments drifted", or "which code folders are overloaded". Do NOT use to repair a finding, which the owning skill does, such as `code-craft` for a long block or `codebase-layout` for a folder split, do NOT use to review one diff, which is `review-craft`, and do NOT use for markdown, which is `document-health`.
metadata:
  family: check
---

# Code health

Reports which source files have rotted across a whole tree. `code-craft` shapes code while it is written and `review-craft` reads one diff, so neither sees a file that grew a little on every change. This reads the tree as it stands, reports per file, and repairs nothing.

Five axes carry the report. Four answer from a verb, and two of those add a reading the session states as one. `${CLAUDE_SKILL_DIR}/references/axes.md` holds what each axis measures, the record keys it reads, and where a finding routes. This body holds the order, the guards, and the report shape.

## Guards

- `canon` absent from the path: stop. `❌ canon is not on PATH, so no measured axis can be read.`
- `git ls-files ':!:*.md'` listing nothing: stop. `❌ No tracked source here, so there is no tree to read.`
- Prompt at no point, since a caller reaching this from a rollout wave has nobody present to answer
- Branch on each record's own fields rather than on an exit status. `canon code audit` exits 2 on an embedded block, and a shell function wrapping `canon` can report a refusal as success.
- Repair nothing, write no file in the project, and open no pull request. Whoever read the report decides what to fix.

## Step 1: scope the tree

Take every tracked source file the verbs reach by default. Narrow to a path the caller named when one was given, passing it to each verb that takes one, and say which scope the run took. `canon history` reads a whole repository, so run it bare and filter its hotspots to the scope, per `${CLAUDE_SKILL_DIR}/references/trend.md`.

Drop a generated file, a vendored copy, a copy an installer wrote, and a fixture before reporting a finding against it, since nobody hand-writes them. A finding against one names a file an author cannot fix, since the next regeneration or install overwrites it.

## Step 2: read the verbs

Run these from the project root, in parallel:

```bash
canon code audit --json
canon comments scan --json
canon census --json
canon history --json
```

The code audit answers file length, function length, and code held in a string. Comment blocks and degradation terms come from the comment scan, per language. Folder layout reads from the census, and the history record feeds the trend section under the table rather than an axis.

Take every checkpoint from the record that carries it rather than from a number written here. A checkpoint the CLI moves reaches this report with no edit, and a number held in this body goes stale on its own cadence.

### An unread axis is not a healthy one

A refusal, an absent key, and a subcommand the project's binary does not carry each leave an axis unread. An older binary returns a record without the key the axis reads, which looks the same as an empty finding set unless the key itself is tested.

- Report the axis as unread against the files it would have covered, naming the read that could not be taken and the cause
- A language the verb does not parse leaves its files unread on that axis, never passing
- Coverage differs per axis, so take it from `${CLAUDE_SKILL_DIR}/references/axes.md` rather than from one line of a verb's help
- A comment record whose `vocabulary` is `null` found no rule publishing the terms, so the degradation half is unread while the block half still reads

## Step 3: take the readings

Two axes add a judgment to their count. Mark each as a reading, since no verb backs it.

- **Long blocks.** Read only the functions the function axis listed, and skip test files, which `test-craft` owns. Look for a run inside the function that carries its own rule and wants a name.
- **Folder roles.** Take each code folder the census lists past its checkpoint, list its files, and group them by what each is for. Two or more groups is a finding, and one role at any size is none.

Read a comment block finding the same way. The count is measured, and whether the block belongs beside its code is a reading. Never propose deleting a comment to shrink a file.

## Step 4: report per file

Give each file with a finding its axes. Each axis carries its state, its evidence class, and the skill that repairs it. Naming the repair is not running it.

The two classes are what keep the axes apart:

- `measured`: a verb returned a figure read against a checkpoint the record carried
- `read`: this session's judgment, backed by no verb

Emit no verdict across the axes and no score across the files. A roll-up of measured and read findings is a figure that lies about the reading.

## Output

Lead with the table, then one detail block per file carrying a finding:

```markdown
Code health: `<scope>`, <n> files with a finding.

| File          | File length | Functions | Comments | Inline code |
| ------------- | ----------- | --------- | -------- | ----------- |
| `src/path.ts` | long        | 2 long    | block    | ok          |

File length, function length, comment counts, and strings are measured. Long blocks, folder roles, and whether a comment belongs are readings.
```

A cell reads `ok`, the finding's short name, or `unread`. Each detail block names the line, the figure, the checkpoint from the record, and the route. Keep the evidence line under the table on every run.

### The folder lines

Add one line per code folder holding two roles, after the table, naming the folder, its file count, the roles, and `codebase-layout` as the owner of the split:

```markdown
Folder `src/commands/`: 39 files holding two roles, <role> and <role>, because <reason>. `codebase-layout` places the split.
```

### The trend section

Add the trend section last, read per `${CLAUDE_SKILL_DIR}/references/trend.md`. It is context for the table rather than a sixth axis, and it carries no verdict. Write `Trend unread: <cause>` in its place when the history verb refused or the binary carries none.

### The next step

Close on one line naming `plan-intake` as where the findings go when the operator wants to act on them. Invoke nothing, since filing a finding is a decision the operator has not made.
