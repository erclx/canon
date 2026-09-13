---
name: internal-tooling
description: Tooling stacks, golden configs, seeds, references, and manifests. Use for stack creation, manifest authoring, or config sync.
---

# Tooling

Read `canon/context/tooling.md` for system overview, configs vs seeds vs references, extends chain, and manifest authoring before editing.

## Layer model

Stack-specific configs override extends-chain configs at the same relative path. `scan` in `src/tooling/scan.ts` walks current-first. Refer to `canon/context/tooling.md` for the layer inventory and what each one owns.

## Manifest rules

Syntax invariants and the manifest-to-reference symmetry live in `internal/rules/claude/595-tooling-reference.md`, which fires on a `manifest.toml` edit without this skill being loaded. The rules below are what a rule bullet cannot carry.

- Version pins in `[dependencies.dev]` (e.g. `"eslint@^9"`) are enforced by major version. Sync compares the installed dep's major against the pin's major and re-installs on mismatch. Deps without pins are left alone when present.
- `[scripts]` entries add only when the key is missing in `package.json`. Scaffolds win for keys both sides define. Use `[scripts.override]` to force-replace a key, for anti-patterns the scaffold ships by default.
- `tooling/claude/` is excluded from stack discovery. It is storage for `canon claude` only. Do not route claude work through the `canon tooling` CLI, and do not add new exclusions without updating `scripts/lib/tooling.sh`.
- When a golden config under `tooling/<stack>/configs/` extends or references a package, install that package as a devDependency at toolkit root. The deps are IDE-only, for TypeScript server resolution against the workspace `tsconfig.json`. Do not suppress via `.vscode/settings.json`.
- List only paths in `[gitignore]` that the stack's tools generate beyond the scaffold's default `.gitignore`. Run the scaffold in `/tmp` first to confirm what it already writes.
- `[gitignore]` group keys are single-word labels (`# VSCode`, `# Python`), not multi-word phrases. Keeps `.gitignore` comment headers terse and stable.

## Adding a new stack

- Use `canon tooling create` to generate the stub structure, then fill in seeds, `manifest.toml`, and `reference.md`.
- Pick the parent layer via `extends = "web"` for any web framework, or `extends = "base"` for non-web stacks.
- Golden configs go in `configs/`. Only ship files that genuinely differ from the parent layer. Duplicating a parent config for no reason creates drift.

## Sync checklist

When modifying files in `tooling/base/configs/`:

- Apply the same change to the matching file at the repo root if it exists. The toolkit dogfoods base tooling as its own config source.
- Preserve local overrides in the root copy. Port the delta, not the whole file.

When modifying `tooling/<stack>/configs/` or `tooling/<stack>/seeds/`:

- Update `tooling/<stack>/reference.md` if the intent or rationale changed. Typo fixes and dictionary term additions do not count.
- Validate headless via `canon tooling verify <stack>`. Scaffolds into `.canon/tmp/verify-<stack>/`, runs the full chain through `check`, `test:e2e`, and `screenshot`, and reports pass/fail per phase.

When adding deps or scripts to `manifest.toml`:

- Verify they don't conflict with the parent stack in the extends chain.
- Scripts walk the extends chain too: child scripts override parent scripts on the same key name.

## Verify command

`canon tooling verify <stack>` is the end-to-end validator. Scaffolds fresh, syncs, runs `lint:fix`, `check`, `test:e2e`, and `screenshot`, asserts screenshot artifacts, reports a results matrix. Use it after any change to `tooling/<stack>/` or `src/tooling/`.

- The `[verify] prepare` manifest field declares post-scaffold setup that runs before sync. Use for integrations that can not ship as golden configs (astro's `bunx astro add react`).
- Tmp dir auto-removes on success. Keeps on failure. Use `--keep` to inspect after a green run.

## Seed naming

- Agent-facing prose seeds under `tooling/*/seeds/` use lowercase filenames (`development.md`, `ci.md`). Reserve CAPS (`CLAUDE.md`, `REQUIREMENTS.md`, `ARCHITECTURE.md`) for state and planning files that agents read as known paths.
- Base agent-context seeds land at `tooling/base/seeds/canon/context/` and install to target projects' `canon/context/`, or beside the entries an unmoved project still holds under `.claude/context/`. <!-- canon-keep-surface-root --> This matches the three-tier context model documented in the `internal-claude` seed. Do not seed agent-facing content under `tooling/*/seeds/docs/`. The `docs/` location is reserved for human-facing prose.

## Cspell seeds

Seed files merge across layers. Each stack contributes words to the target's `.cspell/tech-stack.txt` via the seed merge in `src/tooling/inject.ts`. Do not duplicate terms across layers. Place each word in the narrowest layer that needs it (toolkit-ecosystem → `base`, web-universal → `web`, framework-specific → the adapter).

## Reference

- `canon/context/tooling.md`: system overview, configs vs seeds vs references, extends chain, manifest authoring
- `internal/standards/tooling-reference.md`: conventions for writing reference.md docs
