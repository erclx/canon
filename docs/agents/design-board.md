---
title: Design board
description: Generating a static index over the toolkit checkout's own design surfaces, what each panel reads, and why it never runs against a target
---

# Design board

`canon design board [--out <path>]` generates a static page set indexing five design surfaces and reports the path a reader opens with `canon serve`. Like `canon design regen`, it runs against the toolkit checkout the CLI resolves its own root from, never against a target project's own files: a target holds none of the sources below, since none of `canon/DESIGN.md`, `canon/wireframes/`, `web/`, or the gitignored `.canon/` records ship with the published package. Running the installed CLI from inside a checkout of this project prints a mismatch warning when the caller's working directory disagrees with the root it resolved.

Each panel reads what is already on disk and reports its own missing source rather than failing the run, so an absent build or an empty corpus renders an empty-state message instead of a broken frame.

```bash
canon design board
canon serve .canon/review/board
```

| Option             | Default               | Behavior         |
| ------------------ | --------------------- | ---------------- |
| `-o, --out <path>` | `.canon/review/board` | Output directory |

## Panels

- **Tokens** renders `canon/DESIGN.md` through the same renderer `canon design render` uses, rather than a second one.
- **Surfaces** iframes the built landing page from `web/dist/` and a teach workspace from `.canon/teach/`, copying each whole into the board's own tree. Either reports its own missing build or absent workspace rather than rendering a broken frame.
- **Wireframes** renders each of the six files under `canon/wireframes/` as-is inside a `<pre>`, beside a line naming the surface it describes.
- **Past candidates** lists an arm capture image per folder under `.canon/review/evidence/`, and states the corpus carries none rather than rendering an empty grid.
- **Components** iframes the gallery built by `bun run web:gallery`, a second Astro config at `web/gallery.config.mjs` reading `web/gallery-src/` and writing `web/gallery-dist/`. That config's `srcDir` is never read by `web:build`'s own config, so the gallery never reaches the published `web/dist/`. The gallery page renders every component under `web/src/components/` except two whose props carry no defaults, which it names rather than filling with invented data. Reports a missing gallery build rather than rendering a broken frame.

## What it does not do

The board never writes outside its own output directory and never builds `web/dist/` on a caller's behalf. `web/dist/` and `.canon/teach/` are read, not written, and copied into the board's tree only for that run: the generator clears and recreates its output directory on every call, so a caller relying on it to persist between runs is relying on an accident. It refuses rather than clearing a directory that is or contains the project root or the caller's own working directory, which is what an `--out .` typo would otherwise do, including when a global install resolves the project root to a different checkout than the one the caller stands in.
