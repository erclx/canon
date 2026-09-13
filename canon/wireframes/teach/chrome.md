---
title: Teach chrome
description: The masthead, breadcrumb, jump menu, theme toggle, and progress track shared by the teach root, contents, and lesson pages
---

# Teach chrome

Every teach page shares one header and one progress track. `renderHeader`, `renderBreadcrumb`, `renderJump`, and `renderTrack` in `src/teach/nav.ts:212-273` build both, and the `.bar`, `.mast`, `.jump`, and `.track` rules in `course.css` size them: a 52rem chrome measure (`--chrome`) and a 4.4rem bar height (`--mast-h`). The three page wireframes each point back here rather than redrawing it.

## Header

```plaintext
┌──────────────────────────────────────────────────────────────────────┐
│  Workspaces ⌄                                              ☀/☾        │← .mast, 4.4rem tall, sticky
├──────────────────────────────────────────────────────────────────────┤
│ ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰ ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰ ▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱                  │← .track, one segment
└──────────────────────────────────────────────────────────────────────┘   per item
```

The crumb on the left grows with depth: one segment (`Workspaces`) on the root page, two (`Workspaces / <workspace>`) on a contents page, three (`Workspaces / <workspace> / Lesson N of M`) on a lesson. Only that trailing segment drops its jump menu. Every other one, current page or not, still opens one.

## Jump menu open

```plaintext
┌──────────────────────────────────────────────────────────────────────┐
│  Workspaces ⌃                                              ☀/☾        │← caret flips; trigger
│  ┌──────────────────────────────────┐                                │  stays in place
│  │ 01  Regex                    ○    │← disabled, no mission yet
│  │ 02  Rag agent systems         ●    │← linked row
│  │ 03  Fde system design         ●    │← linked row, marked "at"
│  └──────────────────────────────────┘                                │  when it's the open page
├──────────────────────────────────────────────────────────────────────┤
│ ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰ ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰ ▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱                  │
└──────────────────────────────────────────────────────────────────────┘
```

The panel opens beneath its trigger, overlapping the page content below it rather than pushing that content down.

## Copy

- Jump menu labels: "Open a workspace" (root's own segment), "Switch workspace" (the `Workspaces` segment on every other page), "Jump to a lesson" (a workspace's own segment on its contents and lesson pages).
- Theme button label: "Switch between light and dark".
- Breadcrumb separator between segments: "/".
- Each jump row pairs a two-digit ordinal with the item's title-cased name.

## Behavior

- Opening one jump menu closes any other already open, and that exclusivity is native to the `<details>` element rather than scripted. A click outside every jump menu, and the Escape key, are what close an open one and are scripted, and Escape also returns focus to the trigger it closed.
- The theme toggle flips light and dark and remembers the visitor's last pick in their own browser, falling back to the system preference when nothing is remembered yet.
- The track's meaning changes by page.
- A root track holds one segment per workspace, filled once that workspace has a lesson written.
- A contents track holds one segment per lesson already written in that workspace, and every one reads filled.
- A lesson track holds the same set, but the current lesson's segment is marked distinctly rather than filled. Every other segment reads as filled regardless of whether it falls before or after the one being read.
