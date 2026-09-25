---
title: Teach root
description: The workspace roster at .canon/teach/index.html, one row per learning workspace on this machine
---

# Teach root

The entry page into every learning workspace. `renderRootPage` in `src/teach/nav.ts` regenerates it wholesale on every `canon teach nav` run, from `listWorkspaces` in `src/teach/workspace.ts` scanning `.canon/teach/` on disk. Source: `examples/teach/index.html`, the committed fixture the captures below are taken from.

## Regions

- Sidebar, masthead, breadcrumb, jump menu, and theme toggle: as `chrome.md` draws them. The sidebar lists the workspaces rather than the lessons, folds no outline under any of them, and arrives shut, because the roster already lists what the panel would
- Heading: at the top of the pane, the page title over a one-line lede
- Roster: under the heading, one row per workspace in folder order, divided by rules. Each row carries its ordinal on the left, the workspace title over its counts in the middle, and its state word on the right

## States

| State   | Reached when                                      | Shows                                    | Evidence                                         |
| ------- | ------------------------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| listing | `.canon/teach/` holds at least one workspace      | The heading over one row per workspace   | `examples/teach/evidence/root-listing.png`       |
| light   | The visitor picks light, or the system prefers it | The same listing on the light ground     | `examples/teach/evidence/root-listing-light.png` |
| empty   | `.canon/teach/` holds no workspace                | The heading with no roster rows under it | not captured                                     |

The captures are flat files rather than per-state folders, per `chrome.md` `## States`. Only Live and Stub rows appear in the listing capture, since no committed fixture reaches Open. The capture trails the fixture: its Fixture row reads 0 reference pages, where `examples/teach/index.html` reads 1.

## Copy

- Title: "Learning workspaces"
- Lede: "One folder per subject. Each carries its own mission, sources, glossary, and lessons."
- Sidebar heading and meta line: "Workspaces" over "N workspaces", singular at one
- Row counts, templated per workspace: "N lesson(s) · N reference page(s) · N term(s)"
- Row state word, one of three: "Stub" for a workspace with no `MISSION.md` yet, "Open" for one with a mission and no lesson, and "Live" for one with at least one lesson

## Behavior

- Every row links to that workspace's contents page, except a Stub row, which is dimmed and points nowhere, since there is nothing to open yet.
- A row's ordinal is always padded to two digits, however many workspaces exist.
- The root page's own breadcrumb segment, `Workspaces`, is the current page and still opens a jump menu onto the same roster this list shows.

## Not on this surface

- No status dot or accent on a row. The state is a word in muted text
- No lesson list under a workspace row. The contents page carries that
- No control to create or delete a workspace. `canon teach open` does that from the terminal
