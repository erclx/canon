---
title: Wireframe coverage sweep
description: Slug derivation from a UI-affecting path, the contradicted and uncovered findings, the surface stub, and the report lines
---

# Wireframe coverage sweep

Mechanics for Step 4 of `docs-fold`. The body owns the skip conditions and the UI-path filter, and this file owns what the sweep does once a UI-affecting path survives that filter.

## Deriving a candidate slug

For each UI-affecting path, derive a candidate surface slug from the file's basename and parent folder (e.g. `web/src/features/mock/MockDemoStrip.tsx` → `mock-demo-strip` or `mock`). Cross-reference against every surface file in `canon/wireframes/`, including one nested inside a grouped surface's own subfolder (`canon/wireframes/<group>/<surface>.md`), by walking the tree rather than globbing the top level alone.

## Findings

**Contradicted sections.** When a surface file exists for a path in the diff and the diff renames or removes a literal string that appears in the wireframe prose (e.g. provider name, button label, copy string), output a one-line report entry and stop. Do not auto-rewrite prose. Operator resolves.

**Uncovered surfaces.** When a UI-affecting path has no matching surface file by slug, write `canon/wireframes/<slug>.md` with this stub:

```markdown
---
title: <Slug as title case>
description: TODO: describe the surface.
---

# <Slug as title case>

TODO: describe when and where this surface appears.

## Behavior

- TODO
```

Skip the write when the slug would collide with an existing file, flat or nested (different surface, same slug). Surface the collision in the report instead.

## Output

Output one line per finding:

- `⚠ Wireframe drift in canon/wireframes/<surface>.md: <contradicted string>`
- `📝 Stubbed: canon/wireframes/<surface>.md`
- `⚠ Slug collision: <slug> matches existing <existing-surface>.md, review and rename`

If the sweep finds nothing, skip silently.
