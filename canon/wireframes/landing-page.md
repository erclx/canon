---
title: Landing page
description: The one public route at canon.erclx.dev, its ten sections, and the behavior each carries
---

# Landing page

The toolkit's only outward-facing surface, served at `canon.erclx.dev` from a single Astro route in `web/src/pages/index.astro`. A reader arrives cold, scrolls once, and decides whether to read further.

## Layout

One column at `max-w-4xl`, centered, with every section on the same 96px vertical rhythm. Ten sections in order, each carrying an `id` so any one of them can be linked to:

| Section                 | `id`              | What it shows                                                         |
| ----------------------- | ----------------- | --------------------------------------------------------------------- |
| Hero                    | `top`             | The reader's problem in the README's own words, and one action        |
| Agent view              | `agent-view`      | Parallel sessions, three bands standing at once, one row landing      |
| Install                 | `install`         | The two commands, selectable                                          |
| Catalog                 | `catalog`         | Live counts, then every rule domain with its true count               |
| Rule arrival            | `rules`           | A path edited, and the rule that arrives because of it                |
| What a target receives  | `install-surface` | Two catalogs side by side: copied in, and never copied                |
| Board                   | `board`           | Task rows and what closes them                                        |
| Design token preview    | `design-preview`  | A live embed of `canon/DESIGN.md` rendered to HTML at build time      |
| Teach workspace preview | `teach-preview`   | A live embed of one lesson from an isolated `.canon/teach/` workspace |
| Call to action          | `start`           | Two links out                                                         |

## Behavior

- A floating pill navigates the sections. It is hidden over the hero, where navigation is redundant, and reveals once an `IntersectionObserver` sentinel reports the hero has left. It carries the mark, one link per section, and the theme toggle.
- The pill tracks position. Every observed section reports its own intersection ratio and the largest wins, which is what keeps a short section between two tall ones from being skipped.
- Each section below the fold reveals on scroll, driven by one observer and one pair of CSS rules rather than per-section animation. The treatment is uniform by construction: a section given its own arrival has stopped being an entrance and counts against the demonstrative cap instead.
- Three animations assert something and are capped at three: the rule card arriving, the working marker, and a row moving from Working to Completed. The entrance treatment asserts nothing and is a separate class.
- Theme follows the reader's system preference before first paint, and the toggle overrides it and persists the choice. The toggle sits in the pill, so it is reachable only once the reader has scrolled past the hero.
- Every count and every catalog row is read from the CLI at build time. Nothing on the page is a committed image.
- Every animation carries a `prefers-reduced-motion` branch that lands the end state rather than only dropping the transition.

## Constraints

`internal/rules/claude/593-landing-page.md` holds the five conventions that fail silently: read counts, generated images, the motion cap, the single structural accent, and the quoted `README.md` citation on every string. `canon/context/web.md` holds the mechanics and the decisions behind them.
