---
title: Stacks
description: Per-stack decisions, being the toolchain stacks off base, script overrides, the astro scenario switcher, the lint conventions, and the astro, nextjs, and vite-react scaffold fixes
---

# Stacks

## Overview

What individual stacks decide beyond the shared layering. `canon tooling list` returns the catalog and `canon tooling reference <stack>` prints what each stack ships, so this file holds only the reasoning neither carries. `canon/context/tooling/overview.md` covers the domain as a whole.

## Decisions

### Toolchain stacks extend base

`python`, `go`, and `php` extend `base` directly rather than going through `web`. Each runs on its own toolchain, being `uv`, `go`, and `composer`, instead of `bun`, so the web layer's assumptions do not apply. Each leaves its dev tools as a manual install step in its reference.

### Web's verify workflow stays a config

Web's `verify.yml` carries the web chain's own static check, unit test, build, and e2e jobs rather than a project's additions, so it keeps syncing while base's copy is a seed. It shadows base's seed at the same path, so a web target still receives every change to it. `canon/context/tooling/seeds.md` states why base's copy is a seed.

### Script overrides

Scripts are never overwritten except through `[scripts.override]`, which exists for three cases.

- Scaffolds that ship an anti-pattern by default
- Toolkit-owned wrappers whose body must stay in lockstep with the shipped shell scripts
- A key whose value the stack owns where the scaffold writes its own, such as `dev`, `preview`, and `lint`

`lint` and `lint:fix` live at the `web` level because their value is shared, while `dev` and `preview` differ by framework and live per child.

- `vite-react`'s raw scaffold ships `"lint": "oxlint"` and a bare `.oxlintrc.json`, and that `lint` exits 0 on warnings
- The override forces `--max-warnings 0` over it, and the golden `.oxlintrc.json` at the same path overwrites the bare one rather than leaving a second config
- `astro` overrides both keys back to `eslint`, since oxlint parses no `.astro` file
- `check:format` and `format` sit under base's override for the same reason, so a target synced while the stack ran Prettier switches to oxfmt on its next sync
- The drift scan compares each override key against the value sync would write, so a stale override reads `drifted` and counts toward the pending total

### The Oxc tools replace Prettier and ESLint outside astro

Base formats with oxfmt, and `web`, `vite-react`, and `nextjs` lint with oxlint, running `eslint-plugin-check-file` and `eslint-plugin-simple-import-sort` as JS plugins. Prettier cost about 22 s on every check against under 3 s for oxfmt, and the Prettier plugins `web` installed never loaded in a target, since base's `.prettierrc` named none.

`astro` keeps both, scoped, because oxfmt loads no Prettier plugin and oxlint parses no custom file format.

- `.astro` files take Prettier with `prettier-plugin-astro` and ESLint with `eslint-plugin-astro`, and every other file takes oxfmt
- `astro`'s `.oxfmtrc.json` repeats base's options, because scan takes a child config over the parent's whole file
- Both tools are pinned to exact versions, since oxlint's JS plugin host is alpha. Measured against `e545d8823` on 2026-10-12.

### The astro scenario switcher

`tooling/astro/configs/src/components/dev/scenarios.astro` ships under the application-code proof `canon/context/tooling/overview.md` states, as a query-parameter switcher between candidate treatments of one decision. Leaving it in the one project that built it lost, since how something feels cannot be settled from a passive capture.

It ships from `tooling/astro/configs/` rather than `tooling/web/`, because `vite-react` shares the `web` parent and cannot parse `.astro` syntax. `vite-react` gets none until a React version is written against a real decision. Measured at `927f2571` on 2026-09-06.

### The web layer pins Vitest 5

`tooling/web/manifest.toml` pins `vitest`, `@vitest/coverage-v8`, and `@vitest/ui` to `^5`, since Vitest 3's `vite` peer range stops at 7 and a Vite 8 target warned on its first run. `^4` also covers Vite 8 and lost because it leaves the removed jest bridge untested in the golden and defers the same move to the next sync.

- The three goldens that named `@testing-library/jest-dom` take the `/vitest` entry in `setup.ts` and both `tsconfig.json` files, so the runtime import and the types agree
- Vitest 5 needs Node 22.12 or later. Measured against `5a7b49bd9` on 2026-10-12.

### Filename and folder conventions

`astro`, `web`, and `nextjs` all gate component filenames `KEBAB_CASE` rather than carving out Astro's PascalCase, since a component's name in markup comes from the import binding. `tooling/astro/configs/eslint.config.js` scopes the rule's pattern to `**/*.{ts,tsx,astro}`, leaving `.js` and `.jsx` outside it to match `web` and `nextjs`.

`check-file/folder-naming-convention`'s pattern needs a trailing slash, `src/**/!(__tests__|pages)/`, to capture any path segment. `micromatch.capture()` returns `undefined` for every directory against a pattern with no trailing slash, which the rule reads as nothing to check.

- With the slash in place, astro's `src/pages/[id]/` and nextjs's `[id]`, `(group)`, and `@slot` folders fail plain `KEBAB_CASE`
- So astro carries a `pages/**` off-block and nextjs a `src/app/**` one. Measured 2026-09-07 against all three shipped configs.

## Gotchas

### The astro alias and public folder

The astro golden config's `@` alias resolves with `path.resolve('./src')`, which reads the invoking process's cwd rather than the config file's directory. It is correct only when the consumer has its own `package.json` at the astro root and every script runs from there.

Running astro with `--root <subdir>` from elsewhere resolves the alias and every build path against the wrong tree, landing `dist/` and `.astro/` beside the wrong `package.json` with no error. Set the shell's cwd to the project root instead.

- An astro `public/` folder symlinked to a source elsewhere inherits the cost any symlink under `claude/` carries
- A native Windows checkout without symlink support materializes each entry as a plain text file holding the path, so the page renders a broken image with no error
- A deploy building in CI on Linux is unaffected

### The astro scaffold

Three details of the astro scaffold fail before a test runs.

- `typescript` must stay pinned to `^6` in `tooling/web/manifest.toml`. The scaffold lists none, and an unpinned install resolves past `typescript-eslint`'s peer range and throws before `Spelling`.
- `astro preview` backgrounds itself by default in the release the scaffold resolves, so Playwright's `webServer` meets `Process from config.webServer exited early`
- `tooling/astro/configs/playwright.config.ts` sets `ASTRO_PREVIEW_BACKGROUND: '0'` on its `webServer` block, keeping Playwright's process foregrounded. `vite-react` needs none.

### The nextjs scaffold

Four details matter for the nextjs scaffold.

- Its non-interactive flags are `--skip-install` and `--disable-git`, with no `--turbopack` flag since Turbopack is the default
- `--no-agents-md` suppresses the scaffold's `AGENTS.md` and `CLAUDE.md`, which collide with a root one, and `--no-linter` its `eslint.config.mjs` and `lint` script. `--help` lists neither.
- `typecheck` runs `next typegen && tsc --noEmit`, since the App Router's route-level types generate into a gitignored `.next/types/` absent from a fresh checkout
- It carries a `[gitignore]` group naming `.next/`, matching `astro`'s, for a target whose `.gitignore` never carried that scaffold default

### Other scaffolds and eslint

The `python`, `go`, and `php` scaffolds write no `package.json`, so each manifest's `[verify] prepare` runs `bun init -y` and installs the dev tools its reference lists before Sync. Without that step the verify would stop after Sync, and a run that reaches the end with no `package.json` fails rather than reporting green.

- The python and php prepares install over the network on every run, while go's installs `golangci-lint` only when the binary is absent from PATH
- A machine missing `uv`, `go`, or `composer` fails at Prepare, where the runner's own probe names what is missing
- Verifying against astro's eslint config needs `eslint@9` pinned in a scratch install, since ESLint 10 dropped the `LegacyESLint` shim `typescript-eslint@8.69.0` still imports
