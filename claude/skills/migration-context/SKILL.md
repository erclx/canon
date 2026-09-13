---
name: migration-context
description: Classifies markdown files in a target project's `docs/` folder and proposes `git mv` commands to relocate agent-flavored content to `canon/context/`. Use when asked to "migrate docs to context", "move docs to context", "split docs", or to align an existing project with the three-tier context model. Do NOT auto-execute moves or rewrite inbound links. Proposal only.
---

# Claude context migrate

Run this skill before `migration-claude-md` when both apply. That skill proposes entries into the same `canon/context/` folder, and an entry landing there first makes the corresponding move here read as a conflict and get skipped, which loses the richer `docs/` file.

A project the surface move has not reached keeps its context folder under `.claude/` rather than `canon/`. Read and propose moves into whichever root already carries the folder, and propose `canon/` only when neither does, since a new `canon/` folder would hide every entry the old one holds.

## Guards

- If no `docs/` directory exists at `pwd`, stop: `❌ No docs/ directory found.`
- If `docs/` contains no `.md` files at the top level, stop: `❌ No markdown files in docs/.`
- This skill operates on flat `docs/*.md` only. Subfolders under `docs/` are listed in the output as "manual review needed" and skipped.

## Step 1: discover

Run these in parallel from `pwd`:

- `ls docs/*.md 2>/dev/null`: list flat markdown files
- `ls docs/*/ 2>/dev/null`: detect subfolders for the manual-review note
- `ls canon/context/ 2>/dev/null`: detect already-migrated content for conflict checks
- `canon claude seeds list --json 2>/dev/null`: get the canonical seed list to identify seed-derived files

Read each discovered `docs/*.md` file in parallel.

## Step 2: classify

For each file, score against this rule order:

1. **Seed-derived.** Filename matches `development.md` or `ci.md` and content shape resembles the toolkit's base seed (frontmatter plus a Setup or Triggers section plus tables for scripts or checks). These belong to the seed-migration path. Do not propose a move here.
2. **Agent-flavored.** Score the following signals. Classify as agent-flavored when two or more match:
   - Dense file paths in code fences
   - Sections titled "Anti-patterns", "Layer responsibilities", "Conventions", or "Commands"
   - Tables of CLI commands
   - Explicit "do not" rules
3. **Human-only.** Default fallback when no agent signals match. Typical signals:
   - Tutorial prose
   - Sections titled "Welcome", "Getting started", "Contributing", or "Installation"
   - Second-person narrative aimed at new contributors
4. **Mixed.** Both agent and human signals present. Flag as "needs manual split". Do not propose a move.

## Step 3: check conflicts and inbound links

For every file proposed for a move:

- If `canon/context/<filename>` already exists, or a same-named folder exists at `canon/context/` with `<filename>`'s `.md` extension dropped, mark as "conflict" and skip the move. A folder of the same name is still a collision, since the domain already lives there split into siblings.
- Run `git grep -n "docs/<filename>"` (or grep equivalent) to list inbound references in `CLAUDE.md`, `README.md`, and other markdown. Report each as a TODO line. Do not rewrite.

## Step 4: output

Print one grouped proposal block. Omit empty groups.

```markdown
## Move to canon/context/

- docs/<file>.md → canon/context/<file>.md (<one-line reason>)

## Keep in docs/

- docs/<file>.md (<one-line reason>)

## Defer to seed-sync

- docs/<file>.md (matches toolkit base seed)

## Needs manual split

- docs/<file>.md (mixed agent and human signals)

## Conflicts

- docs/<file>.md → canon/context/<file>.md already exists. Skipping.

## Subfolders (manual review)

- docs/<subfolder>/

## Suggested git mv commands

git mv docs/<file>.md canon/context/<file>.md

## Inbound links to fix after moves

- CLAUDE.md:42 references docs/<file>.md
- README.md:17 references docs/<file>.md

## Reminder

Run canon indexes regen to update canon/context/index.md.
```

If every file classified as "Keep in docs/", output: `✅ All docs/ content is human-facing. No moves proposed.`

Do not execute the `git mv` commands. Do not edit `CLAUDE.md` or `README.md`. The user runs the commands and fixes the links manually after reviewing.
