---
description: Hold the landing page's motion test and its one accent, each of which fails silently when broken
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

## The page carries one accent, and it is the pip

- Read the accent as `--color-accent`, whose pair is the pip's own in `FAVICON_COLORS`, so the page, favicon, and card share one hue. A second hue splits the one signal the page carries.
- Color the mark's pip from `--pip`, which `base.astro` sets from `FAVICON_COLORS`, since the mark is drawn from its own pair rather than a page token.
- Keep the accent to the section marker in the nav, the focused prompt, and the live state a product view shows, such as a working session, an active skill, a refusal, or a branch.
- Draw every action, link, and focus ring in ink, so a control never borrows the accent to look pressed.
- Reach for `--color-success`, `--color-waiting`, or a surface and border token for any other state.
