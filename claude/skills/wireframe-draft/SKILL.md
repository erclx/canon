---
name: wireframe-draft
description: Drafts a brand-new `.claude/wireframes/<surface>.md` file against `standards/wireframes.md`, walks the tree for a name collision, detects an existing higher visual-design tier without building one, confirms with the user, then writes. Use when asked to "draft a wireframe for X", "write the wireframe for this surface", "add a .claude/wireframes entry for X", or "wireframe this screen" where no surface file covers it yet. Do NOT use to fix a stale TODO stub or report wireframe drift against a diff, which is `claude-docs`'s wireframe-sweep step.
---

# Wireframe draft

Drafts one brand-new `.claude/wireframes/<surface>.md` file end to end: read the standard, decide whether the surface is already covered, detect but never build a higher visual-design tier, confirm the draft with the user, then write.

Read these files in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/wireframes.md`: the three questions a wireframe must answer, its frontmatter, layout and variant rules, the Transcription-wireframes branch, and what moves to a context entry instead
- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: banned words, punctuation, and formatting for the prose around the fences
- The `write-human` skill: voice, rhythm, and sentence construction for the prose around the fences

This skill stays fully independent of `claude/skills/claude-docs/references/wireframe-sweep.md`, which only ever writes a bare `TODO` stub for a surface a diff touched and reports drift against one a wireframe already covers. Neither the stub nor the drift check is a draft, and this skill never reads or writes through that mechanism.

## Guards

- If no surface is given, stop: `❌ No surface given. Name the surface this wireframe should cover.`
- Derive a kebab-case slug from the surface. Walk the whole `.claude/wireframes/` tree, including a surface nested inside a grouped subfolder, rather than checking the top level alone. A match at any depth means the surface already has a file. Stop: `❌ <path> already covers this surface. Edit it directly; this skill only drafts a surface with no file yet.`

## Tier detection

- Read `.claude/DESIGN.md` and every existing `.claude/wireframes/` file for a tier signal: a Stitch, Excalidraw, or Figma reference, or a marker naming one of them.
- State the detected tier at the confirm step. Always draft the tier-0 ASCII file regardless of what is detected, since that is the only shape this skill or any other shipped mechanism produces. Report a higher tier rather than attempting a companion render for it.
- Default silently to tier 0 when nothing is detected.

## Draft

- Decide the mode before drafting. When the surface names an already-built component or file, open that source and draft in transcription mode, citing the render function, the stylesheet rule, or the built file each region and label traces to, per the standard's Transcription-wireframes section.
- Draft in role-intent mode otherwise: label each region by its role, never by a class name or a token value.
- Draft `title` and `description` frontmatter, then one `##` heading per layout variant, each holding its own ASCII `plaintext` fence with `←` role annotations, followed by `## Copy` and `## Behavior` sections against `${CLAUDE_SKILL_DIR}/../../standards/wireframes.md`'s template.
- Add a second layout variant only when the layout itself changes across a breakpoint or state, never for a spacing difference alone.
- Leave out algorithms, event-handler code, framework prop or class names outside transcription mode, and anything else the standard sends to a context entry instead.

## Confirm

- Show the resolved path, the detected tier, and the full drafted content before writing.
- Confirm all three with the user. This skill waits for that answer rather than treating the tool permission dialog as the gate, since the mode decision and the tier read are judgment calls with no diff to preview either against.

## Write

- Write the file at the confirmed path, creating a grouped subfolder only when the surface belongs beside siblings that already share one.
- Run `canon markdown audit <path>` against the prose outside the fenced block.
- Run `canon indexes regen .claude/wireframes`, so the surface appears in `.claude/wireframes/index.md` immediately rather than drifting until the next unrelated regen.

## Response format

### Preview

**Surface:** `<surface>`
**Placement:** `<path>`
**Detected tier:** `<tier-0 | tier-1 | tier-2 | none detected>`

```markdown
<drafted frontmatter and body>
```

### After confirmation

```plaintext
✅ Drafted: <path>
```
