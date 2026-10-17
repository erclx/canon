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
- `src/tooling/` owns the manifest walk, scan, injection engine, reference resolver, and end-to-end verify

`canon tooling list` returns every stack with its extends chain and a dependency summary, so this entry carries no stack table. Five sibling entries cover the rest.

| Entry                                | Covers                               |
| ------------------------------------ | ------------------------------------ |
| `canon/context/tooling/stacks.md`    | what individual stacks decide        |
| `canon/context/tooling/capture.md`   | the served port and the capture seed |
| `canon/context/tooling/manifests.md` | the manifest and how layers resolve  |
| `canon/context/tooling/seeds.md`     | seed ownership and the seed gate     |
| `canon/context/tooling/testing.md`   | the end-to-end verify                |

### CLI

Six verbs cover the surface, and flags and arguments live in `docs/agents/index.md`.

- **`canon init`** bootstraps a project with base tooling and toolkit domains
- **`canon tooling sync`** runs the full sync of configs, seeds, deps, and gitignore entries
- **`canon tooling diff`** reports how a target differs from a stack and never writes
- **`canon tooling reference`** prints a stack's reference doc and never writes
- **`canon tooling list`** emits the catalog of stacks
- **`canon tooling verify`** scaffolds into a temp dir, syncs, then runs the full project check

### Workflow

Bootstrap a new project with `canon init`, which installs base configs, the Claude workflow, and governance, and scaffolds an empty `.claude/wiki/`. Governance installs the `base` stack when `--stack` is absent, and `--skip governance` declines it. The `target-setup` skill resolves the flags from detection and runs the chain in one shot.

For a multi-language monorepo, let the repository root own the `base` layer and give each language its own subfolder.

```bash
canon init                                              # base at the root
canon tooling sync vite-react ./frontend --skip base --write
canon tooling sync python ./backend --skip base --write
```

`--skip <stack>` removes the named layer and its parents across configs, seeds, deps, scripts, and gitignore, except for any config a skipped stack names under `[sync] per_root`, which `canon/context/tooling/manifests.md` covers. Each subtree still gets its own language configs.

### Adding a stack

Six steps add a stack, and sync discovers it automatically.

1. Copy the closest existing stack under `tooling/`, found through `canon tooling list`
2. Fill in `manifest.toml` with `extends`, deps, scripts, and optionally `[gitignore]` or `[verify]`
3. Fill in `reference.md` with prose documentation
4. Add golden configs to `configs/` for anything that ships as source of truth
5. Add seed files to `seeds/` for user-owned files that accumulate over time
6. Run `canon tooling verify <name>` to validate end to end

## Decisions

### Configs overwrite and seeds are preserved

The boundary is structural against user-extensible. Linters and formatters with no project-specific surface ship as configs. Files projects routinely extend ship as seeds, such as `.lintstagedrc`, base's `.github/workflows/verify.yml`, and `.github/pull_request_template.md`.

The config is the source, and a stack's reference carries only what a config cannot express, such as anti-patterns and opinions.

### An overwrite needs authority a caller states

`runSync` resolves a write mode through `resolveWriteMode` in `src/commands/tooling.ts`. `--check` reports, `--write` applies, a TTY prompts, and a headless caller with neither flag reports and exits 1. The install stamp follows the same authority, so a run with none leaves `canon/config/config.json` alone.

A confirm prompt carrying `nonInteractiveDefault` read silence as consent, which made `CANON_NON_INTERACTIVE=1` mean apply-all and cost a real target its deploy job and a 120-line screenshot harness. Measured at `0c953078` on 2026-08-20, across 41 golden files in 6 stacks.

- An opt-in `--dry-run` was declined, because a flag you have to remember is one nobody passes the first time, and the first time is when the target still holds the work
- Anything relying on `CANON_NON_INTERACTIVE=1` to mean yes broke, which is the accepted cost
- Sync carries no prompt that opens each diff in an editor, since shelling out to `code --diff` breaks a headless caller. Compare with git after syncing instead.

### The canon-cli skill sends a reader to the diff

`claude/skills/canon-cli/SKILL.md` flags the tooling sync as a verb that can lose edits and sends a reader to `canon docs sync`, which says sync overwrites golden configs and copies each seed once.

The reader then goes to `canon tooling diff <stack> <target>` for the paths, or `canon tooling sync --check` on an older binary. A generated path list in the body would lose, since a copy ships on a different cadence than the stacks it names.

### The diff verb

`canon tooling diff` is the read-only comparison named for asking. Most consuming projects have customized their tooling, so the comparison is the common act and the write is the rare one. It dispatches into `runSync` with `check` set and a `diff` marker rather than owning a second comparison, so the two cannot drift.

- It exits 1 when anything differs and 0 when nothing does, matching the headless no-flag `sync` gate, since a verb named `diff` is the natural thing to gate CI on
- `--check` keeps its always-zero exit and gets no deprecation notice, because target scripts call it and this repository cannot see them
- `--json` puts the scan record on stdout with `ok: true`, and every refusal answers `{ ok: false, reason, message }` through `refuse`, since an empty stdout reads as drift to a gate
- The verb is per domain rather than a top-level `canon diff <domain>`, since each domain compares different sources. Measured at `02439715` on 2026-09-20.

### Injection and the install stamp

`canon tooling inject <stack>` applies one stack without the scan and prompt, for `canon claude` and the sandbox. The excluded-stack guard sits on `sync` rather than in the shared path, which lets `canon claude` drive the `claude` stack through it.

A whole-stack install records the chain it resolved into `canon/config/config.json` through `recordToolingChain` in `src/tooling/stamp.ts`, which makes tooling drift measurable in `canon sync --check`. The write lands after the copies, so a partial apply that throws leaves the previous record.

- The workspace-root refusal sits in `canon/context/cli/stamp.md`

### Stack lookups resolve against the package

Every stack-name lookup in `src/commands/tooling.ts`, being `prepare`, `promptForStack`, and `printReference`, resolves against `PROJECT_ROOT` rather than the caller's working directory, because a stack is toolkit-authored and a target never carries its own `tooling/`.

`listStacks` called against any other root returns an empty list rather than falling back.

### What ships as code

The non-goal against shipping application code turns on the word application, and its carve-out in `canon/REQUIREMENTS.md` already reads configs, seeds, and rules.

Code ships when it is proven to leave the production build, either stripped by a build-time flag such as `import.meta.env.DEV` and confirmed absent from the output, or never reached from any production entry point.

- Test files, an e2e spec, the screenshot template, the five shell scripts under `tooling/*/configs/scripts/`, and the nine Claude hooks land executable source in a target under that proof
- `injectManifest` in `src/tooling/inject.ts` runs `bun add -D` against it, as for `tooling/web/configs/e2e/home.spec.ts` and `tooling/python/seeds/tests/test_smoke.py`
- The five scripts stay bash by decision, their TypeScript port deferred on 2026-10-12, and `canon/context/tooling/capture.md` records lifting the wrapper's readiness into TypeScript as rejected
- The rule that a script is TypeScript on Bun governs new scripts, so a session does not port these unasked
- `canon/context/tooling/stacks.md` records the astro scenario switcher, which ships under the same proof

### Composition and storage

Stacks do not compose horizontally, meaning two `extends` chains resolving at one root in a single `sync` call. A monorepo uses the subfolder pattern instead.

A second, orthogonal stack synced onto the same root works. `cloudflare` sets `extends = ""` and ships one config with no dependency or gitignore entries, so it collides with nothing at a root already carrying `astro`.

- `shell` is the second add-on, shipping `.shellcheckrc`, `.editorconfig`, a `shell.yml` workflow, and the `check:shell` and `format:shell` scripts, so base carries no shell tool

`tooling/claude/` is storage, not a stack. It holds seeds, user-level config, and a minimal manifest consumed only by the `canon claude` CLI, so `EXCLUDED_STACKS` in `src/tooling/manifest.ts` keeps it out of discovery.

## Gotchas

### Golden config commits

Commit golden config changes with `--no-verify`. Lint-staged runs against the template files themselves, not project source.

### Checkout mismatch warnings

A bare `canon` on PATH resolves `PROJECT_ROOT` to the installed package rather than the checkout a caller stands in. `findCheckoutMismatch` in `src/roots/project.ts` walks upward from `process.cwd()` for the nearest ancestor `package.json` sharing this package's name, and `checkoutMismatchWarning` formats the line naming both roots.

- `create`, `inject`, `list`, and `prune-gitignore` warn rather than refuse when the two differ
- `canon/context/cli/overview.md` carries the warning's reach across every other verb
- `canon tooling reference` is exempt, since `referenceRoots` puts the caller's own working root ahead of the package corpus
- A cwd one level short of the `tooling/` folder falls through to the package corpus with nothing said, and that precedence is deliberate
