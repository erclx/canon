---
title: Teach contents
description: A learning workspace's own index page, listing its success criteria, lessons, reference pages, and glossary
---

# Teach contents

One page per workspace, at `<workspace>/index.html`. `renderContentsPage` in `src/teach/nav.ts:494-580` rewrites it wholesale on every `canon teach nav` run, from what the workspace folder holds on disk: `MISSION.md`, the lessons already written, its reference pages, and `GLOSSARY.md`. Source: `.canon/teach/03-fde-system-design/index.html`, regenerated for this plan against `5cc60c86`.

## Contents

```plaintext
┌──────────────────────────────────────────────────────────────────────┐
│  ← masthead, breadcrumb, jump menu, theme toggle: see chrome.md      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Fde system design                                                    │← h1, the workspace title
│  System design for forward-deployed engineer interviews, aimed at     │← lede, MISSION.md's own
│  the design and decomposition rounds rather than at scale trivia      │  description; dropped
│                                                                        │  entirely when it has none
│  Finished when you can do all of these unaided                        │← h2, dropped when the
│  1. Run the first five minutes of a design prompt without naming a    │  workspace lists no
│     component, producing stakeholders...                              │  success line
│  2. Size a system out loud before designing it...                     │
│  …                                                                     │
│                                                                        │
│  Lessons                                                               │← h2, dropped when no
│  01  Scoping before solving                              ● Written    │  lesson exists yet
│      Lesson 1. What the forward-deployed design round actually is…    │
│  ──────────────────────────────────────────────────────────────────   │
│  02  Sizing out loud                                       ● Written  │
│      Lesson 2. Three numbers, said out loud, before a single…         │
│  ──────────────────────────────────────────────────────────────────   │
│  03  The enterprise deployment skeleton                    ● Written  │
│      Lesson 3. Trust boundary, what may leave, whose identity…        │
│                                                                        │
│  Reference pages                                                       │← h2, dropped when the
│  R1  Scoping a design problem before proposing components              │  workspace has none
│                                                                        │
│  Glossary                                                       [7]   │← h2, count badge,
│  ┌────────────────────────────────────────────────────────────────┐  │  always present
│  │ term                                                             │← filter input
│  └────────────────────────────────────────────────────────────────┘  │
│  Agency: Taking on work nobody assigned, and fixing a problem on      │← scrollable term list
│  noticing it rather than routing it to someone else. First seen in    │
│  lessons/0001-scoping-before-solving.html.                            │
│  Decomposition round: An interview stage giving an ambiguous…         │
│  …                                                                     │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

## Empty glossary filter

```plaintext
┌────────────────────────────────────────────────────────────────────┐
│ xyz                                                                   │← a term matching nothing
└────────────────────────────────────────────────────────────────────┘
No term matches that.   Clear the filter                                 ← replaces the term list
```

## Copy

- Section headings: "Finished when you can do all of these unaided", "Lessons", "Reference pages", "Glossary".
- A lesson row's state reads "Written" once it exists on disk. There is no in-between state: a lesson not yet written does not appear in this list at all.
- Glossary filter placeholder: "term". Empty state: "No term matches that." beside a "Clear the filter" button.
- A glossary entry appends its own provenance, for example "First seen in lessons/0001-scoping-before-solving.html."

## Behavior

- Every section but the glossary is conditional: no success line, no lesson written yet, or no reference page each drop their whole heading and body, rather than rendering an empty one.
- The glossary always renders, heading and filter included, down to zero terms.
- Typing into the filter narrows the term list live, matching against both a term and its definition. Clearing the filter, or pressing "Clear the filter" once nothing matches, restores the full list and returns focus to the input.
- A reference page listed here is a separate authored document rather than one of the three page types this wireframe set covers. This page only links out to it.
