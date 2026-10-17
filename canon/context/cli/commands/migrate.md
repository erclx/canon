---
title: Migrate verbs
description: The ordinal claim, and the rename and surface-root migrations that rewrite a repository with a tested verb rather than a scripted pass
---

# Migrate verbs

## Decisions

### Ordinal claims

`canon records ordinal --claim` (`src/records/ordinal.ts`) serializes the two record kinds sharing one ordinal sequence, `intake` and `groundwork`. It closes the race that gave two sessions the same number for two different folders the same day.

A leaf `mkdir` on the kind's own folder is not enough, since the two kinds' leaf directories never share a path and never collide.

### The reservation comes first

The verb reserves the number at a path an `intake` claim and a `groundwork` claim resolve to identically, then creates the kind's leaf folder once the reservation is won. It retries past a losing reservation up to a fixed bound, then refuses as `ordinal-contended`.

### `canon migrate rename`

It is the second verb under a records-shaped contract and the first whose corpus is the repository itself. It holds the token map, the protected forms, and the exclusion set in `src/migrate/`, and reports until `--write` is passed.

`--scope self` covers every tracked file. `--scope target` covers the toolkit-owned folders alone and reports what it declined to touch as citations, rather than rewriting prose a project wrote.

### The exclusion set is not a preference

The tool's own token map, the tests naming both spellings, the changelog, and the eval transcripts each state something about the rename rather than using the old name. Rewriting any of them destroys what it is for.

A second run over a renamed tree rewriting zero tokens proves the set complete, since a non-zero count names what is still unguarded.

### A tested verb, not a scripted pass

A shell stream editor invites a one-time pass, and a non-match exits clean. Code separates four overlapping forms a single expression flattens. `@erclx/aitk` had to move, `erclx/aitk-sandbox` had to stay, and the second contains the first.

### Strings that name something the world holds

The verb cannot decide which strings name something already held elsewhere, such as `legacyStampPath`, the machine state directory, and `AITK_NON_INTERACTIVE`. A `canon-keep-retired` marker on the line or the one above holds each.

- The idempotence run caught what the marker missed at 23 tokens, then read 0
- Nothing keeps the exclusion list current, so a retired spelling added later is guarded only if its author remembers the marker
- Measured at `dc1ddb2d` on 2026-08-31, over 3,403 rewrites across 617 files with 24 paths moved and 11 occurrences protected

### Two presets

The engine takes its map, its protected forms, and its exclusion set as a rules object rather than module constants, so `src/migrate/` compiles two presets and `canon migrate skill-names` runs the second.

`aitk` is a word stem that legitimately carries a suffix, as in `aitk-allow-superseded`. A skill name is a whole name, so only the second asks the scanner to stop where the word ends.

### The word boundary mattered

Running the skill preset without it moved `wiki/claude/claude-worktrees.md`, a page about the harness feature in a folder where every sibling is named for a Claude Code concept, and rewrote sixteen citations of it.

### Alternation order is reported

`tokenOrder` reports the ordering. `plan-intake` sits inside `plan-intake-answer`, and both rows land on a name opening with `plan-intake`, so reading the order off the rewritten string reports a pass whichever way the alternation was built. <!-- canon-keep-retired -->

### The keep marker goes at line end

In markdown, put the marker at the end of the line it protects as an HTML comment. The formatter inserts a blank line between a standalone comment and the paragraph under it, so the marker stops being the line above and the next run rewrites the paragraph. A second dry run after formatting catches it.

### Rename output

Both presets emit their record to stdout before `applyRename` runs. A caller piping stdout into a truncating reader kills the process between the two, leaving the record reading `wrote: true` over a partial apply.

Observed at 2 files changed out of 273 against a record claiming all 273, recovered by resetting and re-running with nothing on the other end of stdout.

### Reporting ahead of applying is the contract

The record describes the plan, and a dry run has to emit the same shape, so what is exposed is the pipe. Redirect the record to a file or let it reach the terminal, and never read it through `head`.

### `canon migrate surface-roots`

`src/migrate/surface-roots.ts` moves the tracked surfaces from `.claude/` to `canon/`, borrowing from both siblings.

- The citation classifier is `records.ts`'s, carrying the keep marker, the frontmatter glob hold, the cross-repository prefix, and the dated-paragraph read
- The write is `applyRename`'s, since every moved path is tracked and `git mv` keeps a file's history attached
- One planner judges each source for both halves at once, whether its path sits under a moved entry and whether its content cites one, so the halves cannot disagree

### The dated-paragraph read matters more here

`ARCHITECTURE.md` was itself a moved entry and carried dozens of `Measured at` paragraphs naming the old root as what was true on their date.

### No test file is excluded by suffix

Most `src/` tests naming a surface path use it as fixture data, so a suffix ban would have left them building a root the tree no longer uses while passing through the fallback.

Four fallback tests still collapsed and were restored by hand under `canon-keep-surface-root`. A sweep over tests owes a scan for both failure modes. Measured at `c947c27f` on 2026-09-13.

### The sweep reads spelled text only

A path built with `join('.claude', ...)` or a template string survives it untouched. Grep for joined spellings afterward, which reached `src/design/regen.ts` and `src/docs/read.ts`.

### A dated hold keeps live pointers too

The context citation gate then reports a live pointer as unresolved once its file has moved. Rewrite a sentence that points a reader at a file, and mark a sentence recording what a path was at the time with `audit-ignore-citations` naming that path.

### Fixture rewrites collapse fallback tests

A rewrite turns a fallback test into a copy of its new-root neighbor, which keeps passing while covering nothing. Scan the rewritten tests for adjacent duplicate lines and for tests named after the old root, and restore the old spelling under the keep marker.
