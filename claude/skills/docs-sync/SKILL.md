---
name: docs-sync
description: Rewrites stale `README.md` and `docs/*.md` sections based on changes since main. Use before staging, or when asked to "sync the public docs", "update the docs in docs/", or "update the README". Do NOT use for the `.claude/` planning surface, which `docs-fold` owns, or for changelog and `CLAUDE.md` updates.
---

# Docs sync

Read these files in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: punctuation and formatting for all generated text
- The `write-human` skill: voice, rhythm, and sentence construction for all generated text
- `${CLAUDE_SKILL_DIR}/../../standards/readme.md`: README structure, required sections, and content rules
- `${CLAUDE_SKILL_DIR}/../../standards/docs.md`: the reader a page under `docs/` serves, its frontmatter, structure, and what it links out rather than carrying

## Diff baseline

Resolve the base ref once and reuse it in Context and in Guards:

```bash
git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null
```

Prefer `origin/main` over local `main`. On `main` itself the local ref resolves to HEAD, so every committed change drops out of the set and the skill reports nothing to sync rather than admitting it cannot see the work.

The baseline is unusable in two cases:

- No merge base resolves against either ref.
- The base equals HEAD, whichever ref resolved it. Nothing is committed ahead of the base to compare against. This is the ordinary shape on `main`, and on a feature branch before its first commit.

An unusable baseline costs only the committed half. `git diff --cached <base>` degrades to the staged set and `git status --short` still reports the working tree, so both reads stay at this skill's own scope. Say so in the preview with `⚠ Baseline unusable. Synced against the uncommitted set only.` The base ref is the only thing this change touches, and the `--cached` scope stays.

## Context

Run these commands in parallel:

- `git diff --cached <base> -- . ':(exclude)*.lock' ':(exclude)*-lock.json' 2>/dev/null || echo "NO_DIFF"`
- `git diff --cached --name-only <base> 2>/dev/null || echo "NO_FILES"`
- `git status --short 2>/dev/null || echo "NO_STATUS"`

## Guards

- If `git diff --cached <base>` output is empty and `git status --short` output is empty, stop: `❌ No changes since main. Nothing to sync.` Resolve the base ref first. A guard reading bare local `main` stops the skill on `main` before it reaches the corrected read.

## Discovery

Discover docs dynamically. Do not hardcode paths:

- Glob `README.md` at project root
- Glob `docs/**/*.md`

Read each discovered file in parallel.

## Analysis

For each discovered doc, classify as one of:

- `stale`: the diff touches something the doc describes
- `departed`: the doc records a deliberate contract and the diff broke it
- `unrelated`: no overlap between diff and doc content

The split between `stale` and `departed` is whether the doc was describing or promising. A doc that trailed the code is `stale`. A doc stating a contract the code was meant to keep is `departed`, and rewriting it to match the diff would record the regression as the contract.

Classify at the section level, not the file level. A doc edited earlier in the session can still be partially stale. For each diff surface, verify the corresponding section is synced.

## Action

Rewrite only the stale sections. Do not touch sections unrelated to the diff.

Write the updated file immediately after the preview. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

Never rewrite a `departed` section. Leave it as written and report it as a finding, since the repair belongs in the code rather than in the prose.

## Response format

### Preview

**Changes since main:** `<n>` files
**Docs discovered:** `<list>`

| Doc         | Status    | Action |
| ----------- | --------- | ------ |
| README.md   | stale     | update |
| docs/cli.md | departed  | report |
| docs/api.md | unrelated | skip   |

After outputting the preview, write all stale updates immediately.

### Summary

One line per file, using the same relative path format as the preview table (e.g. `README.md`, `docs/api.md`):

```plaintext
✅ Updated: <relative-path>
⏭️  Skipped: <relative-path>
⚠️ Departed: <relative-path> records <the contract>, and the diff <what it did>. Left unwritten.
```
