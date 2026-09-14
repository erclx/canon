---
name: draft-wireframes
description: Drafts a brand-new `canon/wireframes/<surface>.md` file against the wireframes standard, walks the tree for a name collision, detects an existing higher visual-design tier without building one, confirms with the user, then writes. Use when asked to "draft a wireframe for X", "write the wireframe for this surface", "add a canon/wireframes entry for X", or "wireframe this screen" where no surface file covers it yet. Do NOT use to fix a stale TODO stub or report wireframe drift against a diff, which is `docs-fold`'s wireframe-sweep step.
---

# Wireframe draft

Drafts one brand-new `canon/wireframes/<surface>.md` file end to end: read the standard, decide whether the surface is already covered, detect but never build a higher visual-design tier, confirm the draft with the user, then write.

A project the surface move has not reached keeps its wireframes folder under `.claude/` rather than `canon/`. Walk and write at whichever root already carries the folder, and create it under `canon/` only when neither does, since a new `canon/` folder would hide every surface the old one holds.

Read these files in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/wireframes.md`: the three questions a wireframe must answer, its frontmatter, layout and variant rules, the Transcription-wireframes branch, and what moves to a context entry instead
- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: banned words, punctuation, and formatting for the prose around the fences
- The `write-human` skill: voice, rhythm, and sentence construction for the prose around the fences

This skill stays fully independent of `docs-fold`'s wireframe coverage sweep, which only ever writes a bare `TODO` stub for a surface a diff touched and reports drift against one a wireframe already covers. Neither the stub nor the drift check is a draft, and this skill never reads or writes through that mechanism.

## Guards

- If no surface is given, stop: `❌ No surface given. Name the surface this wireframe should cover.`
- Derive a kebab-case slug from the surface. Walk the whole `canon/wireframes/` tree, including a surface nested inside a grouped subfolder, rather than checking the top level alone. A match at any depth means the surface already has a file. Stop: `❌ <path> already covers this surface. Edit it directly; this skill only drafts a surface with no file yet.`

## Tier detection

- Read `canon/DESIGN.md` and every existing `canon/wireframes/` file for a tier signal: a Stitch, Excalidraw, or Figma reference, or a marker naming one of them.
- State the detected tier at the confirm step. Always draft the regions-and-states shape regardless of what is detected, since that is the only shape this skill or any other shipped mechanism produces, adding the ASCII sketch fence only when the layout is not built yet. Report a higher tier rather than attempting a companion render for it.
- Default silently to tier 0 when nothing is detected.

## Draft

- Decide the mode before drafting. When the surface names an already-built component or file, open that source and draft in transcription mode, citing the render function, the stylesheet rule, or the built file each region and label traces to, per the standard's Transcription-wireframes section.
- Draft in role-intent mode otherwise: label each region by its role, never by a class name or a token value.
- Draft `title` and `description` frontmatter, then a lead paragraph naming what the surface is for and what it covers, then `## Regions` as a bullet list naming every region and where it sits relative to the others.
- Draw an ASCII `plaintext` fence with `←` role annotations only when the layout is not built yet. Skip the fence in transcription mode, which already cites the built source instead.
- Draft `## States` as a table listing every state a visitor can reach, what reaches it, what it shows in words, and its evidence folder, reading `not captured` in the evidence cell until a capture lands.
- Follow with `## Copy`, `## Behavior`, and `## Not on this surface`, against `${CLAUDE_SKILL_DIR}/../../standards/wireframes.md`'s template.
- Give a layout that changes across a breakpoint or state its own entry in the regions list, named by what triggers it, never for a spacing difference alone.
- Leave out algorithms, event-handler code, framework prop or class names outside transcription mode, and anything else the standard sends to a context entry instead.

## Confirm

- Show the resolved path, the detected tier, and the full drafted content before writing.
- Confirm all three with the user. This skill waits for that answer rather than treating the tool permission dialog as the gate, since the mode decision and the tier read are judgment calls with no diff to preview either against.

## Write

- Write the file at the confirmed path, creating a grouped subfolder only when the surface belongs beside siblings that already share one.
- Run `canon markdown audit <path>` against the prose outside the fenced block.
- Run `canon indexes regen canon/wireframes`, so the surface appears in `canon/wireframes/index.md` immediately rather than drifting until the next unrelated regen.

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
