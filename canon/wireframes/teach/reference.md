---
title: Teach reference
description: A workspace reference page rendered from its markdown, with the shared chrome and the body in the reference column
---

# Teach reference

One page per reference page, at `<workspace>/reference/<slug>.html`, beside the `<slug>.md` it is rendered from. `renderReferencePage` in `src/teach/nav.ts:1177-1250` rewrites it wholesale on every `canon teach nav` run: it drops the frontmatter, renders the body through `Bun.markdown.html` with raw HTML escaped, and wraps it in `<main class="ref">`. Source: `examples/teach/00-fixture/reference/element-table.html`, regenerated from `element-table.md` for this plan.

## Regions

- Sidebar (`.sb`): the workspace switcher, the lesson count, and every lesson with none marked, left of the pane and open on arrival, as on a lesson, since this page lists no lessons of its own. The foot carries the term and session counts. See `chrome.md`.
- Masthead (`.bar`): across the top of the pane, holding the collapse control, the breadcrumb, and the theme toggle. See `chrome.md`.
- Reference column (`main.ref`): below the masthead, holding the rendered markdown body, opening on its H1.

## States

| State    | Reached when                             | Shows                                                      | Evidence                                |
| -------- | ---------------------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| rendered | Following a Reference pages contents row | The chrome, the page title as the last crumb, and the body | `examples/teach/evidence/reference.png` |

## Copy

- Breadcrumb: "Workspaces", the workspace title, then the page's frontmatter `title` as plain text, falling back to the filename in sentence case. The document `<title>` reads the same value.
- Body: cited at the workspace's `reference/<slug>.md`, not duplicated here. The renderer adds no words of its own apart from an H1 carrying the frontmatter `title` when the body holds none.

## Behavior

- A relative link to another reference page's markdown opens that page's `.html` sibling, and one to the workspace glossary opens the glossary on the contents page. A link to any other markdown file, such as `../RESOURCES.md`, stays as written and opens as plain text.
- Raw HTML in the markdown, such as a `<kbd>` or a `<details>`, shows as escaped text rather than rendering.
- An edit to the markdown reaches this page only on the next `canon teach nav` run, and a hand edit here is lost on that run with nothing reporting it.

## Not on this surface

- No footer navigation, since a reference page sits outside the lesson sequence
- No glossary filter or lesson listing in the body
