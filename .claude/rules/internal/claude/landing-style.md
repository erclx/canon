---
description: Hold the landing page's motion test and its one hue, each of which fails silently when broken
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

## The page carries no accent, and the pip is its one hue

- Draw every action and link in ink, and leave `--color-accent` off the page, since a second hue beside the pip splits the one signal the page carries.
- Read the pip as `--pip`, which `base.astro` sets from `FAVICON_COLORS` so the page, the favicon, and the card share one pair.
- Use the pip outside the mark only for status, to mark the one result a step's figure ends on and the kicker naming that step.
- Never give the pip a second use, since each arrives with a reason as good as the last and the hue holds only while it marks one thing.
- Reach for `--color-success` or a surface and border token for any other state.
- Keep the pip out of persistent chrome bar the mark itself, so the nav and the footer stay ink.
