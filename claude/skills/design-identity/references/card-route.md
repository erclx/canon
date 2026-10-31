---
title: Card route path
description: How design-identity writes the picked card composition into a project's existing Astro card route and captures it through the card server
---

# Card route path

Applies to Step 7 of `design-identity` when the project already holds the card route scaffold. A project without it takes the page path in the skill body instead.

## The scaffold

The scaffold is a second framework config pointing `srcDir` at a folder beside `src/`, a route inside that folder, and a shell check. Read the shape with `canon tooling reference astro`.

- The route imports the project's global stylesheet and carries a fixed `<meta>` marker
- The shell check fails a build that carries the marker
- Of the route's three consumers, the published build is the only one a check reaches

### When the scaffold is missing

Check for a `card.config.mjs` with a `card-src/pages/og-card.astro` beside it. Where either is missing, take the page path and leave the install to the operator, saying:

```plaintext
No card route installed, so the card shipped as a PNG this run.
`canon tooling sync astro . --write` installs the route, and it writes the astro
stack's new and stale configs, so run it when you mean to sync the stack.
```

Never run that sync to obtain the route, since it writes the stack's configs beside the project's own framework, lint, typescript, and test configs, holding only the ones the project edited. Never hand-write the scaffold either, since a copy written here drifts from the one the stack maintains.

## Writing and capturing the route

1. Write the arm's `.card` markup into the route's `.card` and its `[data-theme]` rules into the route's `<style>`, leaving the rest of the route alone.
2. Keep the element at 600x315, half the 1200x630 target, since the capture's 2x scale factor is fixed and a 1200x630 element captures at 2400x1260.
3. Start the card server in the background with `bun run card:dev` and read the port off its own output.
4. Capture the route twice while the server is up, once per theme, naming each destination PNG rather than a directory, which is what a URL source takes for `--out`.
5. Stop the server. Report the dimensions `canon capture` printed for both cards, confirming 1200x630.

```bash
canon capture http://localhost:<port>/og-card --selector .card --color-scheme light --out <write-folder>/og-image.png
canon capture http://localhost:<port>/og-card --selector .card --color-scheme dark --out <write-folder>/og-image-dark.png
```

The two captures differ only where something keys a second theme:

- The scaffold's `.card` reads two color properties a stylesheet may set for one theme only, so the arm's rules from step 1 give the dark capture its dark set
- `--color-scheme` writes the theme onto the route's root after it loads, so rules keyed on `data-theme`, a class, or the media query all answer to it
- With no second set in the arm or the stylesheet, the PNGs match. Compare the image digests in their `.stamp` files, and on a match say the project got one card twice.

### Port and font refusals

The card server runs under a strict port, so it refuses rather than walking to the next free one. Where something already holds that port, set `WORKTREE_PORT_OFFSET` by hand and start it again.

A capture refusing on a font is the mechanism working rather than a failure to route around. The route asked for a family the machine cannot resolve, which is the rewrap a published card would have shipped silently.
