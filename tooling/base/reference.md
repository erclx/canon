# Tooling base reference

## Overview

The base layer covers every project the toolkit scaffolds, whatever language sits on top. It ships formatting, conventional commits, git hooks, CI, and the verify runner. Every other stack extends it, so a decision made here is one every stack inherits. Shell formatting and linting live in the `shell` add-on stack, which a project syncs once it writes shell.

A repository with several language roots layers this stack once at the root and skips it per subtree, since git honors only one `core.hooksPath` and a re-dropped husky silently breaks. `canon docs scenarios` carries the recipe.

## What ships as golden configs

Golden config files live in `tooling/base/configs/` and are copied into the target on `canon tooling sync base . --write`, replacing whatever sits at those paths. They are the source of truth. The reference covers rationale and tradeoffs. Configs show the concrete setup.

- `.prettierrc`: `semi: false`, `singleQuote: true`, plus a parser override per non-standard extension (`.mdx` to `markdown`).
- `commitlint.config.js`: ESM default export extending `@commitlint/config-conventional`. Rules are `header-max-length: 72`, `scope-case: lower-case`, `subject-full-stop: never`, `subject-case` disabled, and a local `no-claude-co-author` rule refusing a `Co-authored-by` trailer that names Claude or Anthropic.
- `.husky/`: `pre-commit`, `commit-msg`, `pre-push`, `post-merge`, `post-rewrite`.
- `scripts/verify.ts`: the one verify runner every stack shares, and the command behind `check`. It runs typecheck, lint, format check, shell, unit tests, build, markdown bans, then card exclusion, always in that order, and skips any phase the folder's `scripts/verify.json` leaves out. Node modules only, since a target's own lint and typecheck read it.
- `scripts/verify.json`: the phases a stack requires, plus any tools and preconditions it probes first. The nearest stack's copy wins. A required phase whose script `package.json` lacks fails the run. A base phase the list leaves out runs only where the folder declares its script. Base requires `check:format`, so a base-only target still fails on a missing one. The shell phase runs only where `package.json` declares `check:shell`, which the `shell` stack adds, and probes for `shfmt` and `shellcheck` first. These two files are base's `[sync] per_root` set, which a `--skip base` subfolder still receives.

## What ships as user-owned seeds

Seeds live in `tooling/base/seeds/`. Sync drops each once on first install and never overwrites it, so a project extends them freely.

- `.lintstagedrc`: the glob map below.
- `.prettierignore`: created empty. Projects add their own entries.
- `.github/workflows/verify.yml`: runs on pull requests targeting `main` and on `workflow_dispatch`. A project with more than one language root adds its own jobs here.
- `.github/pull_request_template.md`: `## Summary`, `## Key changes`, `## Technical context`, `## Testing`. A project adds the checklist lines its own review needs.
- `canon/context/`: extend the `ci` and `development` entries with project-specific commands, workflows, or deploy steps. Canonical rationale stays in this reference.

## Tool pairing

- Runtime: `bun` as package manager and script runner, `bunx` over `npx` for a one-off executable.
- Formatting: Prettier for what it parses. Prettier has no shell parser, so shell formatting is the `shell` stack's.
- Commits: commitlint against conventional commits, wired through the husky `commit-msg` hook. Format is `<type>(<scope>): <subject>` in imperative mood with no trailing period.
- Dev dependencies: `prettier`, `husky`, `@commitlint/cli`, `@commitlint/config-conventional`. Install via `bun add -D`.

## File layout

- Hooks live in `.husky/`, seeded context docs in `canon/context/`.
- The `canon/context/` location matches the three-tier context model: project-wide invariants in `CLAUDE.md` and `canon/REQUIREMENTS.md`, path-scoped rules in `.claude/rules/`, and on-demand domain narrative in `canon/context/`. Indexes stay opt-in.

## Hooks

- `pre-commit` runs `bunx lint-staged`.
- `commit-msg` runs `bunx commitlint --edit "$1"`.
- `pre-push` runs `bun run check`.
- `post-merge` runs `canon hooks post-merge`: archive the task a merged pull request closed, push the records, reclaim merged worktrees, reinstall the CLI, and update the plugin. It does nothing when the board is absent. `CANON_SKIP_RECLAIM`, `CANON_SKIP_UPGRADE`, and `CANON_SKIP_PLUGIN_UPDATE` turn off the three steps that act on the machine. Read `canon docs hooks` for the contract.
- `post-rewrite` delegates to `post-merge` on `rebase`, so a `pull.rebase=true` machine still gets the check.

## lint-staged

Seeded baseline globs:

- `**/*.{json,md,mdc}` runs `prettier --write --ignore-path .gitignore --ignore-path .prettierignore`
- `**/*.md` runs `canon indexes regen`

## CI

- Steps: checkout, setup Bun at latest, `bun install --frozen-lockfile`, then `check:format`.
- CI asserts and never writes. Format must be clean before push.

## Gitignore

- `# System`: `.DS_Store`
- `# Dependencies`: `node_modules/`
- `# Secrets`: `.env`, `.env.*`, `*.local`, `!.env.example`
- `# VSCode`: `.vscode/`

## Anti-patterns

Sticky negative knowledge. Do not relearn.

- Do NOT invoke prettier without both `--ignore-path .gitignore --ignore-path .prettierignore`. Passing one drops the other, since the flag replaces the default rather than adding to it.
- Do NOT omit `--log-level warn` from a prettier invocation. The default prints a line per unchanged file.
- Do NOT put logic in a husky hook and expect its shebang to hold. Husky runs hooks as `sh -e`, so a hook carrying logic is POSIX sh under errexit whatever the first line says.

## CLI

| Script                 | What it does                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check`        | Gates a checkout through `scripts/verify.ts` and writes nothing. Honors `VERIFY_NESTED=true` to suppress timeline boundaries when another script calls it. |
| `bun run check:format` | Asserts prettier formatting without writing                                                                                                                |
| `bun run format`       | Writes prettier formatting in place                                                                                                                        |
| `bun run prepare`      | Initializes husky hooks, run automatically on `bun install`                                                                                                |

Base writes `check` as a `[scripts.override]`, so a sync replaces whatever `check` a target declared, including one that chained further checks after the runner. Re-add a chained check as its own script after a sync.

`bun run check` gates a checkout and writes nothing. Formatting drift fails it at `check:format`, and the failure line names `bun run format`, the one command that writes. It once ran `format` first to auto-fix drift, which rewrote files in a checkout several sessions share on every push and left a gate that could not fail. That was rejected, so the writing pass stays in `bun run format` and a push fails until it runs. The pull request workflow calls `check:format` directly as well.

`scripts/verify.ts`'s `Markdown bans` stage gates on banned characters. It runs `canon markdown audit` over every tracked markdown file except `CHANGELOG.md`, since a generated changelog carries commit subjects nobody wrote against the ban set, and exits `2` on a finding or `3` on a shipped-empty ban set, failing `bun run check` and the `pre-push` hook that calls it. A refusal to measure exits `1` and is logged as a skip rather than a failure, as does a corpus with no file left to check once `CHANGELOG.md` is set aside. The stage needs `canon` on PATH. `canon docs projects` names the install command. Without it, the stage is skipped and logged, and coverage falls back to the format check above.
