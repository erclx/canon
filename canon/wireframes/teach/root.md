---
title: Teach root
description: The workspace roster at .canon/teach/index.html, one row per learning workspace on this machine
---

# Teach root

The entry page into every learning workspace. `renderRootPage` in `src/teach/nav.ts:422-469` regenerates it wholesale on every `canon teach nav` run, from `listWorkspaces` scanning `.canon/teach/` on disk. Source: `.canon/teach/index.html`, regenerated for this plan against `5cc60c86`.

## Roster

```plaintext
┌──────────────────────────────────────────────────────────────────────┐
│  ← masthead, breadcrumb, jump menu, theme toggle: see chrome.md      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Learning workspaces                                                  │← h1
│  One folder per subject. Each carries its own mission, sources,       │← lede
│  glossary, and lessons.                                               │
│                                                                        │
│  01   Regex                                           ○ Stub          │← disabled row
│       0 lesson(s) · 1 reference page(s) · 0 term(s)                   │
│  ──────────────────────────────────────────────────────────────────   │
│  02   Rag agent systems                                ● Live         │← linked row
│       1 lesson(s) · 1 reference page(s) · 9 term(s)                   │
│  ──────────────────────────────────────────────────────────────────   │
│  03   Fde system design                                 ● Live        │← linked row
│       3 lesson(s) · 1 reference page(s) · 7 term(s)                   │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

## Copy

- Title: "Learning workspaces".
- Lede: "One folder per subject. Each carries its own mission, sources, glossary, and lessons."
- Row blurb, dynamic per workspace: "N lesson(s) · N reference page(s) · N term(s)".
- Row state: "Stub" (no `MISSION.md` yet), "Live" (at least one lesson written). A third state, "Open", reads for a workspace with a mission but no lesson yet. No workspace on this machine currently reaches it, but a fresh `canon teach open` leaves one there until its first lesson lands.

## Behavior

- Every row links to that workspace's contents page, except a Stub row, which is disabled and points nowhere: there is nothing to open yet.
- A row's ordinal is always padded to two digits, however many workspaces exist.
- The header behaves as `chrome.md` describes. The root page's own breadcrumb segment, `Workspaces`, is the current page and still opens a jump menu onto the same roster this list already shows.
