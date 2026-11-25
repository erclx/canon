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

- It runs typecheck, lint, format check, shell, unit tests, build, canon checks, card exclusion, then head tags, skipping a phase `scripts/verify.json` leaves out.
- `scripts/verify.json` lists the phases a stack requires, plus any tools and preconditions it probes first. The nearest stack's copy wins.
- A required phase whose script `package.json` lacks fails the run. A base phase the list leaves out runs only where the folder declares its script.
- Base requires `check:format`, so a base-only target still fails on a missing one.
- The shell phase runs only where `package.json` declares `check:shell`, which the `shell` stack adds, and probes for `shfmt` and `shellcheck` first.

These two files are base's `[sync] per_root` set, which a `--skip base` subfolder still receives.

The root run calls each nested runner after its own stages, so one `bun run check` at the root covers every subfolder.

- It finds a nested root from a tracked `scripts/verify.json` below the root, read through `git ls-files`. An untracked folder never runs, and a tracked one runs whatever `.gitignore` says.
- It runs that folder's `scripts/verify.ts` from inside it with `VERIFY_NESTED=true`, and a nested failure fails the root run and names the folder.
- A nested run discovers nothing, and a folder outside a git repository finds no nested root.
- Discovery reads files rather than a list, since `verify.json` is golden and a list kept in it is lost on sync.

### Changed mode

`bun run check:changed` is the gate a push runs. A web project at the repository root runs a scoped push, since the `web` stack installs the CI there that runs the rest. Everywhere else a push runs all of `check`, the full suite and the build included.

- A scoped push runs typecheck, lint, format, shell, and the canon checks over the whole tree, then the tied tests. It leaves the full suite, the build, and the two checks reading the build to CI.
- The runner reads a web project as one whose phase list requires `build` and whose `package.json` declares `test:changed`. A root over a nested project scopes itself alone.
- That CI starts on a pull request into `main`, so a push runs every phase where `main` is checked out, and where the trunk is any other branch.
- The trunk is `origin/HEAD`, then `origin/main`, then `origin/master`. A scoped push refuses with a hint when none resolves, and a push that is not scoped runs every phase without one.
- A first push runs every phase, since `origin` holds no branch to compare with and no fetch can bring one.

A changed run reads each nested root against the change too.

- With a trunk base, it skips a nested root with no changed, added, or deleted path under it and prints its folder, and runs a touched one whole.
- A root change a nested root imports waits for a full `check`, which is the cost of the skip.
- It stops a touched root with its own lockfile and no `node_modules`, naming the folder and `bun install`. A workspace member has no lockfile, so it never stops.

A test ties to the change by name, and no import is followed.

- It ties a test that changed, and one in a changed file's folder under its stem with `.test.`, `.spec.`, or `_test`.
- Past 40 tied files it runs none, since a change that wide is a sweep CI runs whole.

### The remembered pass

A changed run that passes is remembered, so the ship skills and the hook gate one tree once. A repeat at the same content prints one skip line, and `--force` runs it again.

- The pass sits in the worktree's own git directory, so a pass in one worktree never skips another.
- Its key holds the content git would track, the untracked paths, the merge base, the folder, whether the run was scoped, and whether `CI` is set.
- It also holds the version of `canon`, `bun`, `node`, and each tool the phases probe.
- A run keeps no pass when it fails, when a check measured nothing, when a tool reports no version, when the content moved while it ran, or when the tree holds another repository.
- Ignored files stay out of the key, so run with `--force` after installing packages under an unchanged lockfile.

## What ships as user-owned seeds

Seeds live in `tooling/base/seeds/`. Sync drops each once on first install and never overwrites it, so a project extends them freely.

- `.lintstagedrc` holds the glob map below.
- `.github/workflows/verify.yml` runs on pull requests targeting `main` and on `workflow_dispatch`.
- `.github/pull_request_template.md` has `## Summary`, `## Key changes`, `## Technical context`, `## Outcome`, and `## Testing`, the optional two commented. A project adds its own checklist lines.
- `canon/context/development/` holds the `setup` and `ci` entries under a folder index. Extend them with project-specific commands and workflows, and keep canonical rationale here.
- `canon/config/` holds the label map, covering what the toolkit installs, and commented `app.toml` and `context.toml` starters that read as no file until a key is uncommented.

## Tool pairing

- Runtime is `bun` as package manager and script runner, with `bunx` over `npx` for a one-off executable.
- Formatting is oxfmt for what it parses, pinned to an exact version so an upgrade arrives as a reviewed diff. Shell formatting is the `shell` stack's, since oxfmt has no shell parser.
- Commits go through commitlint against conventional commits, wired through the husky `commit-msg` hook. The format is `<type>(<scope>): <subject>` in imperative mood with no trailing period.
- Dev dependencies are `oxfmt`, `husky`, `@commitlint/cli`, and `@commitlint/config-conventional`, installed via `bun add -D`.

## oxfmt

- Add a project's own ignores to `.prettierignore`, which oxfmt reads beside `.gitignore` by default. Sync overwrites `.oxfmtrc.json`, so an entry in its `ignorePatterns` is lost on the next sync.
- After the first sync onto oxfmt, delete a leftover `.prettierrc` and run `bun remove prettier`. Sync deletes nothing a stack stopped shipping.

## Gitattributes

A stack manifest may carry a `[gitattributes]` section, shaped like `[gitignore]`, with a comment header keying an array of lines.

- Sync appends each missing line to `.gitattributes` under its header, creating the file when absent
- Sync never removes or reorders a line a project wrote
- Sync prunes nothing, so a line a stack stops shipping stays until the project deletes it

## File layout

Hooks live in `.husky/` and seeded context docs in `canon/context/`. That location matches the three-tier context model.

- Project-wide invariants sit in `CLAUDE.md` and `canon/REQUIREMENTS.md`.
- Path-scoped rules sit in `.claude/rules/`.
- On-demand domain narrative sits in `canon/context/`, with indexes opt-in.

## Hooks

- `pre-commit` runs `bunx lint-staged`.
- `commit-msg` runs `bunx commitlint --edit "$1"`.
- `pre-push` runs `bun run check:changed`.
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
- The web stack ships a golden `verify.yml`, which sync rewrites. Put a project's own jobs, such as a nested root's toolchain setup, in a separate workflow file no stack ships.

## Anti-patterns

Negative knowledge that costs a failed run to relearn.

- Do NOT pass `--ignore-path` to oxfmt. It replaces the default `.gitignore` and `.prettierignore` pair rather than adding to it.
- Do NOT put logic in a husky hook and expect its shebang to hold. Husky runs hooks as `sh -e`, so a hook carrying logic is POSIX sh under errexit whatever the first line says.

## CLI

| Script                  | What it does                                                  |
| ----------------------- | ------------------------------------------------------------- |
| `bun run check`         | Gates a checkout through `scripts/verify.ts`, writing nothing |
| `bun run check:changed` | Gates a push, scoped in a web project at the repository root  |
| `bun run check:format`  | Asserts oxfmt formatting without writing                      |
| `bun run format`        | Writes oxfmt formatting in place                              |
| `bun run prepare`       | Initializes husky hooks, run automatically on `bun install`   |

### The check script

Base writes `check` as a `[scripts.override]`, so a sync replaces whatever `check` a target declared, including one that chained further checks after the runner. A nested root needs no chained call, since the runner runs it. Re-add any other chained check as its own script after a sync.

- `bun run check` writes nothing. Formatting drift fails it at `check:format`, and the failure line names `bun run format`, the one command that writes.
- `VERIFY_NESTED=true` suppresses timeline boundaries when `check` runs inside another call
- Auto-fixing drift inside `check` rewrote files in a shared checkout on every push and left a gate that could not fail, so the writing pass stays in `bun run format`.
- The pull request workflow calls `check:format` directly as well.

### The canon checks stage

The `Canon checks` stage of `scripts/verify.ts` makes one call, `canon gate run --nested --json`, from the working directory. The gate checks the project it runs in, so a nested project is checked as itself, and a check canon adds to its shared set reaches the project with no edit to this script.

The shared set covers markdown bans and dead links, embedded programs, file length, the document ceiling, the canonical records, the design record's prose budget, the comment caps, and the context audit.

- A failed stage fails `bun run check`, `bun run check:changed`, and the `pre-push` hook. Run `canon gate run` to read each finding.
- The markdown stage leaves `CHANGELOG.md` out, since a generated changelog carries commit subjects nobody wrote against the ban set.
- The context stage skips a project with no context folder, and adds `--gate` where `canon/config/context.toml` declares `gated` or sets `gate-length = true`.
- Output with no gate record, or a record naming another root, means an older canon or a failed fetch. A local run logs a skip, and CI fails the stage.
- Without `canon` on PATH a local run skips the stage with an install hint, and `canon docs projects` names the install command.

An embedded block that must stay inline takes a `canon-allow-embedded: <reason>` marker on its opening line or the line above.
