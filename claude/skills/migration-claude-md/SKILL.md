---
name: migration-claude-md
description: Classifies each section of a target project's bloated `CLAUDE.md` into the three-tier context model and proposes moves to path-scoped rules or context entries, keeping only always-load behavior in `CLAUDE.md`. Use when asked to "slim CLAUDE.md", "migrate CLAUDE.md to rules", "rebalance CLAUDE.md", or when a project's `CLAUDE.md` has grown large. Do NOT move `docs/` files (that is `migration-context`) and do NOT auto-execute. Proposal only.
---

# Claude md migrate

Rebalance a large `CLAUDE.md` so only always-load behavior stays in it, path-scoped behavior becomes a rule, and domain narrative becomes a context entry. Every move is a proposal the user applies by hand.

Run `migration-context` first when both apply. Its moves populate `canon/context/`, and Step 3 has to read the folder those moves left so an existing entry resolves to an append rather than blocking the move that should have created it.

A project the surface move has not reached keeps its context folder under `.claude/` rather than `canon/`. Read and propose entries into whichever root already carries the folder, and propose `canon/` only when neither does, since a new `canon/` folder would hide every entry the old one holds.

## Guards

- If no `CLAUDE.md` exists at `pwd`, stop: `❌ No CLAUDE.md found at the project root.`
- If `CLAUDE.md` has fewer than three `##` sections, stop: `✅ CLAUDE.md is already lean. Nothing to rebalance.`

## Step 1: discover

Run these in parallel from `pwd`:

- Read `CLAUDE.md`
- `ls .claude/rules/ 2>/dev/null`: existing rule subdirs and numbers for placement
- `ls canon/context/ 2>/dev/null`: existing context entries for conflict checks
- `canon claude seeds list --json 2>/dev/null`: the base seed set. Read the `CLAUDE.md` entry's `content` as the always-load baseline. Skip this input when `canon` is not installed.

## Step 2: classify each section

Split `CLAUDE.md` by `##` heading. Score each section against this order:

1. **Always-load.** Stays in `CLAUDE.md`. Signals: cross-cutting behavior that applies every session, output and formatting rules, project-wide invariants, conventions with no file scope. A section that matches the seed baseline is always-load by definition. Keep it and propose no move.
2. **Path-scoped.** Propose a rule. Signals: behavior that only applies when working in a folder (`frontend/`, `backend/`) or on a file type, framework-specific conventions, "when editing X do Y" phrasing. Derive the glob from the named scope.
3. **Domain narrative.** Propose a context entry. Signals: prose describing how a system or domain is built, decisions, gotchas, structure. Not do-or-do-not rules.
4. **Mixed.** Both rule and narrative in one section. Flag as "needs manual split". Do not propose a single target.

## Step 3: resolve targets

For each section proposed for a move:

- Path-scoped: propose `.claude/rules/<subdir>/<n>-<slug>.md` with a `paths:` glob. Pick the subdir and a free number the way `create-rule` does. If `.claude/rules/<subdir>/` already holds a rule on the topic, mark as "conflict" and skip.
- Domain narrative: propose `canon/context/<domain>.md`. If the entry already exists, flat or as a same-named `canon/context/<domain>/` folder, propose appending to the file that owns it rather than creating a duplicate flat entry beside a domain already split.

## Step 4: output

Print one grouped proposal block. Omit empty groups.

```markdown
## Keep in CLAUDE.md

- `## <heading>` (<one-line reason: always-load behavior>)

## Extract to a path-scoped rule

- `## <heading>` → `.claude/rules/<subdir>/<n>-<slug>.md`, paths `<glob>` (<reason>)

## Extract to a context entry

- `## <heading>` → `canon/context/<domain>.md` (<reason>)
- `## <heading>` → `canon/context/<domain>/<sub-area>.md`, appending to the domain's existing sibling file (<reason>)

## Needs manual split

- `## <heading>` (rule and narrative mixed)

## Conflicts

- `## <heading>` → `.claude/rules/<subdir>/<n>-<slug>.md` already exists. Skipping.

## Reminder

Scaffold each rule with create-rule, which carries the rule standard.
Follow the context standard for each new context entry.
Run canon indexes regen after adding context entries.
```

If every section classified as always-load, output: `✅ CLAUDE.md holds only always-load behavior. No moves proposed.`

Do not edit `CLAUDE.md`, and do not create the rule or context files. The user reviews the proposal, then applies each move by hand.
