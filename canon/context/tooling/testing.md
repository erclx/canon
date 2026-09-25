---
title: Testing
description: The end-to-end tooling verify, which stack to verify a parent-layer edit through, resolving the checkout rather than PATH, the seeded spelling words, browser installs, and the unit coverage
---

# Testing

## Overview

`canon tooling verify <stack>` is the end-to-end validator for a stack. Unit tests cover the engine beneath it. `canon/context/tooling/stacks.md` records the per-stack scaffold fixes the verify run surfaced.

## Decisions

### What the verify run does

The verb scaffolds fresh into `.canon/tmp/runs/verify-<stack>/`, runs the optional `[verify] prepare` hook, invokes `canon tooling sync <stack> . --write`, then runs `bun run lint:fix`, `bun run check`, `bun run test:e2e`, and `bun run screenshot`, asserts screenshot artifacts, and reports a pass and fail matrix. The tmp dir removes itself on success. Pass `--keep` to inspect a green run, and a failing run is preserved on its own.

Run it after any change to `tooling/<stack>/configs/`, a manifest, or the sync logic in `src/tooling/`. `scripts/tooling/verify.sh` exports `CI` before scaffolding, so the `isCI` branches in the two shipped `playwright.config.ts` files run the way a target's CI job runs them.

The scaffold and sync phases are confirmed against local source. The phases beyond them are not confirmed to pass on this machine.

### Verify a parent layer through its children

The stack a verify names has to scaffold. `canon tooling verify web` refuses with `Stack 'web' has no scaffold command in manifest.`, because the web layer is a shared parent. A change to `tooling/web/configs/` is validated through its two consumers, `vite-react` and `astro`, rather than through the layer that owns the edited file. Measured 2026-08-14.

### Verify resolves the checkout, never PATH

The Sync phase in `scripts/tooling/verify.sh` shells to `bun "$PROJECT_ROOT/src/cli.ts"` rather than bare `canon`, so it resolves the checkout it runs from. Its output names the binary that answers, and `src/tooling-verify.test.ts` stubs both binaries and fails if the phase ever reaches PATH `canon` again.

Never verify a tooling edit through bare `canon tooling verify`, which resolves whatever install sits on PATH. Run `bun src/cli.ts tooling verify <stack>` from the worktree, or `bash scripts/tooling/verify.sh <stack>`, where `PROJECT_ROOT` derives from `SCRIPT_DIR`. `canon tooling sync` carries the same trap with no internal reroute, which the checkout-mismatch warning in `canon/context/tooling/overview.md` reports.

### Unit coverage

Unit tests cover the manifest walk, the gitignore transforms, the `package.json` comparisons, and the scan. Equivalence against the bash the engine replaced was established by syncing every stack into paired fixtures and diffing contents and file modes, which is the check to repeat when changing injection order or copy semantics.

## Gotchas

- Six words block `check:spell` in a verify run, and each sits in the seed that introduces it. `errexit`, `esac`, and `regen` are in `tooling/base/seeds/.cspell/tech-stack.txt`, from `.husky/post-merge` and `.lintstagedrc`. `cksum` and `toplevel` are in `tooling/web/seeds/.cspell/tech-stack.txt`, from `scripts/worktree-port.sh`. `tsgolint` is in `tooling/vite-react/seeds/.cspell/tech-stack.txt`, from the scaffold's own `README.md`.
- A stack whose manifest leaves a dependency unpinned resolves whatever is current at scaffold time. `web`'s `@playwright/test` carries no version, so a scaffold can resolve a newer release than this checkout's pinned devDependency, needing different cached browser binaries. Install browsers from inside the scaffold, `.canon/tmp/runs/verify-<stack>/node_modules/.bin/playwright install <browsers>`, since installing from this checkout's root targets the wrong version and fails E2E with `browserType.launch: Executable doesn't exist`. Measured 2026-09-05 against `astro`.
