---
title: Design board
description: Generating a static index over a project's design surfaces, what each panel reads, and which two stay toolkit-checkout-only
---

# Design board

`canon design board [--out <path>] [--root <path>]` generates a static page set indexing five design surfaces and reports the path a reader opens with `canon serve`. `--root` defaults to the main worktree the same way `canon teach`'s verbs resolve their own root. The surfaces panel's landing-page half and the whole components panel render only when that root is this toolkit's own checkout, since both read this repository's own build output rather than anything a target project produces. Running the installed CLI from inside a checkout of this project prints a mismatch warning when the caller's working directory disagrees with the root it resolved.

Each panel reads what is already on disk and reports its own missing source rather than failing the run, so an absent build, an empty corpus, or a toolkit-only gate renders an empty-state message instead of a broken frame.

```bash
canon design board
canon serve .canon/review/board
```

| Option             | Default               | Behavior                                      |
| ------------------ | --------------------- | --------------------------------------------- |
| `-o, --out <path>` | `.canon/review/board` | Output directory                              |
| `--root <path>`    | The main worktree     | Project root the board reads its sources from |

## Panels

- **Tokens** renders `DESIGN.md` through the same renderer `canon design render` uses, rather than a second one, reading `<root>/canon/DESIGN.md` or `<root>/.claude/DESIGN.md` for a target that has not run `canon migrate surface-roots`.
- **Surfaces** iframes the built landing page from `<root>/web/dist/` and a teach workspace from `<root>/.canon/teach/`, copying each whole into the board's own tree. The landing-page half reports a toolkit-only notice outside this toolkit's own checkout, and either half reports its own missing build or absent workspace rather than rendering a broken frame.
- **Wireframes** reads every `**/*.md` under `<root>/canon/wireframes/` or `<root>/.claude/wireframes/`, excluding `index.md` at any depth, and renders each file as-is inside a `<pre>`, labeled from its own `description` frontmatter field. Reports the whole panel empty rather than per file when the directory is absent or holds nothing to render.
- **Past candidates** lists an arm capture image per folder under `<root>/.canon/review/evidence/`, and states the corpus carries none rather than rendering an empty grid.
- **Components** iframes the gallery built by `bun run web:gallery`, a second Astro config at `web/gallery.config.mjs` reading `web/gallery-src/` and writing `web/gallery-dist/`. That config's `srcDir` is never read by `web:build`'s own config, so the gallery never reaches the published `web/dist/`. The gallery page renders every component under `web/src/components/` except two whose props carry no defaults, which it names rather than filling with invented data. Reports a toolkit-only notice outside this toolkit's own checkout, and a missing gallery build otherwise.

## What it does not do

The board never writes outside its own output directory and never builds `web/dist/` on a caller's behalf. `web/dist/` and `.canon/teach/` are read, not written, and copied into the board's tree only for that run: the generator clears and recreates its output directory on every call, so a caller relying on it to persist between runs is relying on an accident. It refuses rather than clearing a directory that is or contains the project root or the caller's own working directory, which is what an `--out .` typo would otherwise do, including when a global install resolves the project root to a different checkout than the one the caller stands in.
