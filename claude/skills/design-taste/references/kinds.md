---
title: Rules by kind
description: What each broad surface kind optimizes for, where a rule written for one is wrong for another, and which surface governs the kinds this file does not cover
---

# Rules by kind

Read this once the declared read names a kind. The body's rules hold on every kind. This file holds only what differs, because a rule that holds everywhere belongs in the body and a rule stated twice drifts.

## Marketing and promotional

Landing pages, campaign pages, portfolios. The reader has never used the thing and owes it no attention.

- **Optimizes for** comprehension in the first screen, then one clear next action.
- **Composition carries the weight.** A marketing page is judged on section order and variation first, so a palette round against a flat composition changes nothing a reader notices.
- **The story carries an arc.** It states the order a stranger meets the claims in, settled before any composition, so section order follows the argument rather than a template.
- **Vary the section shape.** Alternate alignment, container width and the ratio between sections. Every section a centered heading over centered body reads as a template whatever its values.
- **Low density around a finished picture.** Whitespace argues the thing is considered, so less on screen usually wins here. A section holding only a heading and a sentence in open space reads as bare.
- **Every claim names a real thing.** A page asserting what a tool does, illustrated by something the tool did not produce, breaks its own thesis in the place it is making it.
- **Each section shows an outcome.** It carries its own picture of what the reader ends up with, such as the finished record. Describing the mechanism alone leaves a stranger to imagine the result.
- **No motif carries two sections.** A real thing takes several forms, such as a record, a board, a diff, or a rendered page. Once one form pictures a section, every other section reaches for another.
- **Motion is permitted and rationed.** Entrance motion for what genuinely leads the eye, nothing looping forever.
- **Where a rule from another kind is wrong here:** dense tabular comparison, persistent chrome, and state indicators all read as product UI leaking onto a marketing page.

## Application and product UI

Dashboards, tools, admin surfaces, agentic and assistant interfaces. The reader is mid-task and already knows the domain.

- **Optimizes for** throughput and state legibility. How fast can the reader see what is happening and act on it.
- **High density is correct.** Cramming is a failure and spaciousness is also a failure, since a surface that shows six rows where thirty fit costs the reader a scroll per glance.
- **The states carry the design weight.** Loading, empty, error, partial and stale are most of what the reader sees on this kind, so they are composed rather than handled.
- **Whether each state exists** is the `ui-craft` skill's question, not this file's.
- **An agentic surface adds three states.** Work running with something to read, work that needs the person, and work finished with a result to inspect. Each rests visibly, never as a spinner.
- **Chrome is persistent and quiet.** Navigation, status and context stay put and stay recessive, since they are read constantly and looked at rarely.
- **Motion is feedback, not entrance.** A thing moving should be reporting that something changed.
- **The visual direction lends four things.** Type, palette, density, and one signature move. Layout, the navigation model, and the controls stay the category's own.
- **A borrowed interface lends the same four.** A direction taken from a terminal or an instrument panel gives only what transfers, and the working screen never dresses up as its source.
- **Check each render against its category.** Cover the product name and ask whether the screen reads as a tool of its kind and whether the task can be done from it.
- **A command shows its shortcut.** A menu row carries the keys at its right edge and a tooltip names them beside the command, in the platform's own spelling.
- **Where a rule from another kind is wrong here:** generous whitespace, entrance animation on every panel, and hero-scale typography all read as a marketing page wearing a product's clothes.

The direction limits and the category check restate [Impeccable](https://github.com/pbakaus/impeccable)'s guidance for app screens. The shortcut placement follows [NN/g](https://www.nngroup.com/articles/ui-copy/).

### Where a screen spends its space

A generated app screen tends to borrow a reading page's proportions, so the task shrinks to a column, swells on a phone, or slips below the fold.

- **The working area fills the window.** A wider window shows more of the task, such as a list and its detail side by side. Measure caps prose, never the screen around it.
- **Text and controls stay at platform size.** Body text keeps the platform's default text size, left unset at the root on the web, and a control stops at the target in the `ui-craft` pointer reference.
- **The screen's own item shows without scrolling.** What the screen exists for, such as the record being edited, sits in view at the narrowest width the product supports.

Android's [canonical layouts](https://developer.android.com/develop/ui/views/layout/canonical-layouts) back the full working area. Apple's [typography guidance](https://developer.apple.com/design/human-interface-guidelines/typography) backs the platform size, since a fixed figure overrides a person's own text setting. Most viewing time falls above the fold, per NN/g on [scrolling and attention](https://www.nngroup.com/articles/scrolling-and-attention/).

### What a screen keeps and shows

A screen built under the tells can strip what its category relies on, and a build that never rendered can ship two states at once.

- **One state per view.** Draw each composed state in a view or frame of its own, with the others reachable from it. An empty state drawn under a full list ships two states at once.
- **Keep the category's conventions.** A reader expects grouped cards for records of one kind, in one tone, with status marks and a detail panel. The card and one-tone tells in `tells.md` yield here.

## Content and long-form

Documentation, articles, reference pages, learning material. The reader arrived to read and will stay if reading is comfortable.

- **Optimizes for** sustained reading and for finding one thing without reading everything.
- **Measure is capped** so the eye reaches the next line without hunting.
- **Hierarchy comes from weight and space** rather than from size. A page of large headings reads as shouting and flattens the levels below.
- **Navigation is a map.** A reader who cannot see where they are in the whole cannot judge whether to keep going, which is what a scrollspy or a persistent outline buys.
- **Code, tables and figures are first-class.** They are what the reader scans for, so they are styled as content rather than as interruptions.
- **Motion is almost always wrong.** Movement during reading competes with reading.
- **Where a rule from another kind is wrong here:** application density makes long prose unreadable, and marketing whitespace between every paragraph breaks a section into unrelated fragments.

## Kinds this file does not cover

- **Transactional flows** such as checkout, sign-up and settings are read as application UI. Their distinctive rules, state coverage and error recovery, sit in the `ui-craft` skill.
- **Terminal and text-mode surfaces** have no layout engine and their own color rules, stated where the writing surface is decided rather than here.

A read naming any of the three above takes the body's rules and says it has no per-kind guidance, naming the surface that governs it. A read naming a kind this file does not list at all says so rather than borrowing the nearest section.
