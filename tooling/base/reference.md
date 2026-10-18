# Tooling base reference

## Overview

The base layer covers every project the toolkit scaffolds, whatever language sits on top. It ships formatting, conventional commits, git hooks, CI, and the verify runner. Every other stack extends it, so a decision made here is one every stack inherits. Shell formatting and linting live in the `shell` add-on stack.

A repository with several language roots layers this stack once at the root and skips it per subtree, since git honors only one `core.hooksPath` and a re-dropped husky silently breaks. `canon docs scenarios` carries the recipe.

## What ships as golden configs

Golden configs live in `tooling/base/configs/`. `canon tooling sync base . --write` copies them into the target and replaces whatever sits at those paths. They are the source of truth, so this reference covers rationale and the configs show the setup.

### Formatting and commit configs

Two configs fix how output looks and how commits read.

- `.oxfmtrc.json` sets `semi: false`, `singleQuote: true`, `printWidth: 80`, and `sortPackageJson: false`, keeping the output Prettier wrote.
- The `astro` stack repeats those options in its own copy, so copy a change here into it.
- `commitlint.config.js` is an ESM default export extending `@commitlint/config-conventional`. It sets `header-max-length: 72`, `scope-case: lower-case`, and `subject-full-stop: never`.
- Its `subject-case` rule is off.

### Verify runner

`scripts/verify.ts` is the one verify runner every stack shares, and the command behind `check`. It uses Node modules only, since a target's own lint and typecheck read it.

- It runs typecheck, lint, format check, shell, unit tests, build, markdown bans, then card exclusion, always in that order, and skips any phase the folder's `scripts/verify.json` leaves out.
- `scripts/verify.json` lists the phases a stack requires, plus any tools and preconditions it probes first. The nearest stack's copy wins.
- A required phase whose script `package.json` lacks fails the run. A base phase the list leaves out runs only where the folder declares its script.
- Base requires `check:format`, so a base-only target still fails on a missing one.
- The shell phase runs only where `package.json` declares `check:shell`, which the `shell` stack adds, and probes for `shfmt` and `shellcheck` first.

These two files are base's `[sync] per_root` set, which a `--skip base` subfolder still receives.

## What ships as user-owned seeds

Seeds live in `tooling/base/seeds/`. Sync drops each once on first install and never overwrites it, so a project extends them freely.

- `.lintstagedrc` holds the glob map below.
- `.github/workflows/verify.yml` runs on pull requests targeting `main` and on `workflow_dispatch`. A multi-root project adds its own jobs here.
- `.github/pull_request_template.md` has `## Summary`, `## Key changes`, `## Technical context`, and `## Testing`. A project adds its own checklist lines.
- `canon/context/development/` holds the `setup` and `ci` entries under a folder index. Extend them with project-specific commands and workflows, and keep canonical rationale here.

## Tool pairing

- Runtime is `bun` as package manager and script runner, with `bunx` over `npx` for a one-off executable.
- Formatting is oxfmt for what it parses, pinned to an exact version so an upgrade arrives as a reviewed diff. Shell formatting is the `shell` stack's, since oxfmt has no shell parser.
- Commits go through commitlint against conventional commits, wired through the husky `commit-msg` hook. The format is `<type>(<scope>): <subject>` in imperative mood with no trailing period.
- Dev dependencies are `oxfmt`, `husky`, `@commitlint/cli`, and `@commitlint/config-conventional`, installed via `bun add -D`.

## oxfmt

- Add a project's own ignores to `.prettierignore`, which oxfmt reads beside `.gitignore` by default. Sync overwrites `.oxfmtrc.json`, so an entry in its `ignorePatterns` is lost on the next sync.
- After the first sync onto oxfmt, delete a leftover `.prettierrc` and run `bun remove prettier`. Sync deletes nothing a stack stopped shipping.

## File layout

Hooks live in `.husky/` and seeded context docs in `canon/context/`. That location matches the three-tier context model.

- Project-wide invariants sit in `CLAUDE.md` and `canon/REQUIREMENTS.md`.
- Path-scoped rules sit in `.claude/rules/`.
- On-demand domain narrative sits in `canon/context/`, with indexes opt-in.

## Hooks

- `pre-commit` runs `bunx lint-staged`.
- `commit-msg` runs `bunx commitlint --edit "$1"`.
- `pre-push` runs `bun run check`.
- `post-rewrite` delegates to `post-merge` on `rebase`, so a `pull.rebase=true` machine still gets the check.
- `post-merge` runs `canon hooks post-merge`, which archives the task a merged pull request closed, pushes the records, reclaims merged worktrees, reinstalls the CLI, and updates the plugin.

The hook does nothing when the board is absent. `CANON_SKIP_RECLAIM`, `CANON_SKIP_UPGRADE`, and `CANON_SKIP_PLUGIN_UPDATE` turn off the three steps that act on the machine, and `canon hooks post-merge --help` states the contract.

## lint-staged

The seeded baseline globs.

- `**/*.{json,md}` runs `oxfmt --no-error-on-unmatched-pattern`. Without the flag, a staged file every pattern ignores, such as `CHANGELOG.md`, exits 2 and fails the commit.
- `**/*.md` runs `canon indexes regen`.

## CI

- Steps are checkout, setup Bun at latest, `bun install --frozen-lockfile`, then `check:format`.
- CI asserts and never writes, so format must be clean before push.

## Anti-patterns

Negative knowledge that costs a failed run to relearn.

- Do NOT pass `--ignore-path` to oxfmt. It replaces the default `.gitignore` and `.prettierignore` pair rather than adding to it.
- Do NOT put logic in a husky hook and expect its shebang to hold. Husky runs hooks as `sh -e`, so a hook carrying logic is POSIX sh under errexit whatever the first line says.

## CLI

| Script                 | What it does                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `bun run check`        | Gates a checkout through `scripts/verify.ts`, writing nothing. `VERIFY_NESTED=true` suppresses timeline boundaries in a call. |
| `bun run check:format` | Asserts oxfmt formatting without writing                                                                                      |
| `bun run format`       | Writes oxfmt formatting in place                                                                                              |
| `bun run prepare`      | Initializes husky hooks, run automatically on `bun install`                                                                   |

### The check script

Base writes `check` as a `[scripts.override]`, so a sync replaces whatever `check` a target declared, including one that chained further checks after the runner. Re-add a chained check as its own script after a sync.

- `bun run check` writes nothing. Formatting drift fails it at `check:format`, and the failure line names `bun run format`, the one command that writes.
- Auto-fixing drift inside `check` rewrote files in a shared checkout on every push and left a gate that could not fail, so the writing pass stays in `bun run format`.
- The pull request workflow calls `check:format` directly as well.

### The markdown bans stage

The `Markdown bans` stage of `scripts/verify.ts` runs `canon markdown audit` over every tracked markdown file except `CHANGELOG.md`, since a generated changelog carries commit subjects nobody wrote against the ban set.

- It exits `2` on a finding or `3` on a shipped-empty ban set, failing `bun run check` and the `pre-push` hook that calls it.
- A refusal to measure exits `1` and is logged as a skip, as does a corpus with no file left once `CHANGELOG.md` is set aside.
- The stage needs `canon` on PATH, and `canon docs projects` names the install command. Without it the stage is skipped and logged.
