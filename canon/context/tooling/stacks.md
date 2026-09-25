---
title: Stacks
description: Per-stack decisions, being the toolchain stacks off base, script overrides, the astro scenario switcher, the lint conventions, and the astro, nextjs, and vite-react scaffold fixes
---

# Stacks

## Overview

What individual stacks decide beyond the shared layering. `canon tooling list` returns the catalog and `canon tooling reference <stack>` prints what each stack ships, so this file holds only the reasoning neither carries. `canon/context/tooling/overview.md` covers the domain as a whole.

## Decisions

### Toolchain stacks extend base

`python`, `go`, and `php` extend `base` directly rather than going through `web`. Each runs on its own toolchain, being `uv`, `go`, and `composer`, instead of `bun`, so the web layer's assumptions do not apply, and each leaves its dev tools as a manual install step in its reference.

### Web's verify workflow stays a config

Web's `verify.yml` carries the web chain's own static check, unit test, build, and e2e jobs rather than a project's additions, so it keeps syncing while base's copy is a seed. It shadows base's seed at the same path, so a web target still receives every change to it. `canon/context/tooling/seeds.md` states why base's copy is a seed.

### Script overrides

Scripts are never overwritten except through `[scripts.override]`, which exists for three cases: scaffolds that ship an anti-pattern by default, toolkit-owned wrappers whose body must stay in lockstep with the shipped shell scripts, and a key whose value the stack owns where the scaffold writes its own. `dev`, `preview`, and `lint` are the third case, since every scaffold that defines one keeps it through an ordinary `[scripts]` entry.

`lint` lives at the `web` level because its value is shared, while `dev` and `preview` differ by framework and live per child. `vite-react`'s raw scaffold ships `"lint": "oxlint"` and a bare `.oxlintrc.json`, and the oxlint it resolves runs under its own default rule set with exit 0, never reaching the stack's ESLint config or its `--max-warnings 0` gate. The override is what forces `lint` back to the stack's eslint invocation.

### The astro scenario switcher

`tooling/astro/configs/src/components/dev/scenarios.astro` ships under the application-code proof `canon/context/tooling/overview.md` states, as a query-parameter-selected switcher between candidate treatments of one decision. Leaving it in the one project that had built it was the alternative and it lost, since a decision about how something feels to cause cannot be settled from a passive capture, and every other project would have rewritten the same parameter-and-switcher pair.

It ships from `tooling/astro/configs/` rather than `tooling/web/`, because `vite-react` shares the `web` parent and cannot parse `.astro` syntax. `vite-react` gets no equivalent until a React version is written against a real decision. Measured at `927f2571` on 2026-09-06.

### Filename and folder conventions

`astro`, `web`, and `nextjs` all gate component filenames `KEBAB_CASE` rather than carving out Astro's PascalCase convention, since a component's name in markup comes from the import binding rather than the filename. `tooling/astro/configs/eslint.config.js` scopes `files` to `**/*.{ts,tsx,js,jsx,astro}` and the rule's own pattern to `**/*.{ts,tsx,astro}`, leaving `.js` and `.jsx` outside it to match `web` and `nextjs`.

`check-file/folder-naming-convention`'s pattern needs a trailing slash, `src/**/!(__tests__|pages)/`, to capture any path segment. `micromatch.capture()` returns `undefined` for every directory against a pattern with no trailing slash, which the rule reads as nothing to check. With the slash in place, astro's `src/pages/[id]/` and nextjs's `[id]`, `(group)`, and `@slot` folders fail plain `KEBAB_CASE`, so astro carries a `pages/**` off-block and nextjs a `src/app/**` one. Measured 2026-09-07 against all three shipped configs.

## Gotchas

- The astro golden config's `@` alias resolves with `path.resolve('./src')`, which reads the invoking process's cwd rather than the config file's directory. It is correct only when the consumer has its own `package.json` at the astro root and every script runs from there. Running astro with `--root <subdir>` from elsewhere resolves the alias and every relative build path against the wrong tree, landing `dist/` and `.astro/` beside the wrong `package.json` with no error. Set the shell's cwd to the project root instead.
- An astro `public/` folder symlinked to a source elsewhere inherits the cost `claude/standards` and `claude/snippets` carry. A native Windows checkout without symlink support materializes each entry as a plain text file holding the path, astro copies `public/` verbatim, and the page renders a broken image with no error. A deploy building in CI on Linux is unaffected.
- `astro` needs `tooling/web/manifest.toml`'s `typescript` dependency pinned to `^6`. Its scaffold lists no `typescript` of its own, and an unpinned install resolves past `typescript-eslint`'s peer range, throwing before `scripts/verify.sh` reaches `Spelling` under `set -e`.
- `astro preview` backgrounds itself by default in the release the scaffold resolves, so Playwright's `webServer` meets `Process from config.webServer exited early`. `tooling/astro/configs/playwright.config.ts` sets `env: { ASTRO_PREVIEW_BACKGROUND: '0' }` on its `webServer` block, which keeps Playwright's own process foregrounded without touching the `preview` script a person runs by hand. `vite-react` needs no equivalent, since its `webServer` runs plain `vite` through `bun run dev`.
- `nextjs`'s non-interactive scaffold flags are `--skip-install` and `--disable-git`, with no `--turbopack` flag since Turbopack is the default. `--no-agents-md` suppresses the scaffold-time `AGENTS.md` and `CLAUDE.md` write that would collide with a root `CLAUDE.md`. Its `typecheck` runs `next typegen && tsc --noEmit`, since the App Router's route-level types generate into a gitignored `.next/types/` absent from a fresh checkout.
- `nextjs` carries a `[gitignore]` group naming `.next/`, matching `astro`'s, for a target whose `.gitignore` never carried that scaffold default.
- Verifying against these eslint configs needs `eslint@9` pinned in a scratch install. ESLint 10 dropped the `LegacyESLint` shim that `typescript-eslint@8.69.0`'s bundled `@typescript-eslint/utils` still imports, so it crashes on load.
