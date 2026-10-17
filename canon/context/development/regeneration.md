---
title: Regeneration stages
description: The regenerate-then-assert stages, covering the consumed copies, sample content, and the hero image with its single-writer rule
---

# Regeneration stages

Three stages regenerate a tracked artifact and then assert it did not move, so an edit to a source surface fails with a message naming the stale copy. The Indexes and Skill references stages share the shape, and their gotchas sit in `canon/context/development/verification.md`.

## Decisions

### Consumed copies

The Consumed copies stage runs `canon gov regen` and asserts no drift across `.claude/rules`. It is the only mirror this stage regenerates. Standards ship with no mirror since nothing installs their corpus into a project, and `internal/` carries none since nothing installs it and both readers of its standard sit beside the source.

The assert reads the unstaged diff, so the first `bun run check` after an edit under `governance/rules/` reports its own regeneration as drift and exits red. Stage the rewritten copy and run again.

- The failure message asks for a commit while staging is what clears the stage, which matters to a ship chain that regenerates before it groups commits
- `canon/context/development/verification.md` records the same shape for the Indexes and Skill references stages
- The Design stage shares it, so an edit to `src/design/tokens.ts` reports the regenerated `canon/DESIGN.md` as drift until that record is staged

### What the rules mirror holds

`.claude/rules/` is not a whole-directory mirror, because the toolkit authors 49 rules under `governance/rules/` and consumes 31, and installing the framework rules would fire a React rule on a fixture this repository writes. The ui rules are consumed and the framework rules are not.

- `internal/governance.toml` carries that reason beside the list, and `canon gov regen` installs the stack it names with the machinery `canon gov install` uses for a target
- The producer clears `.claude/rules/` before installing, so a dropped rule disappears rather than lingering unsourced
- `internal/rules/` exists because a rule governing toolkit authoring alone needs a source outside `governance/rules/`, which ships to every target, and lands where it is authored

### The regen root

`canon gov regen`'s `--root` flag defaults to wherever the invoking binary is installed, never the working directory. Run bare from a worktree, it looks for `internal/governance.toml` on the wrong tree, refusing if none exists or regenerating the wrong repository's rules if one does. Pass `--root <literal-path>`.

### Sample content on disk

Sample content committed at its real filename gets rewritten by every repo-wide write pass claiming that filename. An `index.md` or `package.json` fixture collides with `canon indexes regen`, which rebuilds any `index.md` from sibling frontmatter, and with oxfmt, which reformats JSON and can strip a leading blank line an append fixture depends on.

Store such content under a `.fixture` suffix stripped on copy. That beats ignore-file entries and beats pruning a shared walker, because it changes nothing for that walker's consumers.

### Hero

`assets/` is the self-portrait half of the boundary decision between it and `examples/` in `canon/context/web.md`, which is why every render here gates on drift rather than carrying a disclaimer.

The Hero stage runs `bun scripts/core/regen-hero.ts`, which fills every `assets/captures/*.html.tmpl`, writes the `.html` beside it, and asserts no drift over `assets/captures/*.html`. The script is a thin entry, and the value builder with every guard sits in `src/capture/frame-values.ts`, where tsc and vitest reach it.

- Five catalogs supply the counts, so no figure on a README frame is maintained by hand
- `buildDesignCss` without its component half supplies the palette, so no frame carries its own hex value
- A sixth value, `{{FAVICON}}`, derives from the live `assets/brand/mark.svg` colored with the accent hex parsed from the same palette output

### The value map

One shared value map reaches every template, so a frame resolving only existing placeholders costs a template file and nothing else. A frame needing data the map lacks costs one row builder beside the others, and the script refuses when a builder renders empty, as it does a zeroed count.

What the script reads bounds what a frame can show. It reads committed catalogs through the modules their verbs call, so a frame sourced from a gitignored folder such as `.canon/tasks/` regenerates here and fails in CI. A frame wanting that content carries its text, as `install.html.tmpl` does, recorded from a real run with its elisions named.

### The source folder is read flat

`regen-hero.ts` collects templates through `readdirSync`, `resolveCaptureSources` expands a directory to the `.html` files directly inside it, and `captureBases` finds a capture set the same way. All three read `assets/captures/` and none descends.

- A template a further folder down is skipped by regeneration, capture, and the drift gate at once with nothing reporting it, since a filter matching nothing returns an empty set
- Nesting therefore stops at one level, and `assets/brand/` is safe only because no stage looks for the SVG it holds
- Only the markup half reads that way, since `readCaptureSet` builds the `.png` and `.stamp` against `assets/frames/`, so a set is one base name resolved in two folders
- The frames carry no `showcase-` prefix, since two folders already separate markup from image

### What the assert covers

The assert covers the HTML and not the PNG beside it. A capture is a chromium render whose bytes move with the browser version, so asserting the image would fail on a machine whose browser differs rather than on a stale count.

A second assert closes that gap without rendering. `canon capture` writes a digest of the markup and one of the image into a `.stamp` beside each PNG, and the stage hashes both committed files and compares them. It takes its frames off `assets/captures/*.html`, so a later frame is covered without an edit.

### Run a branch-reading verb from source

An installed `canon capture` renders rather than refusing, so the wrong route is quiet rather than safe. Clear this stage through the source, as `bun src/cli.ts capture assets/captures/hero.html --selector .window --out assets/frames`, since the global binary is the last release. `--selector` has no default.

The rule covers every verb reading data the branch authors.

- `canon claude skills rank` ranks prompts against the last release's case list, so a branch editing `src/claude/cases/` reads its own change as absent
- Run such a verb through `bun src/cli.ts`
- A verb reading the checkout, such as `canon gov test-order`, answers correctly from the global binary, since what it reads moves with the tree rather than with the release

### Committing a capture

Reading the commit that last touched each file measures timing rather than agreement, so a pair moved by one commit passes whatever the image holds. `canon/context/development/gates/content-stages.md` carries what the digest proves and the merge case that needs it.

A capture cannot ship as a follow-up commit, so regenerate, capture, and commit all three files in one step.

- The assert compares against the index, as Consumed copies does, so running `canon capture` does not clear the stage
- All three files must be staged before the next `bun run check`, and until then the stage repeats its earlier message
- Reading that repeat as a failed capture is the trap, since the render succeeded and only the staging is outstanding

### One writer per frame

The frame carries no version number. Release tooling bumps `package.json` on `main` and a pull request builds against the merge commit, so an embedded version drifts on every open branch when a release lands. Counts have the same shape and are kept, because the branch changing a catalog is the one that should go red.

- Every `assets/captures/*.html` is in the `ignorePatterns` of `.oxfmtrc.jsonc`, because the stage and the formatter would otherwise both own each file and serialize it differently
- `bun run format` would rewrite it, the Hero stage would rewrite it back, and the drift assert would report against whichever was committed last
- One writer per generated file is the rule the release tooling already follows

That entry is a folder glob rather than a list of frames, since the script writes whatever templates the folder holds and a frame under a named-file entry would arrive with two writers and no sign of it. Templates keep their format gate, which the glob leaves alone because a template ends in `.tmpl`.

## Gotchas

### An exit 2 with no message

The bash version of `regen-hero` intermittently exited 2 with nothing on stderr. The TypeScript script spawns nothing and discards no stderr, and thirty consecutive `--check` runs passed clean on WSL2. `canon/context/development/gates/content-stages.md` holds the record under "Hero gotchas".
