---
title: Skill path reference
description: Which root a file a skill body names resolves against, and how a body cites a standard
---

# Skill path reference

Applies to every path a skill body names, under `skills/<name>/`. A skill reads from two roots, so the path it writes decides whether the file is found once the skill runs from another project.

This is an attribute standard. It governs the path strings a body carries rather than a file of its own, so it carries no template.

## Scope

Governs how a `SKILL.md` body or a file under its `references/` names a bundled asset, an installed shared doc, or a standard.

Does not govern:

- The skill folder, its frontmatter, the body rules, and the choice between skill types: `skill.md`
- Punctuation, formatting, and word choice: `markdown.md`

## What a working path looks like

A path in a skill body works when the skill resolves it from any project it runs in:

- Does each bundled asset resolve against the skill's own directory rather than the session's working directory?
- Does each cited standard resolve in a target that installed nothing but the plugin?
- Does a procedure two skills share live in one place, with each body citing it?

A body failing any of these is non-conforming even when every path resolves in this repository.

## Path resolution

Know which root a file lives under before referencing it.

- Bundled skill assets (`references/`, `scripts/`, `assets/`) resolve against the skill's own directory. Reference them with `${CLAUDE_SKILL_DIR}/<path>`, never a bare relative path, which resolves against the session cwd and fails when a plugin skill runs from another project.
- Installed shared docs (`.claude/rules/`, `canon/context/`) resolve against the target project cwd, where install placed them. Reference them by that path.
- Do not hand-copy a standard into a skill. If a skill must carry its own copy, generate it from the single source and reference it through `${CLAUDE_SKILL_DIR}`, so one owner keeps every copy in sync.

## Citing a standard

No standard installs into a project, so a body cites one place rather than choosing between two.

- Cite `${CLAUDE_SKILL_DIR}/../../standards/X.md`. The plugin ships the whole standards folder beside `skills/`, so the path resolves in every install.
- Never cite `.claude/standards/X.md` from a shipped body. A target holds no such folder. <!-- audit-ignore-citations: .claude/standards/X.md -->
- Name `canon standards X` instead where the body wants the document rather than a path to open, such as a value it captures or reports. That verb resolves `standards/` at the project root and then the corpus inside the package.
- State the path once per body, at the site that reads the standard. A later mention of a standard the body already read stays bare, since repeating the path at every mention is noise rather than instruction.
- A guard on a standard's presence names the file rather than the folder holding it, since a folder test answers for a sibling that happens to be there.
- Use `${CLAUDE_SKILL_DIR}`, never a bare `../../` and never `${CLAUDE_PLUGIN_ROOT}`, since only the first expands before the body reaches the model.
- Cite a shared procedure, never restate it. A procedure two or more skills execute gets one definition in a standard and a citation in each body.
- Keep the trigger in the body and the procedure in the standard. The citing skill states when the procedure runs and what it runs against, since that varies per skill and the standard cannot know it.
