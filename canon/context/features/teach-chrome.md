---
title: Teach chrome
description: The teach page's chrome, sidebar, type scale, and typed browser scripts, with the decisions behind them
---

# Teach chrome

## Overview

The chrome is the masthead, breadcrumb, sidebar, footer nav, and reading bar `canon teach nav` splices into every teach page. `teach.md` carries the workspace, the splice, and the verbs. This entry carries the browser side: how the chrome is built and styled, and the scripts it runs.

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

- `canon/context/features/teach.md`: the workspace, the chrome splice, and the verbs
- `canon/context/design/tokens.md`: the token values a workspace stylesheet is seeded from
