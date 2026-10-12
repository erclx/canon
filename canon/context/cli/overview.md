---
title: Overview
description: What the CLI domain owns, the folder layout, and the gotchas that cross every command
---

# Overview

`src/` is the TypeScript CLI entry point. It uses commander to register subcommands and execa to dispatch most of them to the corresponding `manage-*.sh` script in `scripts/`. Domains are being migrated off bash one at a time. Use `@/` absolute imports, mapped to `src/` in `tsconfig.json`.

The layer boundary: TypeScript owns argument parsing plus every migrated domain, and bash owns what has not moved yet. See `canon/context/scripts/index.md` for the bash side.

## Layout

- **`src/`** root holds the entry point (`cli.ts`) alone, since `bin`, scripts, workflows, and hooks name it. `src/cli/` holds the terminal and process layer: `ui.ts` matching `lib/ui.sh`, `help.ts` and the `--help --all` router `help-all.ts`, `run.ts`, and the bash helper `exec.ts`
- **`src/roots/`** groups the four resolvers answering where something lives, `PROJECT_ROOT` among them
- **`src/commands/`** owns one file per `canon` subcommand, each one not yet migrated a thin pass-through to a `manage-*.sh` script
- **`src/design/`**, `src/slides/`, `src/transcripts/` own the domains built TS-first, documented as feature entries in `canon/context/design/index.md`, `canon/context/features/slides.md`, and `canon/context/features/transcripts.md`
- **`src/indexes/`** owns the index engine, documented in `canon/context/context-model/indexes.md`
- **`src/tooling/`** owns the tooling inject and scan engine, documented in `canon/context/tooling/index.md`, and `seed-marker.ts`, the seed stub contract that `canon/context/tooling/` owns and that `tooling/`, `claude/`, `sync/`, and `context/` read
- **`src/sweep/`** owns the contract every line sweep reads, which files it skips (`binary.ts`) and which lines it mutes (`exempt-marker.ts`). Six domains share it, so the folder is named for the contract rather than for a `utils` bucket
- **`src/feedback/`** owns the `canon feedback` engine, being the body's required sections (`body.ts`), the GitHub issue call (`github.ts`), and its argument and failure formatting (`github-format.ts`). `src/commands/feedback.ts` is its only consumer
- **`src/sync/`** owns the sync engine, the `canon sync` git workflow, the install stamp, the drift report, and `copy.ts`, the mode-preserving install copy that the governance, tooling, and claude adapters read, with governance's per-domain adapter in `src/gov/`
- **`src/targets/`** owns target projects, including `validate.ts`, whose `resolveTarget` validates the directory an install verb is pointed at, and `resolve.ts`, the registry read
- **`src/gate/`** owns the gate stages, including `client-commands.ts`, the client command table the citation stage in `measures.ts` reads
- **`src/init/`** owns the `canon init` option surface, the preview and count, the domain step list, and the partial-failure runner
- **`src/docs/`** and `src/wiki/` own the two read-only domains, which reach for no shared engine because neither syncs into a target
- **`src/claude/`** owns seed planning, the gitignore preview, and the user settings merge
- **`src/tasks/`** owns the task-board archive, the one domain whose primary caller is a git hook rather than a person, and the two record verbs a skill reaches for when worktree isolation refuses its own write, plus `paths.ts`, whose `isUnder` only the answers and archive verbs read
- **`src/git/`** holds every module that reads git state, which 20 domains import, named for what each reads. It sits apart from `src/worktrees/`, the engine of the one `canon worktrees` verb. `env.ts` holds `gitEnv()`, and `gh-invocations.test.ts` beside it guards that strip across `src/`. `src/git/worktree.ts` owns `mainWorktreeRoot()`, which every shared-scratch verb resolves its root through, and `listWorktrees()`, the branch each worktree holds
- **`src/git/worktree.ts`** also owns `currentWorktreeRoot()`, the same read against `git rev-parse --show-toplevel`, for a verb over a tracked tree. The two answer different questions: shared scratch lives at one root every session reads, and a tracked tree is per worktree, so a verb reading one from the main root reports on files the session never edited
- **`src/sessions/`** owns the live-session roster, splitting the registry read, the liveness decision, and the git join across three modules so the platform-specific half is the only one a stub has to replace, plus `claim.ts`, which composes that roster with `listWorktrees()` to answer whether either surface already claims a branch. `src/sessions/transfer/` holds the second role, moving a session between machines: `transcript.ts` locates a transcript under the projects folder and `bundle.ts` packs it with its side folder and a manifest
- **`src/comments/`** owns the comment census, reasoned about in `canon/context/cli/audits/reports.md`
- **`src/context/`** owns the context-folder audit, reasoned about alongside it
- **`src/markdown/`** owns the attribute-standard audit, reasoned about alongside both, and the fence walker every other markdown reader now shares, beside `frontmatter.ts`, the stripper `docs`, `teach`, `gov`, and `standards` read
- **`src/secrets/`** owns the shipped-tree secret scan, splitting the rule set, the exemption marker, the corpus resolver, and the walker across four modules so the keying and the exclusion mechanism move independently. Reasoned about in `canon/context/cli/audits/state-scoped.md`
- **`src/deps/`** owns the dependency advisory read, the only audit engine here that reaches a network
- **`src/labels/`** owns the pull request label map, splitting the TOML read from the matcher so a caller holding a changed set can resolve coverage without touching git. Reasoned about in `canon/context/cli/audits/reports.md`
- **`src/git/files.ts`** owns `listRepositoryFiles()`, the tracked-plus-untracked listing the citation check, the markdown corpus, and the secret scan all take their file set from
- **`src/git/files.ts`** also owns `resolveBaseRef()` and `listChangedFiles()`, the branch-range pair the label audit reads. The changed set diffs the base against the working tree rather than against `HEAD`, so a surface added before the branch commits is still in scope. A ref the caller names resolves through its merge base with `HEAD` rather than being taken literally, and `src/git/base.ts`'s `baseCandidates()` holds that candidate order once for this resolver and the private one in `src/gov/test-order.ts` alike, each still running its own git call over the list
- **`src/git/files.ts`** also owns `listRenames()` and `listIgnoreAdditions()`, the evidence `canon pr key-changes` credits a claim against past its own changed-file list: a git-detected rename's old path, and a pattern newly added to `.gitignore`. `parseIgnoreAdditions()` is the shared parse behind the second, since the same shape reaches it from a local `git diff` and from a patch string GitHub returns inline. Reasoned about in `canon/context/cli/audits/reports.md`
- **`src/capture/`** owns the capture render, one of the four browser modules under `src/`

### CLI

The command surface and its flags live in `docs/agents/`. That folder is the canonical invocation contract for agents.

## Decisions

### TypeScript on Bun, with shell only as a small wrapper

Every surface is TypeScript on Bun, and shell stays only as a wrapper under 100 lines, the line the [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html) draws, and domains migrate one verb at a time. `bin` runs `src/cli.ts` directly through its shebang, so nothing compiles and no `dist/` can drift from the source. A folder is named for its role, not its language.

Node with a build step was the alternative and costs a publish pipeline. The trade is that a target needs Bun installed rather than only a package manager, since `Bun.Glob`, `Bun.TOML`, and `Bun.YAML` replace globbing and parser dependencies. The shell rule that lost kept bash for whatever suited it, so every leftover file argued its own case, and the 100-line line replaced that with one test. Of 131 tracked `.sh` files, 45 sit over the line, and no gate checks it yet, so the migration is measured by that count rather than enforced. Measured at `2022f604` on 2026-10-03. Revisit when a target cannot run Bun, or Node runs shipped TypeScript with no build step.

## Gotchas

### Wiring and output

- Exit and stream discipline moved to `internal/rules/core/cli-output.md`, which globs `src/**/*.ts` so it loads on an edit here rather than waiting to be found. It holds the `process.exitCode` requirement and the stderr-in-every-mode rule.
- Color goes through `palette(stream)` in `src/cli/ui.ts`, which reads `NO_COLOR` and the stream's `isTTY` at write time and hands back a blank set when either says no. Ask about the stream being written to rather than about the process, since `showHelp` in `src/cli.ts` frames on stdout while every other writer frames on stderr, and `process.stdin.isTTY` is a third question about prompting.
- No file outside `src/cli/ui.ts` defines an escape constant. `src/cli/ui.test.ts` walks the tree and fails the build on one, because sixteen files each spelling their own grey is what made color impossible to turn off in the first place.
- Exit-code coverage spawns the CLI from `src/commands/exit-code.test.ts`, because an action imported in process would set the code on the test runner.
- A linked worktree carries an empty `node_modules` and resolves packages from an ancestor, so a fixture symlinking `node_modules` walks up for the populated one rather than naming the repository root.

#### Bun runtime traps

- `Bun.resolveSync` and `createRequire(...).resolve` fall back to Bun's global install cache when no ancestor of the starting directory holds a `node_modules`, so a presence check reads a pass there. The bundler takes no such fallback, so a check predicting what the bundler finds starts from a directory under a `node_modules`, which the CLI's own package root always is. `missingClientDeps` in `src/commands/canvas.ts` resolves from `PROJECT_ROOT` for that reason, and its test seeds an empty `node_modules`.
- The `feedback` guard on `process.stdin.isTTY` is the one error path a pipe cannot reach. `script -qec` allocates a pty and forwards the child status, both util-linux spellings, so that case skips off Linux.
- `Bun.Glob` has no exclude option. A walker that must skip vendored trees filters scanned paths by segment, and forgetting to leaves the skip silently absent wherever `git check-ignore` is unavailable.
- Bun's `$` parses a bare `(` inside a template literal as shell syntax, so a git format string written inline as `--format=%(refname)` throws `Unexpected token` when the command runs rather than when the file is type checked. Pass such an argument through an interpolated array, which Bun escapes whole. `branchRefs` in `src/git/worktree.ts` is the shape to copy.
- Every git or `gh` call resolving a repository strips the environment through `gitEnv()`, since a hook exports `GIT_DIR` into each process it runs and it beats `-C`. The Bun spelling is `.env(gitEnv())` and the `execa` one is `{ env: gitEnv(), extendEnv: false }`. `git --version` is the one call that needs neither, resolving no repository at all. `src/git/gh-invocations.test.ts` walks `src/` for an `execa('gh', ...)` call missing the strip and fails the build on one.

#### Roots and repository calls

- `gh pr view --json files` caps its list at 100 rows and puts nothing on the record saying it did, measured against `#1250`, which carries 101 files and views as 100. A verb reading a changed set that way gets a set silently short, so `readFromApi` in `src/commands/pr.ts` always reads `gh api --paginate repos/{owner}/{repo}/pulls/<n>/files` and refuses as `gh-failed` when any page fails. The cap is the tool's rather than the caller's, which separates it from `gh pr list --limit`, where the bound is one the caller chose and can see.
- Stripping the environment covers one half of repository resolution and not the other. A call naming an explicit `--git-dir` and `--work-tree` still derives its pathspec prefix from the current directory, so a bare name means the work-tree root only while the caller stands outside that tree, and `-C <work-tree>` on the same invocation is what settles it. `records` in `src/records/backup.ts` is the one call site, since every worker session runs from `.claude/worktrees/<name>/`, which sits inside the records work tree.
- `PROJECT_ROOT` derives from `import.meta.url` rather than Bun's `import.meta.dir`, which the test runner leaves undefined and which made the module holding it throw on import there. Both spellings resolve the same directory under Bun, so the derivation is the whole of the change and it is what puts a module reading the package root within reach of a test.
- The constant sits in `src/roots/project.ts` rather than beside `execScript`, since a path constant and a process spawn share no reason to change. Importing it from `exec.ts` loaded `execa` to read one string, a whole module imported for one constant, and the eleven modules wanting the root and no subprocess were paying it.
- An engine module still takes the toolkit root as a parameter wherever the caller's root decides the answer, which keeps root resolution in the command layer. `src/tooling/read.ts` is the one module holding both: a project root it is handed, and the package root it imports as the search behind it, which is the only root a target has. Tests build fixtures with `mkdtempSync(join(tmpdir(), 'canon-<domain>-'))`, which for that module is also the only place the package root is separable from the authoring root.

Reading and writing a tree another tool owns, which root a catalog command reads, and the checkout-mismatch warning are in `canon/context/cli/roots.md`.
