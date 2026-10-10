---
title: Chrome
description: The teach page chrome, its regions and breadcrumb, sidebar, type scale, and typed browser scripts, with the decisions behind them
---

# Chrome

## Overview

The chrome is the masthead, breadcrumb, sidebar, footer nav, and reading bar `canon teach nav` splices into every teach page. `overview.md` carries the workspace, the splice, and the verbs. This entry carries the browser side: how the chrome is built and styled, and the scripts it runs.

## Surface

Every page shares one header and one course sidebar, built by `renderHeader` and `renderSidebar` in `src/teach/nav.ts` and styled by the chrome rules in `examples/teach/course.css`. The bar is `--teach-mast-h`, 3.5rem tall, and its row spans the window rather than the reading measure, so the collapse and theme controls sit at the same inset on every page. The foot nav shares the article's measure, and an anchor jump lands below the bar rather than behind it.

### Regions

- Sidebar (`.sb`): the left column, holding the workspace switcher at its top, a meta line, the page list, and a foot line. Above 1100px it sits beside the pane and at 1100px and below it overlays the page
- Masthead (`.mast`): sticky across the top of the pane, holding the collapse control and the breadcrumb on the left and the theme toggle on the right
- Reading bar: a strip along the masthead's bottom edge that fills left to right with position in the page. It is the one motion the chrome carries, and it reports position inside the lesson where the sidebar reports position in the course
- Jump menu: a panel under whichever crumb caret opened it, overlapping the page content below it rather than pushing it down
- Pane (`.pane`): right of the sidebar and under the masthead, holding the page's own `<main>`

### Breadcrumb

The crumb grows with depth. The root has one segment, `Workspaces`. A contents page has two, with the workspace after it, and a lesson has three, ending in `Lesson N of M`. A reference page puts the page's title in the third place. Only that trailing segment drops its jump menu, and every other one, current page or not, still opens one.

A crumb and its caret form one chip. The label goes to the page, the caret opens the menu, and the whole chip fills with the chrome hover ground while the pointer is over it or its menu is open. Crumb links are neutral rather than accented, since the accent marks where you are rather than where you can go, and the caret stays drawn and muted in every state. The trailing segment reads `Lesson N of M` until the lesson's own title scrolls off and carries the title afterwards.

The `☰` control left of the crumb collapses the sidebar. It is the panel's only trigger at any window width, and below 1100px it opens the panel over the lesson rather than beside it.

### States and behavior

- sidebar-open: a lesson or reference page loads, and the sidebar sits beside the pane
- sidebar-shut: the root or a contents page loads, and the pane takes the full width under the masthead
- jump-menu-open: the visitor hovers or clicks a crumb caret, and the menu panel opens under its trigger. A row pairs a two-digit ordinal with the item's name, marked as the current page where it is, with a lesson count trailing in the workspace menu and nothing in the lesson menu
- Opening one jump menu closes any other already open, the sidebar's workspace switcher included. A click outside every menu closes it, and Escape does too and returns focus to the trigger
- A breadcrumb menu opens on hover as well as click, and a click on a panel hover already opened keeps it open. The sidebar's switcher stays click-only, since its panel opens over the lesson list the pointer is headed toward
- The theme toggle flips light and dark and remembers the pick in the visitor's own browser, falling back to the system preference
- The sidebar's workspace heading stops at two lines with an ellipsis and carries the whole title in its `title` attribute, so a long title stays inside the top band

### Not on this surface

- No search across workspaces or lessons, since the sidebar filter narrows one workspace's lesson list only
- No account, sign-in, or sync control, since every page is a local file
- No progress saved per visitor beyond the theme and the sidebar's width and open state

## Decisions

**A page's scripts are typed modules in `src/teach/browser/`, transpiled by `compileScript` as a page is generated.** The transpiler does not bundle, so a module runs only its own source: a value arrives as a JSON argument and a shared function such as `focusLine` as a helper `compileScript` declares ahead of it. Inline strings were the alternative.

**The chrome's markup and its CSS come from different files.** `src/teach/nav.ts` emits the header, the footer nav and the contents pages, while every chrome rule is generated from `TEACH_CHROME` in `src/design/components.ts`, so a repair to how the chrome looks lands in the second file. `nav` seeds a workspace's stylesheet pair when `course.css` is absent, rewrites `assets/base.css` wherever one exists, never overwrites `course.css`, and drops the `@import` from the copy a lesson embeds, since that line resolves against the lesson's folder. The base sheet reaches a lesson through a `<link>` the `style` region carries ahead of the embedded rules, emitted only where `assets/base.css` exists. Embedding it was the alternative, and it repeats a sheet carrying its fonts inline in every lesson.

**Teach reads the design module's faces and keeps only the hand pair as its own.** `--teach-sans` and `--teach-mono` resolve to `--type-body-family` and `--type-code-family`, and `TEACH_FONT_FACES` is `FONT_FACES` plus `HAND_DRAWN_FONT_FACES`, so a face change reaches teach with no edit here. Font sizes equal to a step read `--t2` through `--t6`, and the sizes between steps stay as chrome tuning until a taste pass takes them. Keeping teach's own Nunito and Cascadia Code was the alternative, and it left the tree rendering three families where the design record names two.

**The course is a collapsible sidebar rather than a segmented strip in the bar.** The strip gave each lesson one `flex: 1` segment and rendered fifty of them as a row of dots, which is the scale a reader most needs it at. The sidebar reports position in the course at any length, the masthead's bottom edge reports position inside the lesson, and the in-lesson outline folds under the lesson being read rather than sitting in a right-hand rail that only existed above 1420px. Below 1100px the panel opens over the lesson with a scrim rather than hiding, since the breadcrumb menu carries a flat lesson list and neither the filter nor the outline.

**The sidebar and everything else lay out as a flex row, which constrains where the page's bottom room can sit.** A flex item's sticky containing block is the flex container's content box, so bottom padding on `body` is space the sidebar can never travel into and it rides up by exactly that much near the foot of a short page. The room moves onto `.pane`, which is what it was spacing anyway, and that pane needs `box-sizing: border-box` beside its `min-height: 100vh` or the same padding scrolls every short page. Both reproduce only at a window tall enough for the page to be short, which reads as intermittent, and neither is visible in markup review.

**The chrome matches the nav-04 prototype except in six places.** Both sides were compared as computed styles at three widths in both themes, frame by frame across rest, hover and open states, and nothing departs beyond these.

- The jump menu is one component in both mounts. The prototype drew the breadcrumb menu as a grid at `0.38rem` row padding and the sidebar switcher as a flex row at `0.34rem` with a 12px numeral. Both now take the breadcrumb recipe, so the switcher opens 4px taller than drawn and its numeral is a pixel smaller.
- The current row's numeral takes the accent in both menus. The prototype muted it in the breadcrumb menu and kept the accent in the switcher, so one of its mounts had to give way, and the accent is what marks where you are.
- A breadcrumb menu row fills with `--color-chrome` on hover. The prototype left that mount on `--color-surface` while moving every other hover in the chrome to the chrome ground, and the row rule is shared with the switcher, which it moved.
- `.bar` keeps its own side padding, `1.5rem` wide and `1rem` on a phone, under the `0.9rem` the full-width `.mast` adds. The prototype's `.bar` computes that same padding, so the controls sit 38px in from the window edge on both.
- `.track` and `.outline` are gone from the markup. The prototype kept both elements and hid them with `display: none`.
- The trailing count column keeps `text-align: right`, where the prototype's flex switcher row read `start`. The column is sized to its content, so the value moves nothing.

**Reading rules sit on the declared type scale**, `--t1` through `--t6`, and the body carries no phone override, since the steps are the same at every width. The mapping is the nav-04 prototype's `data-scale` block landed as the default, with two changes. `h3` reads `--t3` but the glossary group label keeps its own `--t5`, because the prototype's `main h3` selector would have painted that label at 18px and it never rendered a glossary page. `th`, `.nav .lbl`, the panel labels, the glossary group label and the two quiz tags drop their uppercase and tracking, matching the sentence case the landing page already uses. The quiz tags write their own text in `content`, so the strings are capitalized in the rule.

**The listing body carries no accent and no status dot.** The accent marks state alone, and the listing body follows it: `.toc .num` is muted because no listing row is a position you occupy, and the repeated status dot is gone because a mark reading the same on every live row reports nothing. The workspace row keeps its state word, which is the only one that can differ (`Stub`), and a lesson row carries none, since every listed lesson is written. The glossary filter is an input with no border on the page ground with the term count beside it, `N terms` narrowing to `M of N terms` while a filter is typed. The jump menus are a separate component and keep their own state marks.

Each step carries one leading across reading text: 1.1 on `--t1`, 1.3 on `--t2`, 1.55 on `--t3` and `--t4`, and 1.6 on `--t5`. `h3` takes 1.55 where the prototype drew 1.4, so a step holds one value. Controls keep their own tuning, such as the option rows at 1.45 and the jump menu rows, since a one-line control is not reading text.

Two literals stay on purpose. `code` sets `0.85em` and `pre code` sets `1em`, because inline code must scale with the text around it rather than sit at a fixed step. The chrome's `0.75rem` sizes and the figure caption's `1rem` are outside this mapping and remain literals. Spacing is untouched: `var(--space-*)` is still unused, and moving it changes what groups with what.

## Related

- `canon/context/features/teach/overview.md`: the workspace, the chrome splice, and the verbs
- `canon/context/features/teach/pages.md`: what each page kind shows and does under this chrome
- `canon/context/design/tokens.md`: the token values a workspace stylesheet is seeded from
