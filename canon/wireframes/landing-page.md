---
title: Landing page
description: The one public route at canon.erclx.dev, one agent session read top to bottom across eleven sections, drafted ahead of its build
---

# Landing page

The toolkit's only outward-facing surface, served at `canon.erclx.dev`. A reader arrives cold, scrolls once, and reads one real agent session from the ask to the merge, with every figure drawn from a real file in this repository.

This is drafted-ahead intent. The live page still shows ten earlier sections, and the build that replaces them converts this file to a transcription of the built page. Why the page takes this shape lives in `canon/context/web.md` under `## Composition`.

## Regions

Eleven sections in reading order, then the footer. A skip link and a floating nav pill sit outside the sequence.

- Skip link: first in the tab order, jumps to the start of the session
- Nav pill: floats at the top, carrying the mark, the published version, one link per named beat of the session, and the theme toggle
- Fold: the headline, a one-line lede, two actions, and a before-and-after pair on one command. It ends in a strip naming the two surfaces the command never copies
- Proof band: one claim on its own line, full width, below the fold
- Ask and rules: the operator's request as a turn, then the rules matching the path it touches, as a split figure with the matched rules on the right
- Skill and plan: a four-step flow showing one skill loaded out of the catalog, then the planner's turn stating the plan is its only write
- Dispatch and workers: a controller launching sessions, then the workers on disjoint file sets
- Gate and memory: the test gate a worker passes before anything is shown, then where the session's facts are routed
- Review and merge: the reviewer's turn, a before-and-after pair of real captures of one pull request, the review loop, and the merge as a chain of facts
- Provenance: a ledger naming each session that built the change and what it produced
- Install: three commands, one card each
- Field: every command name and every skill name in two columns, the ones the session used lit
- Close: the closing headline and two actions
- Footer: the brand line and three link columns

```plaintext
[skip]  [ pill: mark  version  ask rules plan skills workers evidence merge  theme ]

  headline                          ← fold
  lede + two actions
  [ before ] --canon init .--> [ after ]   never copies: skills, standards

  one claim, alone                  ← proof band

  operator turn                     ← ask and rules, tinted alternation begins
  [ rules band | matched rules ]

  skill flow band + planner turn    ← tinted
  controller band, workers band     ← dispatch and workers
  gate band, memory band            ← gate and memory
  reviewer turn, capture pair, review loop, merge   ← tinted

  provenance ledger
  [ card ] [ card ] [ card ]        ← install
  command field | skill field
  closing headline + two actions
  footer: brand | Reference | Surfaces | Project
```

## States

| State | Reached when                                       | Shows                                                          | Evidence     |
| ----- | -------------------------------------------------- | -------------------------------------------------------------- | ------------ |
| light | The reader's system prefers light, or they pick it | The page on the warm light ground                              | not captured |
| dark  | The reader's system prefers dark, or they pick it  | The same page on its own dark ground, derived and not inverted | not captured |
| still | The reader asks for reduced motion                 | Every figure at its end state, with no build and no entrance   | not captured |

## Copy

- Headline: "Watch it run. That is the documentation"
- Proof band: "Installed in eight repositories, authored in one." The count is derived, so a reader does not treat it as final text.
- Ask: "Add a light theme to the design tokens and ship it"
- Section heads, in order: "3 of 60 rules match this path", "One skill loaded, out of 83 in the catalog", "One controller, and the sessions it launches", "Three workers and a planner, on disjoint file sets", "No behavior reaches history ahead of its test", "What the session learned outlives the session", "Reviewed by a session that did not write it", "Four sessions built it, one reviewed it", "Three commands to put it in a project", "Two surfaces, and that session reached into both". Every count in a head is derived and reads live at build time.
- Close: "None of that was configured for that session"
- Install commands: `bun add -g @erclx/canon`, `/plugin marketplace add erclx/canon`, `canon init .`
- Long-form copy: cited at `web/src/content/copy.ts`, each string tied to a `README.md` citation, and not duplicated here

## Behavior

- The nav pill tracks the beat the reader is on and jumps to any beat on selection
- The theme follows the system preference before first paint, and the toggle overrides it and keeps the choice
- Hovering, pressing, and focusing any control gives an immediate response
- Two figures build on arrival, the ones whose shape is a cause and its consequences, and nothing else animates on scroll
- The page reads without horizontal overflow from a 320 pixel viewport up, in both themes

## Not on this surface

- No placeholder figure, every figure derives from a real file or is a real capture
- No full-bleed expansion, since a figure's height is a result of its content
- No second accent, one accent carries every count, link, and primary action
- No window mockup assembled from boxes, a real capture answers the question with more force
- No width control in a capture frame, the browser's device toolbar already does that
