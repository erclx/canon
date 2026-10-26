---
name: ui-craft
description: Carries the behavior practice for rendered UI, being accessibility, keyboard and pointer operation, forms, motion, controls, state coverage, interface copy, and the capture a rendered change owes, routed from the kind of change to the references it reads. Use before building or changing a component, a page, a form, or any rendered surface, when judging one in review, or when asked "is this accessible", "what states does this need", "how should this form validate", "what should the button say", or "what do I capture after this change". Do NOT use for how a surface looks, being layout, type, color, and the layer order, which is `design-taste`, or for the design folder and its references, which is `design-record`.
metadata:
  family: build
---

# UI craft

A rendered change that skips this practice ships a control a keyboard cannot reach, a list with no empty state, or an error that names the fault and never the fix, and none of it fails a build. The references below carry the rules. This body routes a change to the ones it reads.

Load this before building rather than after, since a missing state or a trapped focus is cheaper to design in than to retrofit.

## Read by the change

Read every reference on the always row for any rendered change, then each row the change matches.

| The change                                                         | Read                                  |
| ------------------------------------------------------------------ | ------------------------------------- |
| Any rendered change                                                | `a11y.md`, `keyboard.md`, `states.md` |
| A click, press, drag, gesture, or popover dismissal                | `pointer.md`                          |
| A form, a field, validation, or a sign-in step                     | `forms.md`                            |
| An animation, transition, autoplay, or carousel                    | `motion.md`                           |
| A destructive action, an edit cancel, or a hover or disabled state | `controls.md`                         |
| A rendered string, heading, label, or link                         | `copy.md`                             |
| A rendered surface has changed and is about to be handed over      | `capture.md`                          |

Each name sits under `${CLAUDE_SKILL_DIR}/references/`. A row's reference is read whole, since its sections name the cases a change reaches without saying so.

## Hold the floor over taste

The references state a floor, and no aesthetic choice trades against it. A contrast ratio, a focus ring, or a state the design leaves out is restored before the look is judged, and `design-taste` decides the look inside that floor.

## Sources

Read `${CLAUDE_SKILL_DIR}/references/adopted.md` only when extending this guidance or arguing against a rule in it. It names the authorities the references draw on and where each bullet's source row sits.

## What this delegates

- How a surface looks, being the layer order, the coherence locks, and the defaults a model reaches for: `design-taste`
- The accepted designs under the design folder and how a reference lands there: `design-record`
- The visual checklist a reviewer reads beside the screenshots: `ui-checklist`
- Reading source for roughness a rule does not state: `ui-audit`
- Prose on the surface beyond its interface copy: the `write-human` skill
