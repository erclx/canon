---
title: Overview
description: What the CLI domain owns, the folder layout, and the gotchas that cross every command
---

# Overview

`src/` is the TypeScript CLI entry point. It uses commander to register subcommands and execa to dispatch most of them to the matching `manage-*.sh` script in `scripts/`. Domains migrate off bash one at a time. Use `@/` absolute imports, mapped to `src/` in `tsconfig.json`.

TypeScript owns argument parsing and every migrated domain, and bash owns what has not moved. `canon/context/scripts/index.md` covers the bash side.

## Layout

- **`src/`** root holds the entry point `cli.ts` alone, since `bin`, scripts, workflows, and hooks name it
- **`src/cli/`** holds the terminal and process layer, being `ui.ts` matching `lib/ui.sh`, `help.ts`, the `--help --all` router `help-all.ts`, `run.ts`, and the bash helper `exec.ts`
- **`src/roots/`** groups the four resolvers answering where something lives, `PROJECT_ROOT` among them
- **`src/commands/`** owns one file per `canon` subcommand, each one not yet migrated a thin pass-through to a `manage-*.sh` script
- **`src/design/`** owns the TS-first design domain, documented in `canon/context/design.md`
- **`src/slides/`** and **`src/transcripts/`** are documented in `canon/context/features/slides.md` and `canon/context/features/transcripts.md`
- **`src/indexes/`** owns the index engine, documented in `canon/context/context-model.md`
- **`src/tooling/`** owns the tooling inject and scan engine, documented in `canon/context/tooling/index.md`
- **`src/tooling/seed-marker.ts`** is the seed stub contract `canon/context/tooling/` owns, read by `tooling/`, `claude/`, `sync/`, and `context/`
- **`src/sweep/`** owns the contract every line sweep reads, being which files it skips (`binary.ts`) and which lines it mutes (`exempt-marker.ts`). Six domains share it.
- **`src/feedback/`** owns the `canon feedback` engine, being required sections (`body.ts`), the GitHub issue call (`github.ts`), and argument and failure formatting (`github-format.ts`)
- **`src/sync/`** owns the sync engine, the git workflow, the install stamp, the drift report, and `copy.ts`, the mode-preserving install copy the three adapters read
- **`src/targets/`** owns target projects, with `validate.ts` (`resolveTarget`) validating an install directory and `resolve.ts` reading the registry
- **`src/gate/`** owns the gate stages, including `client-commands.ts`, the client command table the citation stage in `measures.ts` reads
- **`src/init/`** owns the `canon init` option surface, the preview and count, the domain step list, and the partial-failure runner
- **`src/docs/`** and **`src/wiki/`** own the two read-only domains, which reach for no shared engine because neither syncs into a target
- **`src/claude/`** owns seed planning, the gitignore preview, and the user settings merge
- **`src/tasks/`** owns the task-board archive and the two record verbs a skill reaches for when worktree isolation refuses its own write
- **`src/worktrees/`** holds the engine of the one `canon worktrees` verb, apart from `src/git/`
- **`src/capture/`** owns the capture render, one of the four browser modules under `src/`

### Audit engines

Each audit engine sits in its own folder.

- **`src/comments/`** owns the comment census, reasoned about in `canon/context/cli/audits/reports.md`
- **`src/context/`** owns the context-folder audit, reasoned about alongside it
- **`src/markdown/`** owns the attribute-standard audit and the fence walker every markdown reader shares, beside `frontmatter.ts`
- **`src/secrets/`** owns the shipped-tree secret scan, split across rule set, exemption marker, corpus resolver, and walker. See `canon/context/cli/audits/state-scoped.md`.
- **`src/deps/`** owns the dependency advisory read, the only audit engine here that reaches a network
- **`src/labels/`** owns the pull request label map, splitting the TOML read from the matcher. See `canon/context/cli/audits/reports.md`.

### Sessions

The session engine splits by what a stub has to replace.

- **`src/sessions/`** owns the live-session roster, split into the registry read, the liveness decision, and the git join, so the platform-specific half is the only one a stub replaces
- **`src/sessions/claim.ts`** composes that roster with `listWorktrees()` to answer whether either surface already claims a branch
- **`src/sessions/transfer/`** moves a session between machines, with `transcript.ts` locating a transcript and `bundle.ts` packing it with its side folder and a manifest

### The git helpers

`src/git/` holds every module that reads git state, which 20 domains import, each named for what it reads. `env.ts` holds `gitEnv()`, and `gh-invocations.test.ts` beside it guards that strip across `src/`.

- **`src/git/worktree.ts`** owns `mainWorktreeRoot()`, which every shared-scratch verb resolves its root through, and `listWorktrees()`, the branch each worktree holds
- **`currentWorktreeRoot()`** in the same file reads `git rev-parse --show-toplevel`, for a verb over a tracked tree
- **`src/git/files.ts`** owns `listRepositoryFiles()`, the tracked-plus-untracked listing the citation check, markdown corpus, and secret scan take their file set from
- **`resolveBaseRef()` and `listChangedFiles()`** in that file are the branch-range pair the label audit reads
- **`listRenames()` and `listIgnoreAdditions()`** in that file feed `canon pr key-changes`, as covered in `canon/context/cli/audits/reports.md`

### Two roots, two questions

Shared scratch lives at one root every session reads, and a tracked tree is per worktree. A verb reading a tracked tree from the main root reports on files the session never edited, so use `currentWorktreeRoot()` there.

### The changed set diffs the working tree

`listChangedFiles()` diffs the base against the working tree rather than `HEAD`, so a surface added before the branch commits is still in scope.

A ref the caller names resolves through its merge base with `HEAD` rather than literally. `baseCandidates()` in `src/git/base.ts` holds that candidate order once for this resolver and the private one in `src/gov/test-order.ts`, each running its own git call over the list.

### Evidence helpers

`parseIgnoreAdditions()` is the shared parse behind `listIgnoreAdditions()`, since the same shape reaches it from a local `git diff` and from a patch string GitHub returns inline.

### The command surface

The command surface and its flags live in `docs/agents/`, the canonical invocation contract for agents.

## Decisions

### Shell stays a wrapper under 100 lines

Every surface is TypeScript on Bun, and shell stays only as a wrapper under 100 lines, the line the [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html) draws. Domains migrate one verb at a time.

`bin` runs `src/cli.ts` through its shebang, so nothing compiles and no `dist/` can drift from the source. A folder is named for its role, not its language.

### Node with a build step was rejected

It costs a publish pipeline. The trade is that a target needs Bun installed rather than only a package manager, since `Bun.Glob`, `Bun.TOML`, and `Bun.YAML` replace globbing and parser dependencies.

Revisit when a target cannot run Bun, or Node runs shipped TypeScript with no build step.

### The 100-line test replaced per-file arguments

The shell rule that lost kept bash for whatever suited it, so every leftover file argued its own case. Of 131 tracked `.sh` files, 45 sit over the line, and no gate checks it yet, so the migration is measured by that count rather than enforced. Measured at `2022f604` on 2026-10-03.

## Gotchas

### Exit and stream discipline

It moved to `internal/rules/core/cli-output.md`, which globs `src/**/*.ts` so it loads on an edit here. It holds the `process.exitCode` requirement and the stderr-in-every-mode rule.

### Color goes through `palette(stream)`

`palette(stream)` in `src/cli/ui.ts` reads `NO_COLOR` and the stream's `isTTY` at write time and hands back a blank set when either says no.

Ask about the stream being written to rather than the process. `showHelp` in `src/cli.ts` frames on stdout while every other writer frames on stderr, and `process.stdin.isTTY` is a third question about prompting.

### Escape constants live in one file

`src/cli/ui.test.ts` walks the tree and fails the build on an escape constant outside `src/cli/ui.ts`, because sixteen files each spelling their own grey made color impossible to turn off.

### Exit codes need a spawn

Exit-code coverage spawns the CLI from `src/commands/exit-code.test.ts`, because an action imported in process would set the code on the test runner.

### Worktrees carry an empty `node_modules`

A linked worktree resolves packages from an ancestor, so a fixture symlinking `node_modules` walks up for the populated one rather than naming the repository root.

### Bun resolution falls back to the global cache

`Bun.resolveSync` and `createRequire(...).resolve` fall back to Bun's global install cache when no ancestor of the starting directory holds a `node_modules`, so a presence check reads a pass there. The bundler takes no such fallback.

A check predicting what the bundler finds starts from a directory under a `node_modules`, which the CLI's own package root always is. `missingClientDeps` in `src/commands/canvas.ts` resolves from `PROJECT_ROOT` for that reason, and its test seeds an empty `node_modules`.

### The `feedback` TTY guard

The guard on `process.stdin.isTTY` is the one error path a pipe cannot reach. `script -qec` allocates a pty and forwards the child status, both util-linux spellings, so that case skips off Linux.

### `Bun.Glob` has no exclude option

A walker that must skip vendored trees filters scanned paths by segment. Forgetting to leaves the skip silently absent wherever `git check-ignore` is unavailable.

### Bun's `$` parses a bare `(`

A git format string written inline as `--format=%(refname)` throws `Unexpected token` when the command runs, not when the file is type checked. Pass such an argument through an interpolated array, which Bun escapes whole. `branchRefs` in `src/git/worktree.ts` is the shape to copy.

### Repository calls strip the environment

A hook exports `GIT_DIR` into each process it runs and it beats `-C`, so every git or `gh` call resolving a repository goes through `gitEnv()`.

- The Bun spelling is `.env(gitEnv())` and the `execa` one is `{ env: gitEnv(), extendEnv: false }`
- `git --version` needs neither, resolving no repository at all
- `src/git/gh-invocations.test.ts` fails the build on an `execa('gh', ...)` call in `src/` missing the strip

### `gh pr view --json files` caps silently

It caps its list at 100 rows with nothing on the record saying so, measured against `#1250`, which carries 101 files and views as 100.

`readFromApi` in `src/commands/pr.ts` always reads `gh api --paginate repos/{owner}/{repo}/pulls/<n>/files` and refuses as `gh-failed` when any page fails. The cap is the tool's rather than the caller's, unlike `gh pr list --limit`, where the caller chose the bound and can see it.

### Stripping covers half of resolution

A call naming an explicit `--git-dir` and `--work-tree` still derives its pathspec prefix from the current directory. A bare name means the work-tree root only while the caller stands outside that tree, and `-C <work-tree>` on the same invocation settles it.

`records` in `src/records/backup.ts` is the one call site, since every worker session runs from `.claude/worktrees/<name>/`, which sits inside the records work tree.

### `PROJECT_ROOT` derives from `import.meta.url`

Bun's `import.meta.dir` is undefined under the test runner and made the module holding it throw on import. Both spellings resolve the same directory under Bun, so the derivation is the whole change, and it puts a module reading the package root within reach of a test.

### The constant sits in `src/roots/project.ts`

A path constant and a process spawn share no reason to change. Importing it from `exec.ts` loaded `execa` to read one string, and the eleven modules wanting the root and no subprocess paid for it.

### Engines take the root as a parameter

Wherever the caller's root decides the answer, an engine module takes the toolkit root as a parameter, which keeps root resolution in the command layer.

`src/tooling/read.ts` holds both, a project root it is handed and the package root it imports as the search behind it, the only root a target has. Tests build fixtures with `mkdtempSync(join(tmpdir(), 'canon-<domain>-'))`, which for that module is the only place the two roots are separable.

### Foreign trees and root reads

Reading and writing a tree another tool owns, which root a catalog command reads, and the checkout-mismatch warning are in `canon/context/cli/roots.md`.
