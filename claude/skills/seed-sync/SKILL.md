---
name: seed-sync
description: Audits a project's installed Claude seed docs against the toolkit's current seed source and proposes per-section edits without overwriting customizations. Use when asked to "sync seeds", "update my seeds", "check seed drift", "did the toolkit seeds change", or when reconciling `CLAUDE.md` and `.claude/` preambles after an upstream toolkit update.
---

# Seed sync

Surfaces drift between the toolkit's current seed docs and what was installed in this project, then proposes targeted edits. The CLI emits seed content. This skill diffs, reasons, and writes the proposal to a review file. It does not write target files until the user confirms.

## Guards

- If the `canon` CLI is not on PATH, stop: `❌ canon CLI not found. Install the toolkit first.`
- If no `.claude/` directory exists at the project root, stop: `❌ No .claude/ directory found. Run canon claude init first.`

## Step 1: read toolkit sources and the drift report

Run both in parallel from the project root:

```bash
canon claude seeds list --json 2>/dev/null
canon sync --check . --json 2>/dev/null
```

Seeds emit an array of `{name, source, target, content}`, where `target` is the path relative to the project root where the file installs.

Seeds are the whole subject. No standard installs into a project, so there is no installed copy to audit and nothing to reconcile against the corpus. A standard a session needs is read with `canon standards <name>`, which resolves against the copy inside the package.

### Narrow the set by attribution

The report is what separates a file the project edited from one the toolkit moved on without it. Read `seeds.entries` for seed paths.

Keep every seed regardless of state. `CLAUDE.md` is the file a project edits most, and its `drifted` verdict is the case this skill exists for.

Read the `canon-cli` skill before naming a sync command in the output. It states which surfaces a sync overwrites, merges, or writes once.

Fall back to the appearance heuristic in step 3 when the report cannot attribute, which is `historyUnavailable` set on the relevant section or the command failing outright. Say so in the summary block, because a fallback audit reports guesses rather than facts.

## Step 2: read installed copies

For each entry in the merged list, read the file at its `target` path from the project root. Run reads in parallel.

Mark missing files for **Add** treatment. Skip non-text seeds (`.json`) for section diffing. Record a one-line note in the scope table that the user can compare manually.

When detecting target-only files for `local-only` flagging, skip files the toolkit's own walkers regenerate from sibling frontmatter (today: any `index.md` produced by `canon indexes regen`). They are absent from source catalogs by design, so flagging them as `local-only` is a false positive.

Note on `settings.json`: the seed now ships only the PostToolUse hook block. If a target project's `.claude/settings.json` carries `attribution` or `permissions` keys, those are stale: the user-level `~/.claude/settings.json` (installed via `canon claude setup`) owns them now. Flag those keys in the scope table for removal rather than diffing them as content drift.

## Step 3: diff per section

For each seed file present in both sides, parse the body into a preamble (everything between H1 and the first H2) plus one part per `##` header, then compare part by part. Treat the preamble as a single unit with the same verdicts as a section. Use `(preamble)` as its label in the proposal.

- **Identical:** ignore.
- **Toolkit-only section** (present in source, absent in target): candidate to **Add**. Number it whatever the file's own verdict is. The verdict rules below govern a section present in both, and a section the project never had cannot be the customization a `drifted` file is being credited with. A pass that reads the file-level verdict first proposes nothing on a target missing eleven sections, which is the shape this bullet exists to catch.
  - A deliberate removal reads the same as one that never arrived, and no decline is carried between runs, so a section the user skips is proposed again on the next branch. Say so beside the item rather than letting a reader meet it a third time wondering. The way to settle it for good is to keep the heading and write the project's own content under it, which moves the section onto the drifted path below, where the customization rule protects it and stops numbering it.
- **Target-only section** (present in target, absent in source): preserve, never propose removal. These are user customizations.
- **Drifted section** (present in both, content differs): candidate to **Update**.
  - Read the file's verdict from the report rather than judging it by eye. `drifted` means the content matches no version the toolkit ever published, so the project wrote it: call it **Customized**, default to skip, record in the scope table only, never numbered.
  - `stale` at the file level means the toolkit moved and the project did not, so any section differing inside it is **Stale**. Default action: propose update.
  - Only when the report could not attribute the file, judge by appearance: a version carrying extra bullets, project-specific paths, or filled-in placeholders reads as **Customized**, and one reading like the original toolkit text reads as **Stale**. Mark every verdict reached this way as unverified in the proposal.

The user judges intent. The skill makes the judgment legible.

### Absorbed-already check

Before proposing an Update, grep the target section for the seed text's keywords. If the rule is already implied by an adjacent bullet in the target version, drop the proposal and record the section as `in sync` in the scope table.

## Step 4: write the proposal to the review file

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. Fall back to `latest` on an empty result.

Write the full proposal to `.canon/review/seed-audit-<slug>.md` at the main worktree root. Do not print the proposal inline.

The proposal is a main-root write, so it goes out as a heredoc, routed the way `session-worktree` states.

Structure: a summary block at the top, a legend, a scope table, then one H2 per numbered item. Number items across all files so the user can reference them by number. Fuse the status, action, and target into each H2. Every item starts as 📝 pending.

````markdown
# Seed audit: <slug>

**Pending:** <all numbers>

Legend: ✅ applied · ⏭ skipped · 📝 pending

How to respond: fill in `Decision:` per item (`apply` or `skip`), then ping. Chat shortcut: `all`, `none`, or a list of numbers.

## Scope

Mark target-only files (present in target, absent in source) as `local-only` and leave them untouched.

| Source | File       | Status     | Note                         |
| ------ | ---------- | ---------- | ---------------------------- |
| seed   | `<target>` | diffed     | <counts>                     |
| seed   | `<target>` | in sync    |                              |
| seed   | `<target>` | skipped    | non-text, compare manually   |
| seed   | `<target>` | customized | <section> skipped by default |
| seed   | `<target>` | local-only | not in toolkit, preserved    |

## 1. 📝 Update → `<target-path>` / <section>

Why: <one-line reason>

``​`diff

- <project line removed>
  <unchanged context line>

* <seed line added>
  ​```

Decision:

## 2. 📝 Add → `<target-path>` / <section>

Why: <one-line reason>

``​`diff

- <seed section body, each line prefixed with +>
  ​```

Decision:
````

Update items show both sides in one `diff` block: removed lines from the project version with `-`, added lines from the seed version with `+`, unchanged context lines without a prefix. Add items show only `+` lines. Customized sections appear in the scope table only, never numbered. A file with no drift still appears in the scope table as `in sync`.

After writing, tell the user `✅ Wrote proposal to .canon/review/seed-audit-<slug>.md`. Ask them to fill in `Decision:` per item, then re-ping or use the chat shortcut.

Rewrite the review file in place whenever the proposal changes mid-review. The file stays the source of truth for the current decisions.

## Step 5: apply

Re-read the review file as source of truth. For each item, parse `Decision:`:

- `apply` (or affirmative): run the `Edit`, flip emoji to ✅.
- `skip`: leave the target section as-is, flip emoji to ⏭.
- `defer` or empty: leave 📝 pending, no action.
- Contains `?` or unrecognized verb: leave 📝 pending, no action.

Chat shortcut: the user replies with `all`, `none`, a comma-separated list of numbers, or `skip <nums>`. Write the matching verb into the `Decision:` slot of every item the reply names, `apply` for `all` or a bare list and `skip` for a `skip` reply, then run the parse above against the file. A reply of `none` writes nothing. A slot the reply does not name keeps its own value, so the receipt stays the source of truth and an empty slot still means take no action.

Apply edits one at a time via `Edit`, replacing one section at a time. Never rewrite a whole file. Claude Code's tool permission dialog is the confirmation gate per edit.

As each item resolves, update its status in the review file: flip the H2 emoji from 📝 to ✅ for applied or ⏭ for skipped. Refresh the summary block counts at the top. Do not delete the review file. It stays as a receipt until the next `seed-sync` run overwrites it or the user clears it.

## After completion

Output one line per action taken:

- `✅ Updated: <target-path> / <section>`
- `⏭ Skipped: <target-path> / <section>`

End with a one-line bucket summary: `✅ Applied: <nums> | ⏭ Skipped: <nums> | 📝 Pending: <nums>`. Omit empty buckets. If anything is pending, remind the user they can fill in a `Decision:` and re-ping, or commit a skip with `skip <nums>` in chat.

If the user accepted nothing, output:

`✅ No changes applied.`
