---
title: Overview
description: What the tooling domain owns, configs against seeds, the authority an overwrite needs, the diff verb, the application-code carve-out, and adding a stack
---

# Overview

## Overview

Owns the golden configs a project inherits, layered across a `base` to `web` to framework chain where each layer ships only its own slice. A stack is a folder holding configs, seeds, a manifest, and a reference. Sync auto-discovers new stacks, so adding one requires no infrastructure change.

## Layout

- `tooling/<stack>/` owns one stack, always with a `manifest.toml` and a `reference.md`
- `tooling/<stack>/configs/` owns golden files that always overwrite on sync
- `tooling/<stack>/seeds/` owns user-owned files that sync preserves
- `tooling/claude/` owns storage for `canon claude`, excluded from stack discovery
- `src/tooling/` owns the manifest walk, scan, injection engine, and the reference resolver, in TypeScript
- `scripts/tooling/` owns the create and verify subcommands, still bash

`canon tooling list` returns every stack with its extends chain and a dependency summary, so this entry carries no stack table. `canon/context/tooling/stacks.md` covers what individual stacks decide, `canon/context/tooling/capture.md` the served port and the capture seed, `canon/context/tooling/manifests.md` the manifest and how layers resolve, `canon/context/tooling/seeds.md` seed ownership and the seed gate, and `canon/context/tooling/testing.md` the end-to-end verify.

## Decisions

### Configs overwrite and seeds are preserved

The boundary is structural against user-extensible. Linters and formatters with no project-specific surface ship as configs, while files projects routinely extend, such as `cspell.json`, `.lintstagedrc`, and base's `.github/workflows/verify.yml` and `.github/pull_request_template.md`, ship as seeds. The config is the source, and a stack's reference carries only what a config cannot express, such as anti-patterns and opinions.

### An overwrite needs authority a caller states

`runSync` resolves a write mode through `resolveWriteMode` in `src/commands/tooling.ts`. `--check` reports, `--write` applies, a TTY prompts, and a headless caller with neither flag reports and exits 1. The install stamp follows the same authority, so a run with none leaves `canon/config/config.json` alone rather than recording a sync it never performed.

A confirm prompt carrying `nonInteractiveDefault` reads silence as consent, which made `CANON_NON_INTERACTIVE=1` mean apply-all and cost a real target its deploy job and a 120-line screenshot harness. An opt-in `--dry-run` was the alternative and it is declined, because a flag you have to remember is one nobody passes the first time, and the first time is when the target still holds the work. Anything relying on `CANON_NON_INTERACTIVE=1` to mean yes broke, which is the accepted cost. Measured at `0c953078` on 2026-08-20, across a golden-config category holding 41 files across 6 stacks.

The overwrite contract in `claude/skills/canon-cli/SKILL.md` names the category and sends a reader to `canon tooling diff <stack> <target>` for the paths, or to `canon tooling sync --check` on a binary older than that verb. A generated path list in the body was the alternative and it loses, since a copy ships on a different cadence than the stacks it names.

Sync carries no prompt that opens each diff in an editor. Shelling out to `code --diff` is what breaks a headless caller, so compare with git after syncing instead.

### The diff verb

`canon tooling diff` is the read-only comparison named for asking. Most consuming projects have customized their tooling, so the comparison is the common act and the write is the rare one. It dispatches into `runSync` with `check` set and a `diff` marker rather than owning a second comparison, so the two cannot drift.

It exits 1 when anything differs and 0 when nothing does, matching the headless no-flag `sync` gate, since a verb named `diff` is the natural thing to gate CI on. `--check` keeps its always-zero exit and gets no deprecation notice, because target scripts call it and this repository cannot see them. `--json` puts the scan record on stdout with `ok: true`, and every refusal answers `{ ok: false, reason, message }` there too through `refuse` in `src/commands/tooling.ts`, since a refusal that exits 1 with an empty stdout reads as drift to a gate.

The verb is per domain rather than a top-level `canon diff <domain>`, since each domain compares different sources. Measured at `02439715` on 2026-09-20.

### Injection and the install stamp

`canon tooling inject <stack>` applies one stack without the scan and prompt, for `canon claude` and the sandbox. The excluded-stack guard sits on `sync` rather than in the shared path, which is what lets `canon claude` drive the `claude` stack through it.

A whole-stack install records the chain it resolved into `canon/config/config.json` through `recordToolingChain` in `src/tooling/stamp.ts`, which is what makes tooling drift measurable in `canon sync --check`. The write lands after the copies, so a partial apply that throws leaves the previous record rather than a claim the target does not meet. The rationale and the workspace-root refusal sit in `canon/context/cli/sync.md`.

### Stack lookups resolve against the package

Every stack-name lookup in `src/commands/tooling.ts`, being `prepare`, `promptForStack`, and `printReference`, resolves against `PROJECT_ROOT` rather than the caller's working directory, because a stack is toolkit-authored and a target never carries its own `tooling/`. `listStacks` called against any other root returns an empty list rather than falling back.

### What ships as code

The non-goal against shipping application code turns on the word application, and its carve-out in `canon/REQUIREMENTS.md` already reads configs, seeds, snippets, and rules. It turns on proof rather than on a project boundary: code ships when it is proven to leave the production build, either stripped by a build-time flag such as `import.meta.env.DEV` and confirmed absent from the built output, or never reached from any production entry point.

Test files, an e2e spec, the screenshot template, and six shell scripts land executable source in a target under that proof, such as `tooling/web/configs/e2e/home.spec.ts` and `tooling/python/seeds/tests/test_smoke.py`, and `injectManifest` in `src/tooling/inject.ts` runs `bun add -D` against it. `canon/context/tooling/stacks.md` records the astro scenario switcher, which ships under the same proof.

### Composition and storage

Stacks do not compose horizontally, meaning two `extends` chains resolving at one root in a single `sync` call. A monorepo uses the subfolder pattern instead. A second, orthogonal stack synced onto the same root is a different case and works: `cloudflare` sets `extends = ""` and ships one config with no dependency or gitignore entries, so `canon tooling sync cloudflare . --write` at a root already carrying `astro` collides with nothing.

`tooling/claude/` is storage, not a stack. It holds seeds, user-level config, and a minimal manifest consumed only by the `canon claude` CLI, so `TOOLING_STACK_EXCLUDE` keeps it out of discovery.

## Gotchas

- Commit golden config changes with `--no-verify`. Lint-staged runs against the template files themselves, not project source.
- A bare `canon` on PATH resolves `PROJECT_ROOT` to the installed package rather than the checkout a caller stands in. `findCheckoutMismatch` in `src/project-root.ts` walks upward from `process.cwd()` for the nearest ancestor `package.json` sharing this package's name, and `checkoutMismatchWarning` beside it formats the line naming both roots. `create`, `inject`, `list`, and `prune-gitignore` warn rather than refuse when the two differ. `canon/context/cli/overview.md` carries the warning's reach across every other verb.
- `canon tooling reference` is exempt, alongside `canon standards <name>`. `referenceRoots` and `standardRoots` put the caller's own working root ahead of the package corpus, so a caller standing in the checkout already reads it. A cwd one level short of the `tooling/` or `standards/` folder falls through to the package corpus with nothing said, and that precedence is deliberate.

## CLI

- `canon init` bootstraps a project with base tooling and toolkit domains
- `canon tooling sync` runs the full sync of configs, seeds, deps, and gitignore entries
- `canon tooling diff` reports how a target differs from a stack and never writes
- `canon tooling reference` prints a stack's reference doc and never writes
- `canon tooling create` creates a stack folder with a stub manifest and reference
- `canon tooling list` emits the catalog of stacks
- `canon tooling verify` scaffolds into a temp dir, syncs, then runs the full project check

Flags and arguments live in `docs/agents/index.md`.

## Workflow

Bootstrap a new project with `canon init`, which installs base configs, the Claude workflow, and governance in one command, and scaffolds an empty `.claude/wiki/`. Governance installs the `base` stack when `--stack` is absent, and `--skip governance` declines it. Neither standards nor snippets installs into a project, so neither carries a flag. The `target-setup` skill resolves the flags from project detection and runs the chain in one shot.

Set up a multi-language monorepo by letting the repository root own the `base` layer and giving each language its own subfolder:

```bash
canon init                                              # base at the root
canon tooling sync vite-react ./frontend --skip base --write
canon tooling sync python ./backend --skip base --write
```

`--skip <stack>` removes the named layer and its parents across configs, seeds, deps, scripts, and gitignore. Each subtree still gets its own language configs.

### Adding a stack

1. Run `canon tooling create` to generate the stub structure
2. Fill in `manifest.toml` with `extends`, deps, scripts, and optionally `[gitignore]` or `[verify]`
3. Fill in `reference.md` with prose documentation
4. Add golden configs to `configs/` for anything that ships as source of truth
5. Add seed files to `seeds/` for user-owned files that accumulate over time
6. Run `canon tooling verify <name>` to validate end to end

Sync auto-discovers the new stack.
