---
title: Teach
description: Learning workspace layout, the chrome splice, the committed fixture, and the canon teach verbs
---

# Teach

## Overview

A learning workspace is a folder of standalone HTML lessons a learner opens directly, with a mission, a glossary, resource pages and learning records beside them. `canon teach` opens a workspace, resolves what the next lesson needs, seeds a stylesheet from the design tokens, and splices navigation chrome into every lesson.

Two standards fix the artifact and one skill drives the pedagogy. `standards/teach.md` fixes layout, ordinal naming, frontmatter, and the mission and learning-record formats. `standards/glossary.md` fixes the glossary. The shipped `teach-workspace` skill decides what to teach next, which is deliberately not a standard.

## Layout

- `src/teach/`: the implementation. `workspace.ts` resolves roots and reads a workspace, `nav.ts` splices lesson chrome, `lesson.ts` resolves what a lesson needs and draws its quiz order, `render.ts` and `html/` turn a body block list into HTML, `components/` and `fonts.ts` carry the chrome's own pieces.
- `examples/teach/`: the committed fixture, rooted at `00-fixture/`, which is what development renders against.
- `.canon/teach/`: the operator's live workspaces, gitignored and backed through `canon records push`.

## Decisions

**A workspace is named `<nn>-<topic>` rather than by a bare slug**, so a listing sorts by when each opened. It is the first record folder to take that shape, which was free because the surface was greenfield. `canon/context/standards/per-standard/surfaces.md` carries the decision and the groundwork and intake folders' shared sequence beside it.

**Quiz option order is drawn by `canon teach lesson` rather than chosen by the author.** An author told to vary a position still varies it by judgment, and a verb is a check where an instruction is a hope. What the split cannot close is that the body remains free to reorder what the verb reports, since nothing downstream compares the two, which is recorded rather than fixed.

**The chrome is spliced into each lesson rather than inserted by a template.** A lesson is a standalone file a learner opens with no build step, so a template would introduce one and a copied header would drift per lesson. The splice keeps the file directly openable and the chrome uniform, at the cost that an authored file and a generated one share a path.

**The chrome's markup and its CSS come from different files.** `src/teach/nav.ts` emits the header, the footer nav and the contents pages, while every chrome rule is generated from `TEACH_CHROME` in `src/design/components.ts`, so a repair to how the chrome looks lands in the second file. `nav` seeds a workspace's stylesheet pair when `course.css` is absent, never overwrites it, and drops the `@import` from the copy a lesson embeds, since that line resolves against the lesson's folder. The base sheet reaches a lesson through a `<link>` the `style` region carries ahead of the embedded rules, emitted only where `assets/base.css` exists. Embedding it was the alternative, and it repeats a sheet carrying its fonts inline in every lesson.

**`nav` supplies the lesson skeleton outside the markers rather than a fifth marker.** The authoring skill has a session write four empty marker pairs and a bare body, and the page also needs a `<main>` for the column width and the base stylesheet link. `nav` links the sheet from the `style` region and wraps the authored body in `<main>` when it holds none, which is markup outside every region, as dropping the hand-written icon and `course.css` link already was. A fifth marker was the alternative, and every lesson already written would lack it.

**A reference page is rendered by `nav` to an HTML sibling rather than by the server.** `canon serve` hands `.md` over as plain text, so the contents page linked a page meant for rereading as raw frontmatter and pipe tables. `nav` renders each `reference/<slug>.md` to `reference/<slug>.html` through `Bun.markdown.html`, escaping raw HTML, and links that instead, leaving the markdown as the promotable half. A markdown renderer inside `canon serve` was the alternative, and it would put a teach-specific concern into a verb that also serves slides and design previews. The cost is the lesson splice's own: the HTML is stale until the next `nav` run after the markdown changes, and a hand edit to it is lost with nothing reporting it.

**Teach reads the design module's faces and keeps only the hand pair as its own.** `--teach-sans` and `--teach-mono` resolve to `--type-body-family` and `--type-code-family`, and `TEACH_FONT_FACES` is `FONT_FACES` plus `HAND_DRAWN_FONT_FACES`, so a face change reaches teach with no edit here. Font sizes equal to a step read `--t2` through `--t6`, and the sizes between steps stay as chrome tuning until a taste pass takes them. Keeping teach's own Nunito and Cascadia Code was the alternative, and it left the tree rendering three families where the design record names two.

**The course is a collapsible sidebar rather than a segmented strip in the bar.** The strip gave each lesson one `flex: 1` segment and rendered fifty of them as a row of dots, which is the scale a reader most needs it at. The sidebar reports position in the course at any length, the masthead's bottom edge reports position inside the lesson, and the in-lesson outline folds under the lesson being read rather than sitting in a right-hand rail that only existed above 1420px. Below 1100px the panel opens over the lesson with a scrim rather than hiding, since the breadcrumb menu carries a flat lesson list and neither the filter nor the outline.

**The sidebar and everything else lay out as a flex row, which constrains where the page's bottom room can sit.** A flex item's sticky containing block is the flex container's content box, so bottom padding on `body` is space the sidebar can never travel into and it rides up by exactly that much near the foot of a short page. The room moves onto `.pane`, which is what it was spacing anyway, and that pane needs `box-sizing: border-box` beside its `min-height: 100vh` or the same padding scrolls every short page. Both reproduce only at a window tall enough for the page to be short, which reads as intermittent, and neither is visible in markup review.

**`canon teach list` prints the `canon serve` line with the teach folder it read, rather than a literal `.canon/teach`.** `canon serve` resolves its directory against the cwd while the list verb reads the main worktree root, so the literal serves an absent folder from a linked worktree. The folder prints relative to the cwd when it sits under it and absolute otherwise, since a `../` path climbing out of a worktree reads as a mistake. The static `--help` footer keeps the literal and points at `list <topic>` for the exact line, and the JSON record carries no serve field.

**A durable page promoted out of a workspace routes through a file of its own**, at `.canon/tmp/handoff/teach-promotion/<slug>.md`, which `docs-fold` folds and deletes. Sharing the memory-routing handoff was the obvious reuse and is what the pattern cannot take, since that file already has two writers and a reader that deletes it.

## Departures from the nav-04 prototype

The chrome matches the nav-04 prototype, measured as computed styles on both sides at three widths in both themes and compared frame by frame across rest, hover and open states. Where it does not match, the reason is below, and nothing else departs.

- The jump menu is one component in both mounts. The prototype drew the breadcrumb menu as a grid at `0.38rem` row padding and the sidebar switcher as a flex row at `0.34rem` with a 12px numeral. Both now take the breadcrumb recipe, so the switcher opens 4px taller than drawn and its numeral is a pixel smaller.
- The current row's numeral takes the accent in both menus. The prototype muted it in the breadcrumb menu and kept the accent in the switcher, so one of its mounts had to give way, and the accent is what marks where you are.
- A breadcrumb menu row fills with `--color-chrome` on hover. The prototype left that mount on `--color-surface` while moving every other hover in the chrome to the chrome ground, and the row rule is shared with the switcher, which it moved.
- `.bar` keeps its own side padding, `1.5rem` wide and `1rem` on a phone, under the `0.9rem` the full-width `.mast` adds. The prototype's `.bar` computes that same padding, so the controls sit 38px in from the window edge on both.
- `.track` and `.outline` are gone from the markup. The prototype kept both elements and hid them with `display: none`.
- The trailing count column keeps `text-align: right`, where the prototype's flex switcher row read `start`. The column is sized to its content, so the value moves nothing.

## The reading rules sit on the declared type scale

Every reading rule takes its size from `--t1` through `--t6`, and the body carries no phone override, since the steps are the same at every width. The mapping is the nav-04 prototype's `data-scale` block landed as the default, with two changes. `h3` reads `--t3` but the glossary group label keeps its own `--t5`, because the prototype's `main h3` selector would have painted that label at 18px and it never rendered a glossary page. `th`, `.nav .lbl`, the panel labels, the glossary group label and the two quiz tags drop their uppercase and tracking, matching the sentence case the landing page already uses. The quiz tags write their own text in `content`, so the strings are capitalized in the rule.

## The listing body carries no accent and no status dot

The chrome pass narrowed the accent to marking state, and the listing body follows it: `.toc .num` is muted because no listing row is a position you occupy, and the repeated status dot is gone because a mark reading the same on every live row reports nothing. The workspace row keeps its state word, which is the only one that can differ (`Stub`), and a lesson row carries none, since every listed lesson is written. The glossary filter is an input with no border on the page ground with the term count beside it, `N terms` narrowing to `M of N terms` while a filter is typed. The jump menus are a separate component and keep their own state marks.

Each step carries one leading across reading text: 1.1 on `--t1`, 1.3 on `--t2`, 1.55 on `--t3` and `--t4`, and 1.6 on `--t5`. `h3` takes 1.55 where the prototype drew 1.4, so a step holds one value. Controls keep their own tuning, such as the option rows at 1.45 and the jump menu rows, since a one-line control is not reading text.

Two literals stay on purpose. `code` sets `0.85em` and `pre code` sets `1em`, because inline code must scale with the text around it rather than sit at a fixed step. The chrome's `0.75rem` sizes and the figure caption's `1rem` are outside this mapping and remain literals. Spacing is untouched: `var(--space-*)` is still unused, and moving it changes what groups with what.

## Gotchas

- `canon teach nav` rewrites lessons in place and refuses a lesson missing its four marker pairs, `canon:teach:style`, `canon:teach:header`, `canon:teach:footnav` and `canon:teach:scripts`. A hand-edit inside a pair is overwritten by the next run with nothing reporting it. The authored heading, lede, body and quiz sit between the header and footnav markers and are left untouched, apart from a `<main>` wrap where they hold none and a link on each "lesson NNNN" mention. Nav owns only a link carrying `data-lesson-ref`, so it re-points one after a slug rename and unwraps one whose number stopped resolving, and it reports that number under `unresolved` rather than rewriting it.
- One `nav` run rewrites the teach root, the contents pages, and every lesson's chrome, so its diff reaches files the change did not name. That is the verb working rather than a defect, and the diff is still the cheapest place to notice a wrong pipeline change.
- `canon teach nav` seeds a workspace's stylesheet pair only when `course.css` is absent, so a change to `TEACH_CHROME` never reaches a workspace that already has one. Running `nav` alone leaves every lesson linking the `base.css` the workspace was seeded with, which renders as a page missing whatever the change added.
- No browser harness in this repository reaches a generated teach page. `web/playwright.config.ts` is the only browser config that is not a seed for a target, and nothing under `web/e2e/` names teach, so what a rendered lesson does has nowhere to be asserted above the unit layer. A change carrying collapse, resize, filter, focus, or overlay work therefore ships it named as untested rather than covered, and what is missing is the harness rather than a person to look.
- Regenerating the fixture takes `bun src/cli.ts teach ...` rather than an installed `canon`. The installed binary carries the components it was published with, so a branch that changes `src/design/components.ts` regenerates the older stylesheet and reverts whatever landed since, with nothing failing.
- The committed fixture is prettier-formatted after a `nav` run, and prettier closes a void tag as `/>`. Anything `nav` later matches in a page it generated, such as the reference page's generator meta tag that the orphan sweep keys on, has to accept both `>` and `/>`. Prettier also wraps a closing tag across a line as `</a\n>`, so the lesson-link pass matches a nav-owned link's close as `</a\s*>`, or a formatted lesson never re-points after a slug rename.
- `Bun.markdown` is writable but not configurable, so a test stubbing its absence sets it with `Reflect.set` and restores it after. `Object.defineProperty` throws there.
- `canon teach stylesheet <topic>` rewrites the generated half, `assets/base.css`, unconditionally. A components change therefore takes that verb per workspace, and the lessons pick it up through their `base.css` link with no `nav` run. Only the workspace's own `course.css` rules are embedded, so an edit there is what still takes `nav`.
- `workspace.ts` resolves a root whose basename is already `teach` as that root rather than nesting a second `teach` below it, so a path ending in `teach` behaves differently from one that does not.
- A bare `canon teach list` reads the operator's live workspaces. Reaching the committed fixture takes `--root examples/teach`, and a claim about the fixture made without the flag describes a different tree.
- `governance/rules/claude/561-teach.md` is scoped to `.canon/teach/**`, which is workspace content. It reaches neither `src/teach/` nor `examples/teach/`, so an implementation or fixture edit is routed by the `internal-teach` skill rather than by that rule. Widening the rule is wrong, since it ships to targets through governance sync and a target has no `src/teach/`.
- Renders committed under `examples/` are disclaimed rather than gated, because nothing outside `examples/` depends on them staying current. `canon/context/web/assets.md` draws that line between `assets/` and `examples/` on who each folder addresses.

## Related

- `canon standards teach`: the workspace artifact
- `canon standards glossary`: the glossary every workspace carries
- `claude/skills/teach-workspace/`: the pedagogy and the promotion handoff
- `canon/context/design/tokens.md`: the token values a workspace stylesheet is seeded from
