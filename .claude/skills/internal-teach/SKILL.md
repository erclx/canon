---
name: internal-teach
description: Learning workspace implementation, the committed fixture, and the teach standards. Use for `src/teach/`, `examples/teach/`, `standards/teach.md`, `standards/glossary.md`, or any `canon teach` verb.
---

# Teach

Read `canon/context/features/teach.md` for structure, the render pipeline, and the decisions behind the surface before editing.

`governance/rules/canon/661-teach.md` already routes a `.canon/teach/**` edit to both standards, and it ships to targets. This skill covers the implementation and the fixture, which that rule does not reach.

## Authoring a lesson

- The chrome is spliced, never authored. Read `references/lesson-chrome.md` before writing or editing any lesson file.
- Take the quiz option order `canon teach lesson` reports rather than choosing one. The verb draws it because an author told to vary a position varies it by judgment, and nothing downstream compares the two.
- Run `canon teach nav` after the body lands, and read the result rather than assuming the splice fired.

## Working against the fixture

- Develop against `examples/teach/00-fixture/`. Real workspaces hold real learning and sit outside this repository.
- Pass `--root examples/teach` to reach the fixture. A bare `canon teach list` reads the operator's live workspaces instead, so a claim about "the workspace" made without the flag is a claim about the wrong tree.
- `workspace.ts` resolves a root whose basename is already `teach` as that root rather than nesting a second `teach` below it. A path ending in `teach` therefore behaves differently from one that does not.
- Renders committed under `examples/` are disclaimed rather than gated, because nothing outside `examples/` depends on them staying current. Do not add a staleness gate there without deciding it first, which is the split `canon/context/web/assets.md` draws between `assets/` and `examples/`.

## Sync checklist

After changing the render pipeline or the workspace shape:

- Run `canon teach list --root examples/teach` and confirm the fixture reports what the change intended.
- Run `canon teach nav --root examples/teach` and diff the fixture's lessons. The splice rewrites in place, so a pipeline change moves committed files.
- Run `bun run check`.

After changing what a workspace's files must contain:

- Update `standards/teach.md` or `standards/glossary.md` rather than encoding the shape here. A standard governs the artifact and this skill governs the procedure.
- Update the affected consumer docs through `canon:docs-sync` rather than editing `docs/` directly.

## Reference

- `canon/context/features/teach.md`: structure, the render pipeline, decisions and gotchas
- `references/lesson-chrome.md`: the four markers, what `canon teach nav` rewrites, and the authored-versus-generated boundary
- `canon standards teach`: folder layout, ordinal naming, frontmatter, mission and learning-record formats
- `canon standards glossary`: the entry shape, ordering, and which terms a workspace carries
- `claude/skills/teach-workspace/`: the pedagogy deciding what to teach next, which is the shipped skill's own concern rather than this one's
- `canon/context/design/tokens.md`: the token values this surface reads and does not own
