---
title: Teach contents
description: A learning workspace's own index page, listing its success criteria, lessons, reference pages, and glossary
---

# Teach contents

One page per workspace, at `<workspace>/index.html`. `renderContentsPage` in `src/teach/nav.ts` rewrites it wholesale on every `canon teach nav` run, from what the workspace folder holds on disk: `MISSION.md`, the lessons already written, its reference pages, and `GLOSSARY.md`. Source: `examples/teach/00-fixture/index.html`, the committed fixture the capture below is taken from.

## Regions

- Sidebar, masthead, breadcrumb, jump menu, and theme toggle: as `chrome.md` draws them. The sidebar lists this workspace's lessons, marks none of them since no lesson is being read, and arrives shut, because the Lessons section lists the same set with a lede against each
- Heading: at the top of the pane, the workspace title over the mission's own description as a lede
- Success criteria: under the heading, a numbered list of what finishing the workspace means
- Lessons: under the criteria, one row per written lesson divided by rules, each carrying its ordinal on the left and its title over its lede
- Reference pages: under the lessons, one row per reference page, each carrying an `R` ordinal and its title
- Glossary: last, a filter input drawn with no border with the term count on its right, over a scrollable term list grouped under the lesson that first used each term

## States

| State        | Reached when                                      | Shows                                             | Evidence                                      |
| ------------ | ------------------------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| filled       | The workspace holds a mission, lessons, and terms | Every section the workspace has content for       | `examples/teach/evidence/workspace-index.png` |
| no-lessons   | The workspace holds a mission and no lesson yet   | The heading, the criteria, and the glossary alone | not captured                                  |
| filter-empty | A glossary filter matches no term                 | The empty-state line in place of the term list    | not captured                                  |

The capture is a flat file rather than a per-state folder, per `chrome.md` `## States`. The capture trails the fixture: it shows no Reference pages section, which `examples/teach/00-fixture/index.html` renders.

### Filter empty

```plaintext
┌────────────────────────────────────────────────────────────────────┐
│ xyz                                                                   │← a term matching nothing
└────────────────────────────────────────────────────────────────────┘
No term matches that.   Clear the filter                                 ← replaces the term list
```

## Copy

- Section headings: "Finished when you can do all of these unaided", "Lessons", "Reference pages", "Glossary"
- Heading and lede: the workspace title and the description in `MISSION.md`, templated per workspace
- Lesson rows: each lesson's own title and lede, templated per lesson
- Glossary filter placeholder: "Filter terms", with the count beside it reading "N terms", or "M of N terms" while a filter narrows the list
- Filter empty state: "No term matches that." beside a "Clear the filter" button
- Glossary entries: cited at the workspace's `GLOSSARY.md`, not duplicated here. Each entry appends its own provenance, as "First seen in `<lesson file>`."

## Behavior

- Every section but the glossary is conditional: no success line, no lesson written yet, or no reference page each drop their whole heading and body rather than rendering an empty one. The lede drops too when the mission carries no description.
- The glossary always renders, heading and filter included, down to zero terms.
- Typing into the filter narrows the term list live, matching against both a term and its definition. Clearing the filter, or pressing "Clear the filter" once nothing matches, restores the full list and returns focus to the input.
- A reference page row opens the page's rendered `reference/<slug>.html` sibling rather than its markdown, drawn in `reference.md`.

## Not on this surface

- No state mark on a lesson row. A lesson not yet written does not appear, so every listed row is written and a mark would read the same on each
- No quiz score or reading progress per lesson
- No edit control. The page is regenerated from the workspace folder, and a hand edit is lost on the next run
