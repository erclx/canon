---
title: Landing page
description: The one public route at canon.erclx.dev, one agent session read top to bottom across eleven sections
---

# Landing page

The toolkit's only outward-facing surface, served at `canon.erclx.dev`. A reader arrives cold, scrolls once, and reads one real agent session from the ask to the merge. Every count is read from the repository at build time. Why the page takes this shape lives in `canon/context/web.md`.

## Regions

Eleven sections in reading order, then the footer. A skip link and a sticky nav bar sit outside the sequence.

- Skip link: first in the tab order, jumps to the start of the session
- Nav bar: sticky at the top, carrying the mark, the version with a dot lit when it matches the published one, one link per named beat of the session, the theme toggle, and the install action
- Fold: the headline, a one-line lede, two actions, and a before-and-after pair on one command. It ends in a strip naming the two surfaces the command never copies
- Proof band: one claim on its own line, full width, below the fold
- Ask and rules: the operator's request as a turn, then the rules matching the path it touches, as a split figure with the matched rules on the right
- Skill and plan: a four-step flow showing one skill loaded out of the catalog, then the planner's turn stating the plan is its only write
- Dispatch and workers: a controller over the two roles it launches, then a branch graph of the workers on disjoint file sets
- Gate and memory: the test-first line quoted from the planning rule, then where the session's facts are routed
- Review and merge: the reviewer's turn with a before-and-after pair of real captures of one pull request, the review exchange, and the merge as a hook and its consequences, followed by the design tokens that merge landed, embedded live
- Provenance: a ledger naming each session that built the change and what it produced
- Install: three steps, one card each
- Field: every command name and every skill name in two fields, the ones the session used lit
- Close: the closing headline and two actions
- Footer: the brand line, three link columns, and a note on what is read and what is authored

## States

| State | Reached when                                          | Shows                                                              | Evidence                               |
| ----- | ----------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| light | The reader's system prefers light, or they pick it    | The page on the warm light ground                                  | `assets/evidence/home/1280--light.png` |
| dark  | The reader's system prefers dark, or they pick it     | The same page on its own dark ground, derived and not inverted     | `assets/evidence/home/1280--dark.png`  |
| still | The reader asks for reduced motion, or opens `?still` | Every figure at its end state, with no build and no control motion | every committed frame                  |

Every frame above is also a still, because the capture creates its context with reduced motion and scrolls each section into view before shooting. The two whole-page frames sit beside a folder per section, seventeen of them at `assets/evidence/home/<section>/<width>--<theme>.png`, being `top` and `proof`, the eleven beats, `provenance`, `start`, `field` and `close`, so a change to one part of the page reaches review as a diff on that part. The evidence cells cite flat files rather than per-state folders because the capture writes one image per width and theme.

## Copy

- Headline: "Watch it run. That is the documentation"
- Proof band: "One repository is the authoritative copy. Every other project installs it."
- Ask: "Add a light theme to the design tokens and ship it"
- Section heads, in order: "N of M rules match this path", "One skill loaded, out of N in the catalog", "One controller, and the sessions it launches", "Three workers and a planner, on disjoint file sets", "No behavior reaches history ahead of its test", "What the session learned outlives the session", "Reviewed by a session that did not write it", "Four sessions built it, one reviewed it", "Three steps to put it in a project", "Two surfaces, and that session reached into both". Every count in a head reads live at build time.
- Close: "None of that was configured for that session"
- Install commands: `bun install --global @erclx/canon`, then `claude plugin marketplace add https://github.com/erclx/canon` and `claude plugin install canon@canon`, then `canon init`
- Long-form copy: cited at `web/src/content/copy.ts`, each string tied to a `README.md` citation, and not duplicated here

## Behavior

- The nav bar lights the beat the reader is on and jumps to any beat on selection. Below 900 pixels the beat links drop and the mark, the toggle and the action stay
- The theme follows the system preference before first paint, and the toggle overrides it and keeps the choice across a reload
- Hovering, pressing, and focusing any control gives a 160ms response
- Two figures build on arrival, the merge fan and the provenance ledger, each consequence 90ms after its cause, and nothing else animates on scroll
- The evidence pair and the token preview load lazily as their beat nears the viewport
- The page reads without horizontal overflow from a 320 pixel viewport up, in both themes

## Not on this surface

- No placeholder figure. Every figure derives from a real file or is a real capture, except the branch graph, the review exchange and the provenance roster, which the footer names as drawn from the session
- No full-bleed expansion cap, since a figure's height is a result of its content
- No window mockup assembled from boxes, since a real capture answers the question with more force
- No catalog tables, board snapshot, targets list or teach workspace. The page carries the session and nothing else
