---
name: document-repair
description: Rewrites a project's markdown to the density limits one failing folder at a time, re-audits each to zero, and gates it through `canon markdown gated add` so it cannot drift back. Use when asked to "repair the docs", "bring the docs under the limits", "fix the density findings", "gate this folder", or after `document-health` reports a length finding. Do NOT use to report rot without repairing it, which is `document-health`, or to fix a banned character or a dead link alone, which the audit names directly.
metadata:
  family: upkeep
---

# Document repair

Brings an older project's markdown under the density limits one folder at a time and gates each folder as it reaches zero. `document-health` names a length finding and stops, and the edit hook fires only on a file being touched, so a folder nobody edits stays over the limits forever. This skill closes that.

The CLI holds every number. `canon markdown audit` measures, and `canon markdown gated add` refuses a folder with any finding left, so this body names the verbs and restates no limit.

## Guards

- `canon` absent from the path: stop. `❌ canon is not on PATH, so nothing can be measured or gated.`
- The audit refusing: stop and name its `reason`. A `malformed-config` refusal names the file to fix by hand, since the verb will not append to a file it cannot read.
- `gated add` refusing with `canon-checkout`: stop. Canon's own checkout gates through a constant in its source, which a code change edits.
- Branch on each record's own fields rather than on an exit status a shell wrapper can flatten. A call with no terminal on stdin already runs headless, so no command takes a prefix.

## Step 0: offer the restructure

Restructure an overgrown context folder before rewriting it, so the effort is spent once. Run this step only when `canon/context/` is a candidate, and skip it silently otherwise.

- Take the structure line `document-health` reports for each area folder, or read it from `canon context audit --json` the way that skill does
- A folder with no overgrown entry and no doubled or unnamed coverage finding has no line, so go straight to Step 1 with no prompt
- Show the operator each proposal and ask before applying it, since a split moves files other entries cite. Re-run the audit afterward to confirm the citations still resolve.
- Take a declined proposal as a decision and rewrite the entry as it stands

## Step 1: read the audit

Run the audit over the whole tree and take the density and reference shape findings from its record:

```bash
canon markdown audit --json
```

When `canon/context/` is a candidate, read the context shape beside it and keep each entry's `shapeFindings` issues as the baseline Step 3 holds the rewrite to:

```bash
canon context audit --json
```

Take the candidate folders from the order table in `${CLAUDE_SKILL_DIR}/references/batches.md` rather than from the findings, since a clean folder carries no finding and would never be gated. Drop every folder `canon/config/markdown.toml` already lists, since a listed folder already gates.

Sort what is left in two. A candidate the findings never name needs no rewrite, so gate it through Step 4 before the first batch. Group the findings under the rest, which Steps 2 and 3 rewrite.

## Step 2: pick one folder

Take one folder per batch, per `${CLAUDE_SKILL_DIR}/references/batches.md`, which holds the size, the order, and the stop rule. Say which folder this batch takes and how many findings it carries before editing anything.

## Step 3: rewrite to zero

Load `markdown-craft` and `write-human`, then rewrite each failing block by its shape rather than by trimming characters. Split a long paragraph at its seam, put a heading or a table between paragraphs, give a long list H3s, and open each H3 with a sentence or a table.

Re-run the audit on the folder alone after each file:

```bash
canon markdown audit <prefix> --json
```

Read `${CLAUDE_SKILL_DIR}/references/batches.md` for what a rewrite may cut. A stated reason survives every rewrite, and the audit reaching zero cannot see one that went missing.

### Hold the context shape

For a file under a folder the context audit resolves, also re-run `canon context audit --json` and compare the entry's `shapeFindings` issues with the baseline. A density fix that splits a Layout paragraph into several can grow `layout-paragraphs`.

A rewrite leaving the entry with more shape issues than it started with is not done. Undo it, or fold the split into a table or a linked page, and report the entry as stopped when neither reaches the baseline. Zero density findings reached by growing shape findings only moves the failure.

## Step 4: gate the folder

```bash
canon markdown gated add <prefix> --json
```

Pass the prefix exactly as the batch named it: a folder with its one trailing slash, such as `docs/`, and a file by its bare path, such as `README.md`. The verb refuses a doubled slash and a slash after a file, since either matches nothing and would gate nothing.

Branch on the record. `action: appended` or `present` means the folder gates now. `reason: findings` means one is left, so return to Step 3 with the paths the record lists. Never edit the config by hand, since the verb is what holds the folder to zero.

### Requirements

A skill's `REQUIREMENT.md` gates only on its own path, never through a folder prefix, so gating `.claude/skills/` leaves each requirement reporting. Gate each one that reaches zero by its path:

```bash
canon markdown gated add .claude/skills/<name>/REQUIREMENT.md --json
```

## Output

One line per batch, then the folders left:

```markdown
✅ Gated `<prefix>`: <n> files rewritten, <m> findings cleared.
Left: `<prefix>` (<k> findings), `<prefix>` (<k> findings).
```

Name a folder the batch stopped short on with the findings still open, rather than reporting it gated.
