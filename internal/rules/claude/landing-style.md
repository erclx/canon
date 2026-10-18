---
description: Hold the landing page's motion test and its closed accent set, each of which fails silently when broken
paths:
  - 'web/**'
---

# Landing page style standards

## A motion earns its place by asserting something a still cannot

- Keep a motion only when the end state alone would say less, since a fade that only announces a section asserts nothing.
- Set no number on how many motions the page carries, since a count only produced arithmetic about whether one flip was a second motion.
- Treat a reveal as an assertion when its order carries the claim, such as a trigger landing before the effects it causes.
- Treat a reveal that plays the same on every section as an entrance, and hold a section tuning its own arrival to the test above.
- Give every animation a `prefers-reduced-motion: reduce` branch that still lands the state change, carried by a class rather than the motion alone.

## The accent is closed to three uses, and identity is none of them

- Hold `--color-accent` to structure, action, and status, and argue a new use into one of the three or leave the accent out.
- Never open a fourth category, since each arrives with a reason as good as the last and the set holds only while closed.
- Use the accent for status only on a state the surface it shows would color, such as a pull request's open state.
- Reach for `--color-success` or a surface and border token for any other state.
- Leave identity outside the set, since the brand mark drawn in the accent marks no structure, action, or status.
- Name the token `--color-accent` in a rule or a comment, never the `--mark` alias `global.css` gives it inside the page.
- Keep the accent out of persistent chrome, as the nav does by marking the active beat with a tinted pill in ink.
