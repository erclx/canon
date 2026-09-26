---
title: Packaging
description: What the published package carries and excludes, how a browser command keeps its engine off the startup path, and the two capture sources
---

# Packaging

The CLI ships to the registry as `@erclx/canon` with nothing built, so what the package carries is decided entirely by the `files` list. Two trees are excluded plus every test file, and the four browser commands are what set the pattern any command backed by a heavy import follows.

## Keeping an engine off the startup path

A command backed by a browser reaches its engine through a dynamic import inside the action. `src/cli.ts` imports every command's `register` at module scope, so a browser reference at a command's top level would put a browser resolution in front of every other command rather than in front of the one that needs it. `src/commands/capture.ts` therefore holds wiring only and `src/capture/render.ts` holds every browser reference, which `src/commands/demo.ts`, `src/commands/inventory.ts`, and `src/commands/driver.ts` each repeat against a module of their own. The two engine-absence predicates the four share sit in `src/browser/engine.ts` rather than being spelled once per command.

All four ship, and the split reads as a startup cost rather than as a way to report an absence. `src/capture/render.ts` imports from `playwright-core` rather than `@playwright/test`, since no published tarball carries a development dependency. Importing the test package would throw `ERR_MODULE_NOT_FOUND` on the first dynamic import in every target.

Both aliases the command uses for the render module's types are `typeof import(...)` queries rather than `import type` statements, which keeps the dynamic path out of the shipped file's import list where a reviewer checks for it.

An argument check runs in the order that puts the message on what was actually wrong. `canon capture` defaults its source to `assets` and requires `--selector`, so validating the source first would answer `assets not found` from the caller's own working directory and never name the flag that was missing. The refusal on the flag therefore runs first, and the source default stays for its own reason: refusing loud rather than failing silently.

`canon sandbox` is the one surface left where availability is the question, and it detects a missing directory rather than a missing module, so the guard is an existence check on where `SANDBOX_DIR` resolves rather than a caught import. One check there serves the interactive picker and `coverage` both, and it makes `coverage` exit 1 without printing a percentage. A denominator nobody looked at is not a zero, and reporting one reads as a suite that examined everything and found it clean.

## The capture sources

A capture proves its declared font resolved and asserts nothing about its output size. The height of `assets/evidence/install.png` is whatever the terminal block wrapped to at a fixed width, so pinning that number would harden an accident, while the font is the input that actually decides the wrap. The check compares text metrics against a family that cannot exist, because `document.fonts.check` reports every system family as present, invented ones included.

Both capture sources under `assets/captures/` are generated and both are asserted. `scripts/core/regen-hero.sh` fills `hero.html.tmpl` from five catalogs so no count on the image is maintained by hand, and it fills both templates with what `canon design css --no-components` emits so neither frame carries its own copy of a hex value. The `Hero` stage in the merge gate runs `regen-hero.sh --check`, which fills into a temp folder and asks only whether the regen can run, so a stale frame passes and the refresh workflow regenerates the committed files after a merge, per `canon/context/development/gates/content-stages.md`. The terminal text on `install.html` comes from a real run, captured into the template. The frame reads type, spacing, and radius from the token block and hand-sets only the block line height at 1.62, since `--type-code-lh` is specified for an inline code span and a terminal block is not one. Its four commands end on `canon --help` quoted as the `Project` group's first three rows with the box glyph column stripped, which a pipe emits and no command above it carries. Height is the trade: the rebuilt frame is taller than the three-command one it replaced. The images the two render to sit under `assets/evidence/`, so a run rebuilding them passes `--out assets/evidence` rather than letting each PNG land beside its markup.

The gate never byte-checks the PNG, because it is a chromium render whose bytes move with the browser version and a byte check over it would fail on a machine whose browser differs rather than on a stale count. A stamp assert covers the image instead, comparing the digest each capture recorded over the markup it read and the image it wrote, across both capture sets.

Nothing on the frame comes from `package.json`, since a pull request builds against the merge commit and an embedded version would drift every open branch on the next release. The generator samples entry names at even spacing across each sorted catalog rather than taking the first ten, since the skill names are domain-prefixed and an alphabetical head returns eight `claude-*` entries and reads as a narrower catalog than the one that ships.

## The published package

`bun install --global @erclx/canon` is the install path a plugin user follows. Nothing builds. `bin` points at `src/cli.ts`, whose `#!/usr/bin/env bun` shebang runs the source directly, which is why `src/` ships as TypeScript with `tsconfig.json` beside it so the `@/*` alias resolves.

`PROJECT_ROOT` resolves from the CLI's own install root, so the package carries the catalogs rather than only `src/`. The `files` list covers `src/`, `scripts/`, `standards/`, `snippets/`, `governance/`, `tooling/`, `claude/`, and `docs/`. Dropping any one produces a CLI that installs nothing for that domain, and dropping `docs/` breaks `canon docs <topic>`, which two shipped skills call in a command position. `internal/` stays out under the same rule that keeps it out of the plugin, and `wiki/` stays out because `src/wiki/` scaffolds into a target and never reads the toolkit's own copy.

`scripts/sandbox` and `scripts/eval` are excluded by negation rather than by leaving `scripts/` out, since the domain scripts beside them are what `execScript` dispatches to. Both are toolkit-development harnesses whose roots (`.sandbox/`, the eval ledger) never ship, so shipping them would carry a quarter of the file count for a command that can only fail.

`src/capture` ships rather than being excluded, and renders its own sources rather than this repository's: a target has no use for the `assets/` paths that live only here. `scripts/core/install-check.sh` verifies an exclusion by packing the tarball and installing from it, because every other check in the repository runs where the excluded files are present and passes either way.

### What `.claude/` costs by being absent

`.claude/` never ships, which has three consequences worth knowing before touching any of these surfaces. The second root `canon docs <topic>` resolves against is absent in an installed package, so `scripts/docs/list.sh` guards its context walk on the directory existing rather than letting `find` write a raw error to stderr.

`canon feedback` writes local scratch to `PROJECT_ROOT/.canon/review/`, which from a registry install would land inside `node_modules/` under a path the success line reports as project-relative, so `isToolkitSource()` gates both the bare write and the `--github` fallback and points the operator at the issue tracker instead. The `claude/standards` and `claude/snippets` symlinks are dropped by the pack, which costs nothing, since the CLI reads the root copies and the plugin ships from the repository rather than from the registry.

Version stays owned by release-please, which already writes `claude/.claude-plugin/plugin.json` through `extra-files`, so the package version and the plugin version cannot disagree. The publish job on the release workflow checks out the release tag rather than `main`, so the tarball matches the tag. What gates that job, why it publishes with `--ignore-scripts`, and why the runner's npm version decides whether that flag does anything all live in `canon/context/ci/releases.md`, which owns the release path.

## Gotchas

- A scoped package defaults to restricted access. `publishConfig.access` is set to `public` in the manifest, since a restricted first publish succeeds and only surfaces as an install failure for everyone outside the scope.

A packed tarball's file list proves inclusion and nothing about whether the installed CLI runs. The registry-publish plan named its own check as packing and listing the contents by hand. That listing came back clean at 467 files with every catalog present, and it could not see that `canon docs list` wrote a raw `find` error to stderr, because `canon/context/` is a second read root the package deliberately does not ship. Installing the tarball into a scratch directory and running `canon init` surfaced it on the first command. A path the package omits fails at read time rather than at pack time.

`scripts/core/install-check.sh` runs that pack-and-install as an ongoing check rather than a one-time pass. It asserts a named excluded path, `scripts/sandbox`, is absent from the extracted tree, and that `canon --help` and `canon init` both run against a `bun install --production` install with no devDependencies present.

`bun pm pack` runs the package's own `prepack` and `prepare` scripts by default, so packing a checkout with no `node_modules` fails on `husky: command not found` before it produces a tarball. A production install of the extracted package never carries `husky` either, since it is a devDependency. Both the pack step and the install step in `install-check.sh` pass `--ignore-scripts` for that reason.

What it proves is inclusion, and that the installed package resolves without the development tree behind it. It says nothing about whether an excluded module stays reachable through some other path at runtime, which is the class the dynamic-import split in `src/capture/render.ts` already closes by keeping every browser reference behind a call-time import rather than a module-scope one.

A pointer body naming the release that removes it asserts what `release-please` will do, and the bump comes from the commit types in the branch rather than from the sentence. Pick the commit type that produces the version and say so in the plan or the pull request, and prefer one release claim repeated by reference over a copy written into every surface that needs it.
