---
title: Rules by kind
description: What each broad surface kind optimizes for, where a rule written for one is wrong for another, and which surface governs the kinds this file does not cover
---

# Rules by kind

Read this once the declared read names a kind. The body's rules hold on every kind. This file holds only what differs, because a rule that holds everywhere belongs in the body and a rule stated twice drifts.

## Marketing and promotional

Landing pages, campaign pages, portfolios. The reader has never used the thing and owes it no attention.

- **Optimizes for** comprehension in the first screen, then one clear next action.
- **Composition carries the weight.** A marketing page is judged on section order and variation before anything else, which is why a palette round against a flat composition changes nothing a reader notices.
- **Vary the section shape.** Alternate alignment, container width and the ratio between sections. A page where every section is a centered heading over centered body reads as a template regardless of its values.
- **Low density.** Whitespace is the argument that the thing is considered. This is the one kind where less information on screen is usually better.
- **Every claim names a real thing.** A page asserting what a tool does, illustrated by something the tool did not produce, breaks its own thesis in the place it is making it.
- **Motion is permitted and rationed.** Entrance motion for what genuinely leads the eye, nothing looping forever.
- **Where a rule from another kind is wrong here:** dense tabular comparison, persistent chrome, and state indicators all read as product UI leaking onto a marketing page.

## Application and product UI

Dashboards, tools, admin surfaces, agentic and assistant interfaces. The reader is mid-task and already knows the domain.

- **Optimizes for** throughput and state legibility. How fast can the reader see what is happening and act on it.
- **High density is correct.** Cramming is a failure and spaciousness is also a failure, since a surface that shows six rows where thirty fit costs the reader a scroll per glance.
- **The states carry the design weight.** Loading, empty, error, partial and stale are not edge cases on this kind, they are most of what the reader sees, so they are composed rather than handled. Whether each exists at all is the `ui` rules' question and not this one.
- **An agentic surface adds three states of its own:** work in progress with something to read while it runs, work that needs the person before it continues, and work that finished with a result to inspect. Each needs a visible resting place and none should be a spinner.
- **Chrome is persistent and quiet.** Navigation, status and context stay put and stay recessive, since they are read constantly and looked at rarely.
- **Motion is feedback, not entrance.** A thing moving should be reporting that something changed.
- **Where a rule from another kind is wrong here:** generous whitespace, entrance animation on every panel, and hero-scale typography all read as a marketing page wearing a product's clothes.

## Content and long-form

Documentation, articles, reference pages, learning material. The reader arrived to read and will stay if reading is comfortable.

- **Optimizes for** sustained reading and for finding one thing without reading everything.
- **Measure is capped** so the eye reaches the next line without hunting.
- **Hierarchy comes from weight and space** rather than from size. A page of large headings reads as shouting and flattens the levels below.
- **Navigation is a map.** A reader who cannot see where they are in the whole cannot judge whether to keep going, which is what a scrollspy or a persistent outline buys.
- **Code, tables and figures are first-class.** They are what the reader scans for, so they are styled as content rather than as interruptions.
- **Motion is almost always wrong.** Movement during reading competes with reading.
- **Where a rule from another kind is wrong here:** density tuned for an application surface makes long prose unreadable, and marketing whitespace between every paragraph breaks a section into unrelated fragments.

## Kinds this file does not cover

- **Transactional flows** such as checkout, sign-up and settings are read as application UI. Their distinctive rules are state coverage and error recovery, which the `ui` governance rules already carry.
- **Presentation surfaces** such as slide decks are governed by `${CLAUDE_SKILL_DIR}/../../standards/slides.md` and drafted by `draft-slides`. Take the layer ordering and the floor from the body and the rest from there.
- **Terminal and text-mode surfaces** have no layout engine and their own color rules, stated where the writing surface is decided rather than here.

A read naming any of the three above takes the body's rules and says it has no per-kind guidance, naming the surface that governs it. A read naming a kind this file does not list at all says so rather than borrowing the nearest section.
