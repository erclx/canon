---
title: Chrome
description: The teach page chrome, its regions and breadcrumb, sidebar, type scale, and typed browser scripts, with the decisions behind them
---

# Chrome

## Overview

The chrome is the masthead, breadcrumb, sidebar, footer nav, and reading bar `canon teach nav` splices into every teach page. `overview.md` carries the workspace, the splice, and the verbs. This entry carries the browser side, being how the chrome is built and styled and the scripts it runs.

## Layout

### Surface

Every page shares one header and one course sidebar, built by `renderHeader` and `renderSidebar` in `src/teach/nav.ts` and styled by the chrome rules in `examples/teach/course.css`. The bar is `--teach-mast-h`, 3.5rem tall, and its row spans the window rather than the reading measure, so the controls sit at the same inset on every page.

The foot nav shares the article's measure, and an anchor jump lands below the bar rather than behind it.

### Regions

The chrome has five regions.

| Region           | Role                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar `.sb`    | Left column with the workspace switcher, a meta line, the page list, and a foot line. Beside the pane above 1100px, an overlay at 1100px and below |
| Masthead `.mast` | Sticky across the top of the pane, with the collapse control and breadcrumb left and the theme toggle right                                        |
| Reading bar      | A strip along the masthead's bottom edge filling left to right with position in the page                                                           |
| Jump menu        | A panel under the crumb caret that opened it, overlapping the content rather than pushing it                                                       |
| Pane `.pane`     | Right of the sidebar and under the masthead, holding the page's own `<main>`                                                                       |

The reading bar is the one motion the chrome carries. It reports position inside the lesson where the sidebar reports position in the course.

### Breadcrumb

The crumb grows with depth. The root has one segment, `Workspaces`, a contents page has two, and a lesson has three, ending in `Lesson N of M`. A reference page puts the page's title in the third place.

- Only the trailing segment drops its jump menu, and every other one, current page or not, still opens one
- The trailing segment reads `Lesson N of M` until the lesson's own title scrolls off, then carries the title
- The `☰` control left of the crumb collapses the sidebar. It is the panel's only trigger at any width, and below 1100px it opens the panel over the lesson.

### Crumb chips

A crumb and its caret form one chip. The label goes to the page, the caret opens the menu, and the whole chip fills with the chrome hover ground while the pointer is over it or its menu is open.

Crumb links are neutral rather than accented, since the accent marks where you are rather than where you can go. The caret stays drawn and muted in every state.

### States

Three states cover the chrome.

- **sidebar-open.** A lesson or reference page loads with the sidebar beside the pane.
- **sidebar-shut.** The root or a contents page loads, and the pane takes the full width under the masthead.
- **jump-menu-open.** Hovering or clicking a caret opens the panel under it. A row pairs a two-digit ordinal with the item's name, marked where current, and the workspace menu trails a lesson count.

### Menus, theme, and headings

Menu behavior follows a few rules.

- Opening one jump menu closes any other already open, the sidebar's workspace switcher included
- A click outside every menu closes it, and Escape does too and returns focus to the trigger
- A breadcrumb menu opens on hover as well as click, and a click on a panel hover already opened keeps it open
- The switcher stays click-only, since its panel opens over the lesson list the pointer is headed toward

The theme toggle flips light and dark and remembers the pick in the visitor's own browser, falling back to the system preference. The sidebar's workspace heading stops at two lines with an ellipsis and carries the whole title in its `title` attribute, so a long title stays inside the top band.

### Not on this surface

Three things are deliberately absent.

- No search across workspaces or lessons, since the sidebar filter narrows one workspace's lesson list only
- No account, sign-in, or sync control, since every page is a local file
- No progress saved per visitor beyond the theme and the sidebar's width and open state

### Related

Three entries sit beside this one.

- `canon/context/features/teach/overview.md` covers the workspace, the chrome splice, and the verbs
- `canon/context/features/teach/pages.md` covers what each page kind shows and does under this chrome
- `canon/context/design/tokens.md` holds the token values a workspace stylesheet is seeded from

## Decisions

### Scripts are typed modules

A page's scripts are typed modules in `src/teach/browser/`, transpiled by `compileScript` as a page is generated. The transpiler does not bundle, so a module runs only its own source.

A value arrives as a JSON argument and a shared function such as `focusLine` as a helper `compileScript` declares ahead of it. Inline strings were the rejected alternative.

### Markup and CSS come from different files

`src/teach/nav.ts` emits the header, the footer nav and the contents pages, while every chrome rule is generated from `TEACH_CHROME` in `src/design/components.ts`, so a repair to how the chrome looks lands in the second file.

- `nav` seeds a workspace's stylesheet pair when `course.css` is absent, rewrites `assets/base.css` wherever one exists, and never overwrites `course.css`
- It drops the `@import` from the copy a lesson embeds, since that line resolves against the lesson's folder
- The base sheet reaches a lesson through a `<link>` in the `style` region ahead of the embedded rules, only where `assets/base.css` exists
- Embedding it would repeat a sheet carrying its fonts inline in every lesson

### Fonts follow the design module

Teach reads the design module's faces and keeps only the hand pair as its own. `--teach-sans` and `--teach-mono` resolve to `--type-body-family` and `--type-code-family`, and `TEACH_FONT_FACES` is `FONT_FACES` plus `HAND_DRAWN_FONT_FACES`, so a face change reaches teach with no edit here.

- Font sizes equal to a step read `--t2` through `--t6`, and sizes between steps stay as chrome tuning until a taste pass takes them
- Keeping teach's own Nunito and Cascadia Code left the tree rendering three families where the design record names two

### The course is a sidebar

The course is a collapsible sidebar rather than a segmented strip in the bar. The strip gave each lesson one `flex: 1` segment and rendered fifty of them as a row of dots, the scale a reader most needs it at.

- The sidebar reports position in the course at any length, and the masthead's bottom edge reports position inside the lesson
- The in-lesson outline folds under the lesson being read rather than sitting in a right-hand rail that existed only above 1420px
- Below 1100px the panel opens over the lesson with a scrim rather than hiding, since the breadcrumb menu carries a flat lesson list and neither the filter nor the outline

### Bottom room sits on the pane

The sidebar and everything else lay out as a flex row, which constrains where the page's bottom room can sit. A flex item's sticky containing block is the flex container's content box, so bottom padding on `body` is space the sidebar can never travel into, and it rides up by that much near the foot of a short page.

- The room moves onto `.pane`, which is what it was spacing anyway
- The pane needs `box-sizing: border-box` beside its `min-height: 100vh`, or the same padding scrolls every short page
- Both reproduce only at a window tall enough for the page to be short, which reads as intermittent and is invisible in markup review

### Departures from the nav-04 prototype

The chrome matches the nav-04 prototype except in six places. Both sides were compared as computed styles at three widths in both themes, frame by frame across rest, hover and open states, and nothing departs beyond these.

### Jump menu and hover departures

Three departures concern the menus.

- The jump menu is one component in both mounts. The prototype drew the breadcrumb menu as a grid at `0.38rem` row padding and the switcher as a flex row at `0.34rem` with a 12px numeral.
- Both now take the breadcrumb recipe, so the switcher opens 4px taller than drawn
- The current row's numeral takes the accent in both menus. The prototype muted it in the breadcrumb menu and kept the accent in the switcher, and the accent is what marks where you are.
- A breadcrumb menu row fills with `--color-chrome` on hover. The prototype left that mount on `--color-surface` while moving every other chrome hover, and the row rule is shared with the switcher.

### Spacing and markup departures

Three departures concern spacing and markup.

- `.bar` keeps its own side padding, `1.5rem` wide and `1rem` on a phone, under the `0.9rem` `.mast` adds. The prototype's `.bar` computes the same, 38px from the edge.
- `.track` and `.outline` are gone from the markup, where the prototype kept both and hid them with `display: none`
- The trailing count column keeps `text-align: right`, where the prototype's flex switcher row read `start`. The column is sized to its content, so the value moves nothing.

### Reading rules sit on the type scale

Reading rules use the declared type scale, `--t1` through `--t6`, and the body carries no phone override, since the steps are the same at every width. The mapping is the nav-04 prototype's `data-scale` block landed as the default, with two changes.

- `h3` reads `--t3` but the glossary group label keeps its own `--t5`, because the prototype's `main h3` selector would have painted that label at 18px and it never rendered a glossary page
- `th`, `.nav .lbl`, the panel labels, the glossary group label and the two quiz tags drop their uppercase and tracking, matching the landing page
- The quiz tags write their text in `content`, so the strings are capitalized in the rule

### The listing carries no accent

The accent marks state alone, and the listing body follows it. `.toc .num` is muted because no listing row is a position you occupy, and the repeated status dot is gone because a mark reading the same on every live row reports nothing.

- The workspace row keeps its state word, the only one that can differ (`Stub`), and a lesson row carries none, since every listed lesson is written
- The glossary filter is an input with no border on the page ground with the term count beside it, `N terms` narrowing to `M of N terms` while a filter is typed
- The jump menus are a separate component and keep their own state marks

### Leading per step

Each step carries one leading across reading text, and `h3` takes 1.55 where the prototype drew 1.4, so a step holds one value. Controls keep their own tuning, since a one-line control is not reading text.

| Step              | Leading |
| ----------------- | ------- |
| `--t1`            | 1.1     |
| `--t2`            | 1.3     |
| `--t3` and `--t4` | 1.55    |
| `--t5`            | 1.6     |

### Literals that stay

Two literals stay on purpose. `code` sets `0.85em` and `pre code` sets `1em`, because inline code must scale with the text around it rather than sit at a fixed step. The chrome's `0.75rem` sizes and the figure caption's `1rem` are outside this mapping.

Spacing is untouched. `var(--space-*)` is still unused, and moving it changes what groups with what. Controls such as the option rows at 1.45 and the jump menu rows keep their own leading.
