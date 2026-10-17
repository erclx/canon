---
title: Superseded-value sweep
description: The canon gov superseded sweep, its key, its corpus, the replacement annotation, and the derived stem that reaches a family of names
---

# Superseded-value sweep

## Decisions

### Why a separate report

`canon gov superseded <old> <new>` is the one report here the aggregate cannot run. It takes the two values as required arguments, so no unattended invocation exists for `canon audits run` to schedule and no baseline count exists to retain.

### The shared value is the key

A file-scoped map from a changed rule to what cites it reaches nothing, because a fixture asserting an old output names neither the rule nor the standard behind it. The value both sides carry is the only shared key there is.

### Where the verb sits

It sits under `gov` beside `test-order`. Both measure a stated convention against the tree, and a session reaching for one finds the other.

`standards` was the alternative, and its argument slot prints a document, so a sibling subcommand there reads as a standard name.

### The corpus is the whole tree

The corpus is every tracked file plus untracked files git does not ignore. A fixture is the cheapest place for an assertion to go stale and not the only one, and a sweep scoped to `sandbox/` would be read as covering the class.

### Over-reporting is the design

A string appears for reasons unrelated to any convention, which is why the verb reports and why a same-line replacement annotates a finding instead of suppressing it. A fixture halfway through a repair carries both values and so does the line stating the change, and nothing here tells them apart.

### The annotation strips before it tests

A convention dropping a segment leaves the new value a substring of the old one, so a plain containment test answers true for every finding. The annotation strips the superseded occurrences before testing the line.

Measured on the slug transform, where `feature-` sits inside `feature-feat-`, the flag fired on all 20 findings before the strip and on 6 after.

### The strip covers one direction

A rename extending a name rather than shortening it inverts the problem. Stripping the old value from a line already carrying the new one leaves nothing for the containment test to match, so the annotation never fires.

Measured on `cli-script` to a longer name carrying it, every finding carried the replacement and none was annotated, while `toolkit-sync` to `canon-sync` annotated correctly on the same run. A reader meeting an all-bare report checks whether the new name contains the old one before treating any line as stale.

### An empty replacement is allowed

It answers false rather than running the containment test. Retiring a value outright is an ordinary reason to run this, and a test against the empty string is true everywhere, so the two together reported every finding as carrying a replacement that does not exist.

### `isBinary` sits in `src/sweep/binary.ts`

Both sweeps read the same corpus and neither owns a predicate about bytes. Leaving it in the secret scan that shaped it put a `src/gov/` dependency on the scanner, the tree's only cross-domain import of it.

### Blind spots are stated each run

One declaration went stale by citing the wrong standard for the transform and carries no value to key on, so the sweep closes most of this class and none of that one.

### A citation the pattern never matched

The third blind spot is one a literal comparison creates. A family written as `canon-*` or `internal-<X>` carries neither value, so a rename across sixteen folders, run once per name, found two real leftovers and reported clean over seven stale citations.

Two of the seven had inverted, stating the old prefix as a guard. That is worse than drift sitting unread, since a rule reading backwards fires on the next author.

### The stem is derived

A list of names cannot reach that class by construction. The stem cuts at the segment the two values differ on and carries everything they share ahead of it.

- `toolkit-sync` to `canon-sync` derives `toolkit`
- `canon-cli` to `canon-shell` derives `canon-cli`
- An empty replacement derives nothing, since a retirement leaves no second value to diverge from

The shared prefix alone reports the whole family on a rename of one folder, since `canon-cli` and `canon-feedback-file` share `canon`.

### Three forms report

The character after the stem and its separator decides all three, so one scan reads a glob, an angle-bracket placeholder, and the family written bare.

What bounded the bare form is the left edge. A separator directly before the stem puts it mid-name, as in `canon-check-toolkit-`, and four `mkdtemp` fixtures reported under it before that guard. A path separator or a backtick has to keep matching, so the separator decides one side only.

### The hit rate to hold to

A real rename over this tree names a small number of hits outside the change's own fixtures. A version reporting a page of hits teaches the next rename to skip the verb.

### A hit carries its heading

In a markdown file a hit carries the nearest heading above it. `Use the canon-* prefix on an internal skill` sits under `## Must not` and is a prohibition there, which a bare-line read would misread as an instance.

Reading a rule body differently from prose was declined, since the inverted-guard case is two instances rather than a class with a measured rate. The report carries the section and the reader judges.

### The exemption marker

`canon-allow-superseded: <reason>` mutes a line, reading the same two-line placement rule as `canon-allow-secret` through `src/sweep/exempt-marker.ts`. The duplication that extraction removed was exact, and only the token differs.

### The first measurement

Measured against `d7ea41a4`, sweeping `feature-feat-` to `feature-` named line 66 of the scenario now at `sandbox/claude/auto-ship.sh` and nothing else, matching the hand derivation. The verb ships against a nearly clean corpus, so its value is the regression it stops rather than the backlog it surfaces.
