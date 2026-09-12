---
title: Regeneration stages
description: The regenerate-then-assert stages, covering the consumed copies of standards, snippets, internal content, and rules, the tooling path contract, and the hero image with its single-writer rule
---

# Regeneration stages

Three stages regenerate a tracked artifact and then assert it did not move. Regenerating and then asserting is what turns an edit to a source surface into a failure that names the stale copy, rather than a copy nothing reads as wrong. The Indexes and Skill references stages share the shape, and their gotchas sit in `.claude/context/development/verification.md`.

## Consumed copies

The Consumed copies stage runs `scripts/core/regen-claude-copies.sh` and then asserts no drift across `.claude/rules`. `standards/` and `snippets/` mirrored here too until each copy stopped answering anywhere but this checkout, which is what closing their install channels left them doing. `internal/` mirrored on a different argument and retired on its own: nothing ever installed it, and both readers of the one standard under it sit at the root beside the source.

The assert reads the unstaged diff, so the first `bun run check` after an edit under `governance/rules/` reports its own regeneration as drift and exits red. Stage the rewritten copy and run again. The failure message asks for a commit while staging is what clears the stage, which is the distinction a ship chain needs, since it regenerates before the step that groups its commits. `.claude/context/development/verification.md` records the same shape for the Indexes and Skill references stages.

Staging to clear the stage changes what the next skill in that chain measures. `review-branch` scopes to the staged set whenever one is non-empty, so a run that staged three regenerated rules reviews those three files and reports a clean branch for the source sitting untracked beside them. Reset the index before the review step and let the chain restage at its own commit step. Nothing reports the narrowed scope, since a review of three files is indistinguishable from a branch that changed three files.

`.claude/rules/` is not a whole-directory mirror, because the toolkit authors 72 rules under `governance/rules/` and consumes 66 into `.claude/rules/`, and installing the framework rules here would fire a React rule on a fixture this repository writes. The ui rules are consumed and the framework rules are not, which separates two families this sentence read as one until this repository started rendering surfaces of its own. `internal/governance.toml` carries that reason beside the list. It resolves through `canon gov regen` instead, which reads the stack named in `internal/governance.toml` and installs it with the same machinery `canon gov install` uses for a target.

`canon gov regen`'s `--root` flag defaults to wherever the invoking binary is installed, never to the working directory. Run it bare from a worktree or any checkout other than that install and it looks for `internal/governance.toml` on the wrong tree, refusing there if none exists or regenerating the wrong repository's rules if one does. Pass `--root <literal-path>` naming the checkout being regenerated.

The producer clears `.claude/rules/` before installing, so a rule dropped from the record disappears rather than lingering as an unsourced file. That is also why `internal/rules/` exists: a rule governing toolkit authoring alone needs a source somewhere outside `governance/rules/`, which ships to every target. `internal/rules/` named the internal mirror's one exclusion before this branch retired that mirror entirely, so those rules land at one path now for a simpler reason: nothing under `internal/` mirrors anywhere.

## Tooling paths

The Tooling paths stage runs `scripts/core/regen-tooling-paths.sh` and then asserts no drift on `claude/skills/canon-cli/SKILL.md`. The script rewrites the block between the `generated:tooling-paths` markers with every file each installable stack ships under `configs/`, which is the list a session reads before deciding whether `canon tooling sync` is safe to run against a project.

Stack names come from `canon tooling list --json` rather than from a walk of `tooling/`, so a stack `isStackExcluded` rejects stays out of a contract describing what the verb does. The block is the only part of the body the script owns, and a missing start marker fails the stage rather than appending a second block.

The whole file is asserted rather than the block alone, since a drift check over a fragment needs a parser and the file has one writer for that region and one author for the rest. What that costs is a stage that goes red when the surrounding prose is edited and left unstaged, which is the Consumed copies shape above and clears the same way.

## Sample content on disk

Sample content committed at its real filename gets rewritten by every repo-wide write pass that claims that filename. Moving the docs scenario's heredocs to disk put an `index.md` and a `package.json` on disk, and `canon indexes regen` rebuilds any `index.md` from sibling frontmatter, so `bun run check` rewrote a fixture whose body deliberately disagreed with its sibling and then failed its own drift gate, while prettier reformatted the JSON and the leading blank line an append fixture depends on. Store such content under a `.fixture` suffix stripped on copy, which beats ignore-file entries and beats pruning a shared walker because it changes nothing for that walker's consumers. cspell still reads suffixed files, so spell coverage survives the move.

## Hero

`assets/` is the self-portrait half of the `.claude/ARCHITECTURE.md` boundary decision between it and `examples/`, which is why every render here gates on drift rather than carrying a disclaimer.

The Hero stage runs `scripts/core/regen-hero.sh`, which fills every `assets/captures/*.html.tmpl` and writes the `.html` beside it, then asserts no drift over `assets/captures/*.html`. Two inputs reach the templates: five catalogs supply the counts, so no figure on a README frame is maintained by hand, and `canon design css --no-components` supplies the palette, so no frame carries its own copy of a hex value. A sixth value, `{{FAVICON}}`, fills the same map, derived from the live `assets/brand/mark.svg` colored with the accent hex parsed out of the same palette output.

One shared value map reaches every template, so a frame resolving only the placeholders that already exist costs a template file and nothing else. A frame needing data the map does not carry costs one row builder beside the others, and the script refuses when a builder renders empty, the same way it refuses a zeroed count.

What the script can read bounds what a frame can show. It reads committed catalogs through the CLI, so a frame sourced from a gitignored folder such as `.canon/tasks/` regenerates here and fails in CI, where that folder does not exist. A frame wanting that content carries its text the way `install.html.tmpl` does, recorded from a real run in the template with its elisions named.

### The source folder is read flat three times

`regen-hero.sh` collects templates twice, once as a shell glob and once through `readdirSync`, `resolveCaptureSources` expands a directory to the `.html` files directly inside it, and `captureBases` finds a capture set the same way. All three read `assets/captures/` and none of them descends.

So a template placed a further folder down is skipped by regeneration, by capture, and by the drift gate at once, and nothing reports it, because each is a filter over a listing and a filter matching nothing returns an empty set. The nesting therefore stops at that one level, and `assets/brand/` is safe only because no stage ever looks for the SVG it holds.

Only the markup half reads that way. `captureBases` lists `assets/captures/`, then `readCaptureSet` builds the `.png` and the `.stamp` against `assets/`, which is where `--out assets` puts them, so a set is one base name resolved in two folders rather than three files in one. Splitting them is what let the frames drop the `showcase-` prefix: the prefix existed to separate markup from image inside a single flat listing, and there is no longer a single flat listing to separate.

### What the assert covers

The assert covers the HTML and not the PNG beside it. A capture is a chromium render whose bytes move with the browser version, so asserting the image would fail on a machine whose browser differs rather than on a stale count. A second assert closes the gap that leaves without rendering anything: `canon capture` writes a digest of the markup it read and one of the image it wrote into a `.stamp` beside each PNG, and the stage hashes both committed files of each set and compares them. It takes its set of frames off the `.html` files in `assets/captures/`, which is the same thing `canon capture assets/captures` reads to decide what to render, so a frame added later is covered without a second edit and an image in `assets/` that no markup renders is left alone.

`canon capture` ships now, so an installed binary renders rather than refusing, and that makes the wrong route quieter rather than safe. A session clearing this stage in this repository runs it through the source entry point, as `bun src/cli.ts capture assets/captures/hero.html --selector .window --out assets`, since the global binary is whatever release last published and this stage compares against the branch. `--selector` carries no default, so a run that omits it refuses before rendering anything.

Reading the commit that last touched each file measures timing rather than agreement, so a pair moved by one commit passes whatever the image holds. `.claude/context/development/gates.md` carries what the digest proves and the merge case that needs it. The cost is unchanged: a capture cannot ship as a follow-up commit, so regenerate, capture, and commit all three files in one step.

The assert compares against the index, the way the Consumed copies stage above does, so running `canon capture` is not what clears the stage. All three files have to be staged before the next `bun run check`, and until they are the stage repeats the same message it printed before the capture ran. Reading that repeat as the capture having failed is the trap, since the render succeeded and only the staging is outstanding.

The frame carries no version number. `package.json` is bumped on `main` by the release tooling, and a pull request builds against the merge commit, so an embedded version drifts on every open branch the moment a release lands and the stage then fails for work that touched nothing. Counts have the same shape and are kept, because a catalog change is what the stage exists to catch and the branch that changes a catalog is the one that goes red.

Every `assets/captures/*.html` is in `.prettierignore`, because the stage and the formatter would otherwise both own each one and serialize it differently. The Format stage runs first and rewrites the file, the Hero stage rewrites it back, and the drift assert then reports against whichever version was committed last. The pre-push hook reformats and asks for the result to be committed as `style(<scope>):`, which is exactly the path that would commit the formatter's version and deadlock the stage. One writer per generated file is the rule the entry beside it already applies to the release tooling.

That entry is a folder glob rather than a list of frames. The script writes whatever templates the folder holds, so a frame added under a named-file entry arrives with two writers and shows no sign of it until their output first disagrees. Templates keep their format gate, which the glob leaves alone because a template ends in `.tmpl`.

### An exit 2 with no message

`scripts/core/regen-hero.sh` exits 2 with nothing on stderr on roughly one run in five, reported as `✗ Hero regen failed` inside `bun run check`. The rate, the failing command, and what to do about it sit under `## Hero provenance` in `.claude/context/development/gates.md`, beside the stage that reports it.

Two accounts of this landed within a day of each other, one here and one there, because the flake fires on any branch that moves a catalog count and nothing pairs the two entries. One is kept and this is the pointer.
