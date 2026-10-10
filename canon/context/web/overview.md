---
title: Overview
description: What the landing page domain owns, its regions, states, and exclusions, its composition as one agent session, the layer order a redesign works in, motion and type, the nav, and the costs the page accepts
---

# Overview

## Overview

Owns `web/`, the Astro app behind the `canon.erclx.dev` landing page: one route, read as one agent session from the ask to the merge across eleven sections. This is the toolkit's own public site rather than code shipped to a target project, so the application-code non-goal in `canon/REQUIREMENTS.md` does not reach it. `## Surface` below carries the regions, states, and exclusions, and `canon/context/tooling/index.md` carries the astro-stack mechanics this domain inherits.

## Layout

- `web/src/pages/` owns the one route, assembling the sections in reading order
- `web/src/components/beats/` owns the eleven beats of the session, one component each, plus the turn and band primitives they render through
- `web/src/components/sections/` owns the sections around the beats: the fold, the proof band, the beat group, the provenance ledger, the install steps, the field, and the close
- `web/src/components/` owns the site chrome, being the nav and the footer, and the panel primitives `panel`, `panel-group`, and `panel-row`, which no page imports since the component gallery that rendered them retired
- `web/src/content/` owns page copy, each string tied to a `README.md` citation or a paraphrase marker
- `web/src/lib/` owns the build-time reads, split into the pure derivations and the CLI and file reads that feed them
- `web/src/layouts/` owns the shared page shell
- `web/src/styles/` owns the page stylesheet and the generated design tokens
- `web/e2e/` owns the Playwright suite
- `web/public/` owns the social card symlink, the evidence beat's fixed captures, and the build-time previews
- `web/card-src/` owns the social card route, a third Astro config

`canon/context/web/build.md` covers the build-time reads, the build, and deploy, `canon/context/web/assets.md` the social card, favicon, previews, and README images, and `canon/context/web/capture.md` the visual checks and the capture of this page.

## Surface

The page is the toolkit's one outward-facing route, and a reader arrives cold, scrolls once, and reads one real session from the ask to the merge. Every count in a section head is read from the repository at build time. The long-form copy lives in `web/src/content/copy.ts`, each string tied to a `README.md` citation, so it is not restated here.

### Regions

- Skip link: first in the tab order, jumping to the start of the session
- Nav bar: sticky at the top, carrying the mark, the version with a dot lit when it matches the published one, one link per named beat, the theme toggle, and the install action
- Fold: the headline, a one-line lede, two actions, and a before-and-after pair on one command, ending in a strip naming the two surfaces the command never copies
- Proof band: one claim on its own line at full width, below the fold
- Beats: the eleven sections in reading order. Their sequence and what each figure derives from are under Composition below
- Field: every command name and skill name in two fields, the ones the session used lit. Skills sit under the skill map's groups, and each name reveals its when-to-use text on hover, focus, and tap
- Footer: the brand line, three link columns, and a note on what is read and what is authored

### States

- light: the reader's system prefers light, or they pick it, and the page sits on the warm light ground. Captured at `assets/evidence/home/1280--light.png`
- dark: the system prefers dark or the reader picks it, and the page sits on its own derived dark ground, not an inversion. Captured at `assets/evidence/home/1280--dark.png`
- still: the reader asks for reduced motion or opens `?still`, and every figure shows its end state with no build and no control motion

Every committed frame is also a still, since the capture creates its context with reduced motion and scrolls each section into view before it shoots. The whole-page frames sit beside a folder per section, so a change to one part reaches review as a diff on that part. `capture.md` carries the section list.

### Behavior

- The nav bar lights the beat the reader is on and jumps to any beat on selection. Below 900 pixels the beat links drop and the mark, the toggle, and the action stay
- The theme follows the system preference before first paint, and the toggle overrides it and keeps the choice across a reload
- The evidence pair and the token preview load lazily as their beat nears the viewport
- The page reads without horizontal overflow from a 320 pixel viewport up, in both themes

### Not on this surface

- No placeholder figure. Every figure derives from a real file or is a real capture, except the branch graph, the review exchange, and the provenance roster, which the footer names as drawn from the session
- No full-bleed expansion cap, since a figure's height is a result of its content
- No window mockup assembled from boxes, since a real capture answers the question with more force
- No catalog tables, board snapshot, targets list, or teach workspace, since the page carries the session and nothing else

## Decisions

### Composition

The page is one agent session read top to bottom: the ask, the rules whose globs match the path it touches, the skill loaded, the plan, the dispatch, the workers, the test gate, the review from a session that did not write the change, and the merge. The provenance ledger, the install steps, a field of every command and skill name with the used ones lit, and the close follow. Cause precedes effect throughout, which is why the skill beat sits ahead of the plan. The composition is the reference build `.canon/groundwork/95-visual-direction/evidence/system-15/`, and no earlier build in that folder is a source to build from.

Every claim on the page names something the tool did in that session, and every figure that can derive does, from a real file or a CLI read at build time. Drawing figures from real data is what falsified three claims prose review had read past: a numerator nobody counted, a denominator read from the wrong root, and a hook action the hook does not perform.

The reference holds eleven sections in eight layout families: the fold, the proof band, `grp`, `arc`, the provenance ledger, the install steps, the field, and the close. A tint on a family is a modifier and not a family. The structural rule is the tint alternation, and `arc` exists so the two machine beats do not become a fourth and fifth `grp`. `sections/group.astro` carries the family and the tint as props, so a beat never knows which family it sits in.

Each beat is its own component and `index.astro` only arranges them, so two builds touching different beats touch different files. Shared type, the section families, the actions, and the build treatment sit in `global.css`, and each figure's internals sit scoped in its own component.

### Layer order

A redesign pass works the layers in this order, lowest first: content, composition, layout, space, type, surface, palette, imagery, motion, states. A lower layer constrains every layer above it, so a decision taken at the wrong altitude is overturned by one below it.

### Tokens, type, and styling

`global.css` maps the reference's role names onto the generated tokens rather than inlining its values. Five roles map directly. The figure card is the background in light and the chrome step in dark, because the dark surface ladder climbs where the light one descends, so one token cannot sit one step above the ground in both themes.

Monospace is retired as a role on this page, so `code` inherits Geist like everything else. `base.astro` embeds the vendored Geist face from `src/design/fonts.ts`, since `tokens.css` names Geist for every role and nothing else serves it.

`global.css`'s rules sit inside `@layer base`, not unlayered, since Tailwind v4 generates its utilities inside `@layer utilities`, where an unlayered rule always wins regardless of specificity.

### Motion

Two figures build on arrival, the merge fan and the provenance ledger, since they are the only two whose shape is a cause and its consequences: the node appears and each consequence follows 90ms later. Bands do not rise, because a page partly invisible until scrolled captures as blank pixels. The class lands whatever the motion preference and the stylesheet decides whether it animates, so reduced motion or `?still` reaches the end state without a scroll. Every control takes a 160ms hover, press, and focus response.

### The nav

The nav is a sticky flat bar rather than a floating pill. A pill floats over a centered headline and reads wrong there, and the bands alternate tints, so the bar takes the ground as its own surface. It measures its rendered height into `--nav-height`, re-measured by a `ResizeObserver`, because `scroll-padding-top` derives an anchor's landing from it and a hand-written height goes stale silently.

### Accepted costs

- The `grp` family appears three times. The tint alternation and three distinct figure shapes separate the instances, and a section shape that changed every time would read as chapters where the page argues one continuous session.
- The install section is three equal cards, the page's one instance of a shape the rules split was redrawn to avoid. Three parallel install routes are the one place where three equal things are three equal things.
- The authored figures do not meet the page's own derivation rule. The footer labels them, and the other repairs are a record of the session that produced them or retiring them.
- `error` and `warning` share a register with the accent, the most repeated element on every page. Both need a lightness or an icon carrying the meaning, since hue alone does not separate them. The work is unscheduled.
- Undecided: a glass treatment on the sticky bar, the one element with content passing under it. Glass as a system was rejected, because it needs something moving behind it and makes the ground variable.
