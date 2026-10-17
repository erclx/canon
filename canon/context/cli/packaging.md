---
title: Packaging
description: What the published package carries and excludes, how a browser command keeps its engine off the startup path, and the two capture sources
---

# Packaging

The CLI ships to the registry as `@erclx/canon` with nothing built, so the `files` list decides what the package carries. Two trees are excluded plus every test file, and the four browser commands set the pattern any command backed by a heavy import follows.

## Decisions

### Keeping an engine off the startup path

A command backed by a browser reaches its engine through a dynamic import inside the action. `src/cli.ts` imports every command's `register` at module scope, so a top-level browser reference would put a browser resolution in front of every other command.

`src/commands/capture.ts` holds wiring only and `src/capture/render.ts` holds every browser reference. `demo.ts`, `inventory.ts`, and `driver.ts` under `src/commands/` each repeat the split against a module of their own, and the two engine-absence predicates the four share sit in `src/browser/engine.ts`.

### The split is a startup cost

All four ship. `src/capture/render.ts` imports from `playwright-core` rather than `@playwright/test`, since no published tarball carries a development dependency, and the test package would throw `ERR_MODULE_NOT_FOUND` on the first dynamic import in every target.

The two aliases the command uses for the render module's types are `typeof import(...)` queries rather than `import type` statements, which keeps the dynamic path out of the shipped file's import list where a reviewer checks for it.

### Argument checks name what was wrong

`canon capture` defaults its source to `assets` and requires `--selector`. Validating the source first would answer `assets not found` from the caller's working directory and never name the missing flag, so the flag refusal runs first.

The source default stays for its own reason, refusing loud rather than failing silently.

### `canon sandbox` detects a directory

It is the one surface left where availability is the question, and it detects a missing directory rather than a missing module, so the guard is an existence check on where `SANDBOX_DIR` resolves.

One check serves the interactive picker and `coverage` both, and makes `coverage` exit 1 without printing a percentage. A denominator nobody looked at is not a zero.

### The capture sources

A capture proves its declared font resolved and asserts nothing about its output size. The height of `assets/frames/install.png` is whatever the terminal block wrapped to at a fixed width, so pinning it would harden an accident, while the font is the input that decides the wrap.

The check compares text metrics against a family that cannot exist, because `document.fonts.check` reports every system family as present, invented ones included.

### Both sources are generated and asserted

`scripts/core/regen-hero.ts` fills `hero.html.tmpl` from five catalogs so no count on the image is maintained by hand. It fills both templates with what `canon design css --no-components` emits, so neither frame carries its own copy of a hex value.

### The hero stage checks only that the regen runs

The `Hero` stage in the merge gate runs `regen-hero.ts --check`, which fills into a temp folder, so a stale frame passes and the refresh workflow regenerates the committed files after a merge, per `canon/context/development/gates/content-stages.md`.

### The install frame

The terminal text on `install.html` comes from a real run, captured into the template. The frame reads type, spacing, and radius from the token block and hand-sets only the block line height at 1.62, since `--type-code-lh` is specified for an inline code span.

Its four commands end on `canon --help` quoted as the `Project` group's first three rows with the box glyph column stripped, which a pipe emits and no command above it carries. The rebuilt frame is taller than the three-command one it replaced.

### Output folder

The images the two render to sit under `assets/evidence/`, so a run rebuilding them passes `--out assets/evidence` rather than letting each PNG land beside its markup.

### The gate never byte-checks the PNG

A chromium render's bytes move with the browser version, so a byte check would fail on a machine whose browser differs rather than on a stale count. A stamp assert covers the image, comparing the digest each capture recorded over the markup it read and the image it wrote, across both capture sets.

### The frame reads no version

Nothing on the frame comes from `package.json`, since a pull request builds against the merge commit and an embedded version would drift every open branch on the next release.

The generator samples entry names at even spacing across each sorted catalog rather than taking the first ten. Skill names are domain-prefixed, so an alphabetical head returns eight `claude-*` entries and reads as a narrower catalog than the one that ships.

### The install path

`bun install --global @erclx/canon` is the install path a plugin user follows, and nothing builds. `bin` points at `src/cli.ts`, whose `#!/usr/bin/env bun` shebang runs the source directly, so `src/` ships as TypeScript with `tsconfig.json` beside it for the `@/*` alias.

### What the package carries

`PROJECT_ROOT` resolves from the CLI's own install root, so the package carries the catalogs rather than only `src/`. The `files` list covers `src/`, `scripts/`, `governance/`, `tooling/`, `claude/`, and `docs/`.

Dropping any one produces a CLI that installs nothing for that domain. Dropping `docs/` breaks `canon docs <topic>`, which two shipped skills call in a command position.

### What stays out

Four trees stay out of the package, each for its own reason.

- `internal/` stays out under the rule that keeps it out of the plugin
- `wiki/` stays out because `src/wiki/` scaffolds into a target and never reads the toolkit's own copy
- `scripts/eval` is excluded by negation, since the domain scripts beside it are what `execScript` dispatches to, and it holds the frozen records of a retired harness
- `sandbox/` sits outside every `files` entry, so it needs no negation, and shipping it would carry a quarter of the file count for a command that can only fail in a target

### `src/capture` ships

It renders its own sources rather than this repository's, since a target has no use for the `assets/` paths that live only here.

`scripts/core/install-check.sh` verifies an exclusion by packing the tarball and installing from it, because every other check here runs where the excluded files are present and passes either way.

### What `.claude/` costs by being absent

`.claude/` never ships. The second root `canon docs <topic>` resolves against is absent in an installed package, so `listDocs` in `src/docs/list.ts` reports no context section when no context root exists rather than listing an empty one.

### Version and release

Version stays owned by release-please, which writes `claude/.claude-plugin/plugin.json` through `extra-files`, so the package and plugin versions cannot disagree. The publish job checks out the release tag rather than `main`, so the tarball matches the tag.

The comments in `.github/workflows/release-please.yml` state what gates that job, why it publishes with `--ignore-scripts`, and why the runner's npm version decides whether that flag does anything.

## Gotchas

### Restricted access by default

A scoped package defaults to restricted access. `publishConfig.access` is set to `public` in the manifest, since a restricted first publish succeeds and only surfaces as an install failure for everyone outside the scope.

### A tarball listing proves inclusion only

The registry-publish plan named its check as packing and listing the contents by hand. That listing came back clean at 467 files with every catalog present, and it could not see that `canon docs list` wrote a raw `find` error to stderr, because `canon/context/` is a second read root the package does not ship.

Installing the tarball into a scratch directory and running `canon init` surfaced it on the first command. A path the package omits fails at read time rather than at pack time.

### `install-check.sh` runs that as a standing check

`scripts/core/install-check.sh` asserts a named excluded path, `sandbox`, exists in the source tree and is absent from the extracted one, so the absence cannot pass on a path that moved. It also asserts that `canon --help` and `canon init` run against a `bun install --production` install with no devDependencies.

### Pack without scripts

`bun pm pack` runs the package's own `prepack` and `prepare` scripts, so packing a checkout with no `node_modules` fails on `husky: command not found` before it produces a tarball. A production install never carries `husky` either, since it is a devDependency.

Both the pack and install steps in `install-check.sh` pass `--ignore-scripts` for that reason.

### What the check does not prove

It proves inclusion, and that the installed package resolves without the development tree behind it. It says nothing about whether an excluded module stays reachable through another path at runtime, the class the dynamic-import split in `src/capture/render.ts` closes by keeping every browser reference behind a call-time import.

### Release claims in pointer bodies

A pointer body naming the release that removes it asserts what `release-please` will do, and the bump comes from the commit types in the branch rather than the sentence.

Pick the commit type that produces the version and say so in the plan or the pull request. Prefer one release claim repeated by reference over a copy in every surface that needs it.
