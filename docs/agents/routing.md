---
title: Routing report
description: Reading per CLAUDE.md section how many bullets name a path, what counts as naming one, when a rule counts as covering it, the two refusals, and why the verb reports rather than gates
---

# Routing report

`canon claude routing` reports, per `CLAUDE.md` section, how many top-level bullets name a path and how many of those a path-scoped rule already covers. It answers the firing axis of the tier test in `.claude/rules/canon/claude/592-claude-md.md`, whether a fact applies every session or fires on one path, and which until this verb existed was a judgment nothing counted. The tier test names two further axes, conditional presence and updatability, that this verb does not check.

```bash
canon claude routing
canon claude routing --json
canon claude routing ../my-app
```

| Option   | Behavior                                                     |
| -------- | ------------------------------------------------------------ |
| `[path]` | Repository root to read, defaulting to the current directory |
| `--json` | Add a machine-readable record on stdout, keeping the frame   |

Under `--json` the record holds stdout alone and the frame still renders on stderr, refusals included, which is the split `output-shape.md` fixes for every mode.

The root is the argument rather than the toolkit, matching the reach and drift verbs, so a linked worktree reads its own branch and a target reads its own file.

## What it reads

Every H2 and H3 owning at least one top-level bullet. An H3 is reported under the H2 containing it, as `Behavior / Scope discipline`, so a section and its subsections are counted apart rather than summed.

Three things are read past. A nested bullet belongs to the one above it rather than to the section. A bullet inside a fenced block is example text rather than instruction. A heading carrying no bullet answers nothing the report asks, so it is dropped rather than listed at zero.

## What counts as naming a path

A bullet is path-scoped here when it names a path. That is evidence for the tier judgment rather than the judgment itself, and the gap runs both ways: a bullet naming a folder can still apply every session, and one firing on a path it never spells is invisible to the count. Read a section's number as a place to look rather than as a verdict on it.

A backticked token counts when it carries a separator or an alphabetic extension, which admits `src/cli.ts` and `cspell.json` while leaving a flag, a bare word, and a version string out.

A shape counts as the folder above its placeholder. `canon/context/<domain>.md` names `canon/context/` and nothing narrower, so dropping the token whole would report the section carrying it as naming no path at all. A placeholder opening the first segment has no openable prefix and is dropped.

## When a rule counts as covering it

A rule covers a named path only when its glob anchors to a location. A glob opening `**` reaches every folder in the tree, so it answers that a file type is governed and never that a named path is.

The corpus-wide markdown rules are what force that. Counting one reports every markdown path as covered, which collapses the column to a constant and tells a reader nothing about which folder somebody actually scoped a rule to.

A folder is probed with a handful of extensions rather than matched literally, because a glob narrowed by file type reaches under a folder without ever matching the folder's own name. Globs are read from each rule's frontmatter block alone, so a rule quoting a path in its body does not register a scope it never declared.

The paths a section names that no rule reaches are listed beside it, which is where a reader looks first when deciding what a new rule would cover.

## Refusals

Two, each naming what a reader does about it. `no-claude-md` is a tree with no always-loaded file. `no-rules` is a tree carrying no path-scoped rule under `.claude/rules/`, where every path would report as uncovered and the column would say nothing.

An always-on rule declaring no `paths` is skipped rather than refused. It applies at the same priority as the always-loaded file, so it covers no path in particular.

## Exit codes

Exit codes are `0` when the file was read and `1` for a refusal. No finding moves the exit code.

Nothing wires this into `bun run check` or into a hook. Whether a bullet belongs in a rule is a judgment, and gating a measure that counts a judgment forces an escape hatch for every deliberate case.

An exit code says nothing about a call made from a session, since a shell profile may wrap the binary in a function taking its status from a later command. Read the JSON record's `sections` array rather than the exit when a skill consumes this.
