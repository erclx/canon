---
title: Superseded values
description: Reading where the tree still asserts a value a changed convention no longer produces, why the sweep keys on the value rather than the file, the family stem behind a templated citation, the exemption marker, the blind spots it cannot reach, and why it reports rather than gates
---

# Superseded values

`canon gov superseded <superseded> <replacement>` reports where the tree still asserts a value the convention behind it no longer produces. It answers the case a diff cannot: a convention changes, and the declarations testing it keep asserting the old form with nothing pointing at them.

```bash
canon gov superseded feature-feat- feature-
canon gov superseded feature-feat- feature- --json
canon gov superseded old-name new-name --root ../my-app
```

| Option          | Behavior                                                   |
| --------------- | ---------------------------------------------------------- |
| `--root <path>` | Tree to read, defaulting to the current directory          |
| `--json`        | Add a machine-readable record on stdout, keeping the frame |

Under `--json` the record holds stdout alone and the frame still renders on stderr, refusals included, which is the split `output-shape.md` fixes for every mode.

## Why the value is the key

A file-scoped map from the changed rule to what cites it reaches nothing here. A fixture asserting an old output names neither the rule nor the standard behind it, so the change that superseded the value touches no file the fixture can be found from. The value both sides carry is the only key there is.

The slug transform is what proved it. Dropping the type segment left four fixtures and three scenario scripts asserting the type-carrying spelling. One surfaced as a red sandbox arm, which named a failing scenario rather than a stale declaration, and the other six were found by deriving from the rule rather than by anything reporting them.

## What it reads

The whole corpus git lists: tracked files plus untracked ones git does not ignore. The untracked half keeps a file added on this branch in scope rather than one push later.

Matching is a literal substring, for the value and for the family stem below it alike, so either one carrying regular-expression characters means what it says. Every occurrence on a line reports under its own column, since a line carrying the value twice is two edits, and a column both kinds reach reports once as the literal one.

Binary files are skipped on a NUL byte rather than on an extension list, and so is any listed path that will not open. Both are counted. A run states the files it opened against the files git listed, because a count of what passed reads as a verdict on the repository unless it also says how much it left out.

Pass an empty replacement to retire a value outright, as in `canon gov superseded feature-feat- ""`. Findings report the same way, none is annotated, since a line cannot carry a replacement that does not exist, and no templated form is read, since there is no second value for a stem to diverge from.

## The templated citation

A citation naming a family as a pattern carries neither value. `canon-*` and `internal-<X>` are the two forms this corpus writes, and a literal comparison matches neither, so a rename running the verb once per name reports clean while the family citations stay stale. Two such citations have inverted this way, stating the old prefix as a guard, which left a rule instructing the next session to flag the correct naming as a mismatch.

Beside the literal comparison the run matches a family stem, derived from the segment the two values actually differ on, with everything they share carried ahead of it. `toolkit-sync` to `canon-sync` derives `toolkit`, and `canon-cli` to `canon-shell` derives `canon-cli` rather than `canon`, which is what keeps a rename of one folder off every sibling in its family.

Three forms report, decided by the character after the stem and its separator:

| Form          | Shape        | What it names                      |
| ------------- | ------------ | ---------------------------------- |
| `glob`        | `<stem>-*`   | the family written as a pattern    |
| `placeholder` | `<stem>-<X>` | the family with a stand-in segment |
| `prefix`      | `<stem>-`    | the family written bare            |

The stem has to start a name. A letter, a digit, an underscore, or a separator directly before it means the stem sits mid-name, which is what a temp-directory prefix such as `canon-check-toolkit-` looks like, and a path separator or a backtick before it means a citation, which is what `claude/skills/toolkit-*` looks like.

A hit under any of the three counts as a finding and moves the exit code. A stale templated citation is as real as a literal one, and reporting it outside the count would recreate the silence being fixed one report shape further along.

Every hit in a markdown file carries the nearest heading above it. A line reads differently under the section holding it, and `Use the canon-* prefix on an internal skill` is a prohibition under `## Must not` and an instruction anywhere else. A reviewer reading that line without its heading made exactly that misreading against this tree.

## The exemption marker

A declaration disagreeing with a convention for a stated reason carries `canon-allow-superseded: <reason>` on its own line or the one directly above. The marker moves the line into the report's `Exempt` section, which is named rather than counted, so a reader weighing the report can reach the reason.

Only a marker naming a reason counts. A bare token is a line that meant to say something and did not, and honoring it would let a typo mute a finding. This is the `canon-allow-secret` shape, and both read the same placement rule through one helper.

## The blind spots

The sweep sees the value, its stem, and nothing else. A prose reference that went stale without carrying either is invisible here, which is not hypothetical: alongside the mechanical instances, one declaration had gone stale by citing the wrong standard for the transform, and it matches no string this sweep could have been given.

The second is a family written in a form the three shapes do not read: a bracket style other than `<>`, a glob with no separator ahead of it, or the family described in words. Adding a form is a change to the classifier rather than a name a caller can pass, since a list of names cannot reach this class by construction, which is the whole finding behind the stem.

A value sweep closes most of the first class and no part of either one. The help text and the frame name both on every run, so a clean report is not read as a clean tree.

## The false-positive rate

Over-reporting is the design here as it is for the literal half, and the corpus bounds it. Sweeping the retired `toolkit-` prefix over this tree named one templated hit outside the change's own fixtures, a passage recording the retired `toolkit-` prefix as history, which reads correctly in place.

A version reporting a page of hits teaches the next rename to skip the verb, which is worse than the blind spot being fixed. Read a report against that rate rather than against zero.

## Exit codes

Exit codes are `0` when nothing asserts the superseded value or its family, `1` for a refusal, and `2` for at least one finding of either kind. It refuses an empty superseded value, which would match every line rather than a convention, a superseded value equal to its replacement, which means no convention changed, and a tree git cannot list, since an empty list passes each of its zero files. An empty replacement is not among them, because retiring a value is an ordinary reason to run this.

Nothing wires this into `bun run check` or into a hook. A value sweep over-reports by construction, and gating a measure carrying a known false-positive class is what teaches contributors to route around the stage. `canon gov test-order` is the sibling precedent.

An exit code says nothing about a call made from a session, since a shell profile may wrap the binary in a function taking its status from a later command. Read the JSON record's `findings` array rather than the exit when a skill consumes this.
