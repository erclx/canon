---
name: internal-tooling
description: Tooling stacks, golden configs, seeds, references, and manifests. Use for stack creation, manifest authoring, or config sync.
---

# Tooling

Read `canon/context/surfaces/tooling.md` for system overview, configs vs seeds vs references, extends chain, and manifest authoring before editing.

## Layer model

Stack-specific configs override extends-chain configs at the same relative path. `scan` in `src/tooling/scan.ts` walks current-first. Run `canon tooling list` for the layer inventory, and read `canon/context/surfaces/tooling.md` for how each category resolves a duplicate.

## Manifest rules

Syntax invariants and the manifest-to-reference symmetry live in `internal/rules/claude/tooling-reference.md`, which fires on a `manifest.toml` edit without this skill being loaded. The rules below are what a rule bullet cannot carry.

- A version pin in `[dependencies.dev]`, such as `"eslint@^9"`, holds by major. Sync re-installs when the installed major differs, and leaves an unpinned dep alone when present.
- A `[scripts]` entry adds only when the key is missing from `package.json`, so the scaffold wins a shared key. `[scripts.override]` force-replaces an anti-pattern the scaffold ships.
- `tooling/claude/` is storage for `canon claude` and is excluded from stack discovery, so never route claude work through `canon tooling`
- Update `listStacks` in `src/tooling/manifest.ts` with any new discovery exclusion

### Configs and ignore lists

A golden config under `tooling/<stack>/configs/` that extends or references a package needs that package as a devDependency at the toolkit root. The deps serve TypeScript server resolution in the IDE alone, so never suppress them through `.vscode/settings.json`.

- List in `[gitignore]` only the paths the stack's tools generate beyond the scaffold's default `.gitignore`, running the scaffold in `/tmp` first to see what it writes
- `[gitignore]` group keys are single-word labels (`# VSCode`, `# Python`), not multi-word phrases. Keeps `.gitignore` comment headers terse and stable.

## Adding a new stack

- Copy the closest existing stack, found through `canon tooling list`, then edit its seeds, `manifest.toml`, and `reference.md`.
- Pick the parent layer via `extends = "web"` for any web framework, or `extends = "base"` for non-web stacks.
- Golden configs go in `configs/`. Only ship files that genuinely differ from the parent layer. Duplicating a parent config for no reason creates drift.

## Sync checklist

When modifying files in `tooling/base/configs/`:

- Apply the same change to the matching file at the repo root if it exists. The toolkit dogfoods base tooling as its own config source.
- Preserve local overrides in the root copy. Port the delta, not the whole file.

When modifying `tooling/<stack>/configs/` or `tooling/<stack>/seeds/`:

- Update `tooling/<stack>/reference.md` per `references/tooling-reference.md` if the intent or rationale changed. Typo fixes and dictionary terms do not count.
- Validate headless through `canon tooling verify <stack>`, which reports pass or fail per phase

When adding deps or scripts to `manifest.toml`:

- Verify they don't conflict with the parent stack in the extends chain.
- Scripts walk the extends chain too, so a child script overrides a parent script on the same key name.

## Verify command

`canon tooling verify <stack>` is the end-to-end validator, run after any change to `tooling/<stack>/` or `src/tooling/`. It scaffolds fresh into `.canon/tmp/runs/verify-<stack>/`, syncs, runs `lint:fix`, `format`, `check`, `test:e2e`, and `screenshot`, asserts the screenshot artifacts, and reports a results matrix.

- The `[verify] prepare` manifest field declares post-scaffold setup that runs before sync. Use for integrations that can not ship as golden configs (astro's `bunx astro add react`).
- Tmp dir auto-removes on success. Keeps on failure. Use `--keep` to inspect after a green run.

## Seed naming

Agent-facing prose seeds under `tooling/*/seeds/` use lowercase filenames, such as `development.md` and `ci.md`. CAPS, such as `CLAUDE.md` and `REQUIREMENTS.md`, is reserved for state and planning files agents read as known paths.

- Base agent-context seeds land at `tooling/base/seeds/canon/context/` and install to a target's `canon/context/`, matching the three-tier context model
- An unmoved project gets them beside the entries it still holds under `.claude/context/` <!-- canon-keep-surface-root -->
- Never seed agent-facing content under `tooling/*/seeds/docs/`, since `docs/` is reserved for human-facing prose

## Web stack authoring

The `web` reference serves a project that installed the stack, so the guidance below, for a session changing `web` or a framework stack on it, lives here.

### Framework adapters

Framework glue lives in `tooling/vite-react/configs/` or `tooling/astro/configs/`, because merge helpers and config shapes differ.

- `vite.config.ts` or `astro.config.mjs` holds the framework's config
- `vitest.config.ts` uses `mergeConfig` in a Vite stack and `getViteConfig` from `astro/config` in Astro
- `playwright.config.ts` differs in its `webServer` command
- `tsconfig.json` differs in its `extends` target. Astro uses `astro/tsconfigs/strict` and a Vite stack uses scaffold defaults.

### Config traps

Each costs a failed `canon tooling verify` run to relearn.

| Do not                                          | Why and what to do                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Use `exclude: ["e2e"]`                          | Bare-folder globs miss. Use `"e2e/**/*"`.                                                      |
| Put Playwright `trace` at the top of the config | It lives under `use`.                                                                          |
| Ship Vitest failing on no tests                 | Fresh scaffolds have none. Use `passWithNoTests: true` until one exists.                       |
| Drop `skipLibCheck: true` in Vite + React       | `@testing-library/jest-dom` and Vite's `module-runner` conflict otherwise.                     |
| Trust `vite-react`'s scaffolded `lint` script   | Its bare `oxlint` exits 0 on warnings. `[scripts.override]` forces `--max-warnings 0` over it. |

### Ports, verify, and screenshots

These hold the shipped behavior the `web` reference describes in place.

- Force-replace `dev` and `preview` through `[scripts.override]`, since a plain `[scripts]` entry never replaces a key the scaffold wrote
- Let astro, vite-react, and nextjs inherit `scripts/verify.json`, since the nearest stack's copy wins, and ship an adapter's own `verify.json` only when its phases differ
- Keep what the card check reads owned by the stack shipping a card route, being the build the stage before it produced. The astro reference carries the route.
- `canon tooling verify <stack>` is the only automated caller of `bun run screenshot`, and asserts PNG files land under `screenshots/`
- Keep the seed's section folders, since that count is a recursive find with no depth limit and flattening the layout to protect it breaks the capture

## Reference

- `canon/context/surfaces/tooling.md`: system overview, configs vs seeds vs references, extends chain, manifest authoring
- `references/tooling-reference.md`: conventions for writing reference.md docs
