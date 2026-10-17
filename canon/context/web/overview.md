---
title: Overview
description: What the landing page owns, its regions and states, its composition as one agent session, the layer order, motion, the nav, and the accepted costs
---

# Overview

## Overview

Owns `web/`, the Astro app behind the `canon.erclx.dev` landing page. It is one route, read as one agent session from the ask to the merge across eleven sections.

The site is the toolkit's own public face rather than code shipped to a target, so the application-code non-goal in `canon/REQUIREMENTS.md` does not reach it. `canon/context/tooling/index.md` carries the astro-stack mechanics this domain inherits.

## Layout

- `web/src/pages/` owns the one route, assembling the sections in reading order
- `web/src/components/beats/` owns the eleven beats, one component each, plus the turn and band primitives they render through
- `web/src/components/sections/` owns the sections around the beats: the fold, proof band, beat group, provenance ledger, install steps, field, and close
- `web/src/components/` owns the nav, the footer, and the `panel`, `panel-group`, and `panel-row` primitives, which no page imports since the gallery that rendered them retired
- `web/src/content/` owns page copy, each string tied to a `README.md` citation or a paraphrase marker

### Support folders

The remaining folders hold the build-time reads, the shell, the styles, and the tests.

- `web/src/lib/` owns the build-time reads, split into pure derivations and the CLI and file reads that feed them
- `web/src/layouts/` owns the shared page shell, and `web/src/styles/` the page stylesheet and the generated design tokens
- `web/e2e/` owns the Playwright suite
- `web/public/` owns the social card symlink, the evidence beat's fixed captures, and the build-time previews
- `web/card-src/` owns the social card route, a third Astro config

`canon/context/web/build.md` covers the build-time reads, the build, and deploy. `assets.md` covers the card, favicon, previews, and README images, and `capture.md` the visual checks.

## Surface

A reader arrives cold, scrolls once, and reads one real session from the ask to the merge. Every count in a section head is read from the repository at build time. The long-form copy lives in `web/src/content/copy.ts`, so it is not restated here.

### Regions

The page runs top to bottom through six regions.

- Skip link: first in the tab order, jumping to the start of the session
- Nav bar: sticky, carrying the mark, the version with a dot lit when it matches the published one, one link per named beat, the theme toggle, and the install action
- Fold: the headline, a one-line lede, two actions, and a before-and-after pair on one command, ending in a strip naming the one surface the command never copies
- Proof band: one claim on its own line at full width
- Beats: the eleven sections in reading order, sequenced under Composition below

A field of every command and skill name follows, with the used ones lit. Skills sit under the skill map's groups, and each name reveals its when-to-use text on hover, focus, and tap. The footer carries the brand line, three link columns, and a note on what is read and what is authored.

### States

Three states, each captured or reachable on its own.

- Light: the system prefers light or the reader picks it, on the warm light ground. Captured at `assets/evidence/home/1280--light.png`.
- Dark: the system prefers dark or the reader picks it, on its own derived dark ground rather than an inversion. Captured at `assets/evidence/home/1280--dark.png`.
- Still: the reader asks for reduced motion or opens `?still`, and every figure shows its end state with no build and no control motion

Every committed frame is also a still, since the capture creates its context with reduced motion and scrolls each section into view first. Whole-page frames sit beside a folder per section, so a change to one part reaches review as a diff on that part. `capture.md` carries the section list.

### Behavior

The page behaves the same in every state.

- The nav bar lights the beat the reader is on and jumps to any beat on selection. Below 900 pixels the beat links drop and the mark, toggle, and action stay.
- The theme follows the system preference before first paint, and the toggle overrides it and keeps the choice across a reload
- The evidence pair and the token preview load lazily as their beat nears the viewport
- The page reads without horizontal overflow from a 320 pixel viewport up, in both themes

### Not on this surface

Four things stay off the page.

- No placeholder figure. Every figure derives from a real file or is a real capture, except the branch graph, the review exchange, and the provenance roster, which the footer names as drawn.
- No full-bleed expansion cap, since a figure's height is a result of its content
- No window mockup assembled from boxes, since a real capture answers the question with more force
- No catalog tables, board snapshot, targets list, or teach workspace, since the page carries the session and nothing else

## Decisions

### Composition

The page is one agent session read top to bottom. The ask comes first, then the rules whose globs match the touched path, the skill, the plan, the dispatch, the workers, the test gate, the review from a session that did not write the change, and the merge. The provenance ledger, install steps, field, and close follow.

Cause precedes effect throughout, which is why the skill beat sits ahead of the plan. The reference build is `.canon/groundwork/95-visual-direction/evidence/system-15/`, and no earlier build in that folder is a source.

### Every claim names something the tool did

Every figure that can derive does, from a real file or a CLI read at build time. Drawing figures from real data falsified three claims prose review had read past: a numerator nobody counted, a denominator read from the wrong root, and a hook action the hook does not perform.

### Eight layout families

The reference holds eleven sections in eight families: the fold, proof band, `grp`, `arc`, provenance ledger, install steps, field, and close. A tint on a family is a modifier, not a family.

- The structural rule is the tint alternation, and `arc` exists so the two machine beats do not become a fourth and fifth `grp`
- `sections/group.astro` carries the family and tint as props, so a beat never knows which family it sits in
- Each beat is its own component and `index.astro` only arranges them, so two builds touching different beats touch different files
- Shared type, section families, actions, and the build treatment sit in `global.css`, and each figure's internals sit scoped in its component

### Layer order

A redesign works the layers lowest first: content, composition, layout, space, type, surface, palette, imagery, motion, states. A lower layer constrains every layer above it, so a decision taken at the wrong altitude is overturned by one below it.

### Tokens, type, and styling

`global.css` maps the reference's role names onto the generated tokens rather than inlining its values. Five roles map directly. The figure card is the background in light and the chrome step in dark, because the dark surface ladder climbs where the light one descends, so one token cannot sit one step above the ground in both themes.

- Monospace is retired as a role on this page, so `code` inherits Geist like everything else
- `base.astro` embeds the vendored Geist face from `src/design/fonts.ts`, since `tokens.css` names Geist for every role and nothing else serves it
- `global.css` rules sit inside `@layer base`, since Tailwind v4 generates utilities inside `@layer utilities`, where an unlayered rule always wins regardless of specificity

### Motion

Two figures build on arrival, the merge fan and the provenance ledger, since only they have the shape of a cause and its consequences. The node appears and each consequence follows 90ms later.

Bands do not rise, because a page partly invisible until scrolled captures as blank pixels. The class lands whatever the motion preference and the stylesheet decides whether it animates, so reduced motion or `?still` reaches the end state without a scroll. Every control takes a 160ms hover, press, and focus response.

### The nav

The nav is a sticky flat bar rather than a floating pill. A pill floats over a centered headline and reads wrong there, and the bands alternate tints, so the bar takes the ground as its own surface.

It measures its rendered height into `--nav-height`, re-measured by a `ResizeObserver`, because `scroll-padding-top` derives an anchor's landing from it and a hand-written height goes stale silently.

### Accepted costs

The page accepts five costs.

- The `grp` family appears three times, separated by the tint alternation and three distinct figure shapes, since a shape that changed every time would read as chapters
- The install section is three equal cards, the one shape the rules otherwise avoid, since three parallel install routes are three equal things
- The authored figures do not meet the derivation rule. The footer labels them, and the other repairs are a record of the session that produced them or retiring them.
- `error` and `warning` share a register with the accent, so a lightness or an icon must carry the meaning. The work is unscheduled.
- Undecided: glass on the sticky bar, the one element with content passing under it. Glass as a system was rejected, since it needs motion behind it and makes the ground variable.
