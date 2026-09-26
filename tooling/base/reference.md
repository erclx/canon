# Tooling base reference

## Overview

The base layer covers every project the toolkit scaffolds, whatever language sits on top. It ships formatting, spelling, shell linting, conventional commits, git hooks, CI, and one maintenance script. Every other stack extends it, so a decision made here is one every stack inherits.

A repository with several language roots layers this stack once at the root and skips it per subtree, since git honors only one `core.hooksPath` and a re-dropped husky silently breaks. `canon docs target-projects` carries the recipe.

## What ships as golden configs

Golden config files live in `tooling/base/configs/` and are copied into the target on `canon tooling sync base . --write`, replacing whatever sits at those paths. They are the source of truth. The reference covers rationale and tradeoffs. Configs show the concrete setup.

- `.prettierrc`: `semi: false`, `singleQuote: true`, plus a parser override per non-standard extension (`.mdx` to `markdown`).
- `.shellcheckrc`: `external-sources=true`. Required for shellcheck to follow `source` directives.
- `.editorconfig`: `root = true`, with an `[*.sh]` block setting `indent_style = space` and `indent_size = 2`.
- `commitlint.config.js`: ESM default export extending `@commitlint/config-conventional`. Rules are `header-max-length: 72`, `scope-case: lower-case`, `subject-full-stop: never`, `subject-case` disabled, and a local `no-claude-co-author` rule refusing a `Co-authored-by` trailer that names Claude or Anthropic.
- `.husky/`: `pre-commit`, `commit-msg`, `pre-push`, `post-merge`, `post-rewrite`.
- `.vscode/extensions.json` and `.vscode/settings.json`: editor wiring for Prettier, cspell, shfmt, and shellcheck.
- `scripts/verify.sh`: the maintenance entry point behind `check`.

## What ships as user-owned seeds

Seeds live in `tooling/base/seeds/`. Sync drops each once on first install and never overwrites it, so a project extends them freely.

- `cspell.json`: `version: "0.2"`, `language: "en"`, `useGitignore: true`, `gitignoreRoot: ["."]`, dictionary definitions for `project-terms` and `tech-stack` with `addWords: true` on both, and `ignorePaths: [".cspell/**", ".git/**"]` to skip dictionary self-checks and git object files.
- `.cspell/project-terms.txt` and `.cspell/tech-stack.txt`: one word per line, sorted alphabetically.
- `.lintstagedrc`: the glob map below.
- `.prettierignore`: created empty. Projects add their own entries.
- `.github/workflows/verify.yml`: runs on pull requests targeting `main` and on `workflow_dispatch`. A project with more than one language root adds its own jobs here.
- `.github/pull_request_template.md`: `## Summary`, `## Key Changes`, `## Technical Context`, `## Testing`. A project adds the checklist lines its own review needs.
- `canon/context/`: extend the `ci` and `development` entries with project-specific commands, workflows, or deploy steps. Canonical rationale stays in this reference.

## Tool pairing

- Runtime: `bun` as package manager and script runner, `bunx` over `npx` for a one-off executable.
- Formatting: Prettier for what it parses, shfmt for shell. Two formatters because Prettier has no shell parser.
- Spelling: cspell over the whole tree, with project vocabulary split into a project-terms dictionary and a tech-stack one.
- Shell: shfmt formats and shellcheck lints at warning severity. Both take their files from `find scripts -name '*.sh'`, since `scripts/` can mix shell with TypeScript and shellcheck has no directory mode. A shell script with a shebang and no `.sh` extension is covered by neither, so give it the extension.
- Commits: commitlint against conventional commits, wired through the husky `commit-msg` hook. Format is `<type>(<scope>): <subject>` in imperative mood with no trailing period.
- Dev dependencies: `prettier`, `cspell`, `husky`, `@commitlint/cli`, `@commitlint/config-conventional`. Install via `bun add -D`.

## File layout

- All shell scripts live in `scripts/`. Do not place a `.sh` file outside it.
- Dictionaries live in `.cspell/`, hooks in `.husky/`, seeded context docs in `canon/context/`.
- The `canon/context/` location matches the three-tier context model: project-wide invariants in `CLAUDE.md`, `canon/REQUIREMENTS.md`, and `canon/ARCHITECTURE.md`, path-scoped rules in `.claude/rules/`, and on-demand domain narrative in `canon/context/`. Indexes stay opt-in.

## Hooks

- `pre-commit` runs `bunx lint-staged`.
- `commit-msg` runs `bunx commitlint --edit "$1"`.
- `pre-push` runs `bun run check`.
- `post-merge` names `.canon/tasks/` archive candidates, staying silent otherwise and when the board is absent.
- `post-rewrite` delegates to `post-merge` on `rebase`, so a `pull.rebase=true` machine still gets the check.

## lint-staged

Seeded baseline globs:

- `**/*.{json,md,mdc}` runs `prettier --write --ignore-path .gitignore --ignore-path .prettierignore` then `cspell --no-must-find-files`
- `**/*.md` runs `canon indexes regen`
- `**/*.sh` runs `shfmt --write --indent 2` then `shellcheck --severity=warning`

## CI

- Steps: checkout, setup Bun at latest, `bun install --frozen-lockfile`, install `shfmt` and `shellcheck` via apt, then `check:format`, `check:spell`, and `check:shell`.
- CI asserts and never writes. Format must be clean before push.

## Gitignore

- `# System`: `.DS_Store`
- `# Dependencies`: `node_modules/`
- `# Secrets`: `.env`, `.env.*`, `*.local`, `!.env.example`

## Anti-patterns

Sticky negative knowledge. Do not relearn.

- Do NOT drop `gitignoreRoot: ["."]` from `cspell.json`. Without it, cspell run from inside a linked worktree under `.claude/worktrees/` walks up into the parent repo's `.gitignore`, resolves every worktree file as living under the ignored worktree path, and checks zero files. New words then pass locally and fail in CI.
- Do NOT rely on the default `**` glob for spelling. It skips dot-prefixed folders, leaving `.claude/`, `.github/`, and `.husky/` unchecked. Pass `'**' '.*/**' '.*'` explicitly.
- Do NOT invoke prettier without both `--ignore-path .gitignore --ignore-path .prettierignore`. Passing one drops the other, since the flag replaces the default rather than adding to it.
- Do NOT omit `--log-level warn` from a prettier invocation. The default prints a line per unchanged file.
- Do NOT put logic in a husky hook and expect its shebang to hold. Husky runs hooks as `sh -e`, so a hook carrying logic is POSIX sh under errexit whatever the first line says.
- Do NOT drop the `[*.sh]` block from `.editorconfig` because shfmt already sets indentation. The editor and shfmt then disagree and produce spurious git diffs.
- Do NOT copy lint-staged's `**/*.sh` glob into a package.json script. lint-staged expands its own globs and passes matched files as arguments, which a bare shell script does not.

## CLI

| Script                 | What it does                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check`        | Repairs a checkout via `scripts/verify.sh`. Honors `VERIFY_NESTED=true` to suppress timeline boundaries when another script calls it. |
| `bun run check:format` | Asserts prettier and shfmt formatting without writing                                                                                 |
| `bun run check:spell`  | Runs cspell across every file, with context on failures                                                                               |
| `bun run check:shell`  | Runs shellcheck at warning severity                                                                                                   |
| `bun run format`       | Writes prettier and shfmt formatting in place                                                                                         |
| `bun run prepare`      | Initializes husky hooks, run automatically on `bun install`                                                                           |

`bun run check` repairs a checkout rather than gating one. It runs `format` first to auto-fix drifted code, then asserts only what the formatters could not fix. The pull request workflow calls `check:format`, `check:spell`, and `check:shell` directly, and those three are the gate.

`scripts/verify.sh`'s `Markdown bans` stage is the exception: it gates rather than repairs. It runs `canon markdown audit` over every tracked markdown file except `CHANGELOG.md`, since a generated changelog carries commit subjects nobody wrote against the ban set, and exits `2` on a finding or `3` on a shipped-empty ban set, failing `bun run check` and the `pre-push` hook that calls it. A refusal to measure exits `1` and is logged as a skip rather than a failure, as does a corpus with no file left to check once `CHANGELOG.md` is set aside. The stage needs `canon` on PATH. `canon docs target-projects` names the install command. Without it, the stage is skipped and logged, and coverage falls back to the three checks above.
