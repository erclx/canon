---
name: create-snippet
description: Creates a new snippet file in `snippets/` or `.claude/snippets/`. Use when asked to "create a snippet", add a snippet, write a reusable prompt, or make a new snippet. Do NOT use to edit an existing snippet.
---

# Create snippet

Creates one snippet file. Read these files in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: punctuation and formatting for all generated text
- The `write-human` skill: voice, rhythm, and sentence construction for all generated text
- `${CLAUDE_SKILL_DIR}/../../standards/snippets.md`: authoring conventions, invocation channels, use patterns

## Guards

- If neither `snippets/` nor `.claude/snippets/` exists, stop: `❌ No snippets/ or .claude/snippets/ directory found.`

## Steps

1. Resolve the write surface: `snippets/` at the root if present, which is the toolkit's own authoring source. Otherwise `.claude/snippets/`, a stale copy a target project holds from before its install channel retired.
2. Draft the content from the user's description. The snippet reference governs structure, invocation, and authoring conventions.
3. Confirm the slug and full content with the user before writing
4. Write the file. On the root surface: `<surface>/<category>/<slug>.md`, or `<surface>/<slug>.md` when the snippet takes no category. On the `.claude/` surface: the same shape nested one level deeper under `project/`, a convention kept for its own sake now that nothing syncs that folder.

## After writing

Emit the full path on its own line.

- Root surface: this is the toolkit's authoring source. Remind the user to run `bun run check` to regenerate the consumed copy under `.claude/`.
- `.claude/` surface: the file is project-local, under `.claude/snippets/project/`. Remind the user to copy it to the toolkit repo, under `snippets/<category>/<name>.md`, if it should ship to every project.
