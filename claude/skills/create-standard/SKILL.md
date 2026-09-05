---
name: create-standard
description: Creates a new standard file in `standards/`. Use when asked to "create a standard", add a standard, or write a new authoring convention. Do NOT use to edit an existing standard.
---

# Create standard

Creates one standard file. Read these files in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: banned words, punctuation, and formatting for all generated text
- The `write-human` skill: voice, rhythm, and sentence construction for all generated text
- `${CLAUDE_SKILL_DIR}/../../standards/standard.md`: the meta-standard for shape, frontmatter, and structure

## Steps

1. Draft the content from the user's description. The meta-standard governs frontmatter, headings, and structure.
2. Confirm the slug and full content with the user before writing
3. Write the file to `standards/<slug>.md`, creating the folder when it is absent

`standards/` is the one write surface. It is the toolkit's authoring source in this repository and a project's own folder anywhere else, and both are the root `canon standards <name>` resolves against first. No corpus installs into a project, so there is no second surface to pick between and no guard on a folder the skill can create itself.

## After writing

Emit the full path on its own line.

- In the toolkit: this is the authoring source. Remind the user to run `bun run check` to regenerate the consumed copy under `.claude/`. That pass also regenerates the `standards/index.md` entry, and the user adds a row to the standards table in the toolkit's own context entry for standards.
- In a project: the file is project-local and no toolkit command touches it. Remind the user to copy it to the toolkit repo, under `standards/<slug>.md`, if it should ship to every project.

Separate the two by whether the folder already held toolkit-authored standards before this write, since a project authoring its own uses the same path.
