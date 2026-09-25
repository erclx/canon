---
title: Teach chrome
description: The masthead, breadcrumb, jump menu, theme toggle, collapse control, and reading bar shared by the teach root, contents, and lesson pages
---

# Teach chrome

Every teach page shares one header and one course sidebar. Transcribed from `renderHeader` and `renderSidebar` in `src/teach/nav.ts` and the chrome rules in `examples/teach/course.css`. The four page wireframes each point back here rather than redrawing it.

At 3.5rem tall (`--teach-mast-h`), the bar's row spans the window rather than the reading measure, so the collapse control and the theme control sit at the same inset on every page. The footer nav shares the article's measure rather than the page width, and an anchor jump lands below the bar rather than behind it.

## Regions

- Sidebar (`.sb`): the left column, holding the workspace switcher at its top, a meta line, the page list, and a foot line. Above 1100px it sits beside the pane. At 1100px and below it overlays the page, per `lesson.md`
- Masthead (`.mast`): across the top of the pane, sticky, holding the collapse control and the breadcrumb on the left and the theme toggle on the right
- Reading bar: a strip along the masthead's bottom edge (`.bar::after`), filling left to right with position in the page
- Jump menu: a panel under whichever crumb caret opened it, over the page content
- Pane (`.pane`): right of the sidebar and under the masthead, holding the page's own `<main>`

### Breadcrumb

The crumb grows with depth: one segment (`Workspaces`) on the root page, two (`Workspaces / <workspace>`) on a contents page, three (`Workspaces / <workspace> / Lesson N of M`) on a lesson, with the page's title in the third place on a reference page. Only that trailing segment drops its jump menu. Every other one, current page or not, still opens one.

A crumb and its caret form one chip: the label goes to the page, the caret opens the menu, and the whole chip fills with the chrome hover ground while the pointer is over it or its menu is open. Crumb links are neutral rather than accented, since the accent marks where you are rather than where you can go. The caret stays drawn and muted in every state.

The `☰` control left of the crumb collapses the sidebar. It is the panel's only trigger on any window width, and below 1100px it opens the panel over the lesson rather than beside it.

## States

| State          | Reached when                                      | Shows                                             | Evidence                                         |
| -------------- | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| sidebar-open   | A lesson or reference page loads                  | The sidebar beside the pane                       | `examples/teach/evidence/lesson.png`             |
| sidebar-shut   | The root or a contents page loads                 | The pane across the full width under the masthead | `examples/teach/evidence/workspace-index.png`    |
| light          | The visitor picks light, or the system prefers it | The chrome on the light ground                    | `examples/teach/evidence/root-listing-light.png` |
| jump-menu-open | The visitor hovers or clicks a crumb caret        | The menu panel under its trigger                  | not captured                                     |

The captures are flat files, one per page, rather than per-state folders, because the teach capture writes one image per page.

### Jump menu open

```plaintext
│  ☰  Workspaces ⌄ / Fixture ⌄ / Lesson 2 of 3   ☀/☾   │← trigger stays in place
│     ┌──────────────────────────────┐                │
│     │ 00  Fixture               3  │← linked row, marked "at" when it is
│     │ 01  Sparse                1  │  the open page. The trailing column
│     │ 02  Unopened              0  │  carries a lesson count in the
│     └──────────────────────────────┘  workspace menu and nothing in the
│                                       lesson menu.
```

The panel opens beneath its trigger, overlapping the page content below it rather than pushing that content down.

## Copy

- Jump menu labels: "Open a workspace" (root's own segment), "Switch workspace" (the `Workspaces` segment on every other page), "Jump to a lesson" (a workspace's own segment on its contents and lesson pages).
- Theme button label: "Switch between light and dark".
- Collapse control label: "Toggle the course panel". The close control inside the overlay reads "Close the course panel", and the resize grip reads "Resize the course panel".
- Breadcrumb separator between segments: "/".
- Each jump row pairs a two-digit ordinal with the item's name: a workspace's mission title, falling back to its sentence-cased slug.
- The sidebar's workspace heading stops at two lines with an ellipsis and carries the whole title in its `title` attribute, so a long mission title stays inside the top band.

## Behavior

- Opening one jump menu closes any other already open, the sidebar's own workspace switcher included. A click outside every menu, and the Escape key, are what close an open one, and Escape also returns focus to the trigger it closed.
- A breadcrumb menu opens on hover as well as on click, and a click on a panel hover already opened keeps it open rather than closing it. The sidebar's switcher stays click-only, because its panel opens directly over the lesson list the pointer is headed toward.
- The theme toggle flips light and dark and remembers the visitor's last pick in their own browser, falling back to the system preference when nothing is remembered yet.
- The reading bar on the masthead's bottom edge reports position inside the lesson rather than position in the course, which the sidebar reports. It is the one motion this chrome carries.
- The trailing crumb segment reads `Lesson N of M` until the lesson's own title scrolls off, and carries that title afterwards.

See `lesson.md` for what the sidebar lists, how it collapses and resizes, and what it does below 1100px.

## Not on this surface

- No search across workspaces or lessons. The sidebar filter narrows one workspace's lesson list only
- No account, sign-in, or sync control. Every page is a local file
- No progress state saved per visitor beyond the theme and the sidebar's width and open state
