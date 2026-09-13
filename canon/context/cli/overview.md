---
title: Overview
description: What the CLI domain owns, the folder layout, and the gotchas that cross every command
---

# Overview

`src/` is the TypeScript CLI entry point. It uses commander to register subcommands and execa to dispatch most of them to the corresponding `manage-*.sh` script in `scripts/`. Domains are being migrated off bash one at a time. Use `@/` absolute imports, mapped to `src/` in `tsconfig.json`.

The layer boundary: TypeScript owns argument parsing plus every migrated domain, and bash owns what has not moved yet. See `canon/context/scripts/index.md` for the bash side.

## Layout

- `src/` owns the entry point (`cli.ts`), the package root every other module resolves against (`project-root.ts`), the exec helper that spawns bash (`exec.ts`), the shared terminal UI matching `lib/ui.sh` style (`ui.ts`), and the cross-domain file and GitHub helpers
- `src/commands/` owns one file per `canon` subcommand, each one not yet migrated a thin pass-through to a `manage-*.sh` script
- `src/design/`, `src/slides/`, `src/transcripts/` own the domains built TS-first, documented as feature entries in `canon/context/design.md`, `canon/context/slides.md`, and `canon/context/transcripts.md`
- `src/indexes/` owns the index engine, documented in `canon/context/indexes.md`
- `src/tooling/` owns the tooling inject and scan engine, documented in `canon/context/tooling.md`
- `src/sync/` owns the sync engine, the `canon sync` git workflow, the install stamp, and the drift report, with governance's per-domain adapter in `src/gov/`. Neither `src/standards/` nor `src/snippets/` carries one, since nothing installs either corpus into a project and there is no copy to reconcile
- `src/init/` owns the `canon init` option surface, the preview and count, the domain step list, and the partial-failure runner
- `src/docs/` and `src/wiki/` own the two read-only domains, which reach for no shared engine because neither syncs into a target
- `src/claude/` owns seed planning, the gitignore preview, and the user settings merge
- `src/tasks/` owns the task-board archive, the one domain whose primary caller is a git hook rather than a person, and the two record verbs a skill reaches for when worktree isolation refuses its own write
- `src/worktree.ts` owns `mainWorktreeRoot()`, which every shared-scratch verb resolves its root through. It sat duplicated in the tasks and records command files until a third caller was due
- `src/worktree.ts` also owns `currentWorktreeRoot()`, the same read against `git rev-parse --show-toplevel`, for a verb over a tracked tree. The two answer different questions: shared scratch lives at one root every session reads, and a tracked tree is per worktree, so a verb reading one from the main root reports on files the session never edited
- `src/worktree.ts` also owns `listWorktrees()`, the branch each worktree in the repository holds, parsed off `git worktree list --porcelain`
- `src/sessions/` owns the live-session roster, splitting the registry read, the liveness decision, and the git join across three modules so the platform-specific half is the only one a stub has to replace, plus `claim.ts`, which composes that roster with `listWorktrees()` so a caller can ask whether a branch is already claimed by either surface without re-deriving the join itself
- `src/comments/` owns the comment census, reasoned about in `canon/context/cli/audits.md`
- `src/context/` owns the context-folder audit, reasoned about alongside it
- `src/markdown/` owns the attribute-standard audit, reasoned about alongside both, and the fence walker every other markdown reader now shares
- `src/secrets/` owns the shipped-tree secret scan, splitting the rule set, the exemption marker, the corpus resolver, and the walker across four modules so the keying and the exclusion mechanism move independently. Reasoned about in `canon/context/cli/audits.md`
- `src/deps/` owns the dependency advisory read, which shells the runtime's own command rather than carrying an index and is the only audit engine here that reaches a network
- `src/labels/` owns the pull request label map, splitting the TOML read from the matcher so a caller holding a changed set can resolve coverage without touching git. Reasoned about in `canon/context/cli/audits.md`
- `src/git-files.ts` owns `listRepositoryFiles()`, the tracked-plus-untracked listing the citation check, the markdown corpus, and the secret scan all take their file set from
- `src/git-files.ts` also owns `resolveBaseRef()` and `listChangedFiles()`, the branch-range pair the label audit reads. The changed set diffs the base against the working tree rather than against `HEAD`, so a surface added before the branch commits is still in scope. A ref the caller names resolves through its merge base with `HEAD` rather than being taken literally, and `src/git-base.ts`'s `baseCandidates()` holds that candidate order once for this resolver and the private one in `src/gov/test-order.ts` alike, each still running its own git call over the list
- `src/git-files.ts` also owns `listRenames()` and `listIgnoreAdditions()`, the evidence `canon pr key-changes` credits a claim against past its own changed-file list: a git-detected rename's old path, and a pattern newly added to `.gitignore`. `parseIgnoreAdditions()` is the shared parse behind the second, since the same shape reaches it from a local `git diff` and from a patch string GitHub returns inline. Reasoned about in `canon/context/cli/audits.md`
- `src/capture/` owns the capture render, one of the four browser modules under `src/` and the last of them to start shipping

## Gotchas

### Wiring and output

- Exit and stream discipline moved to `internal/rules/core/095-cli-output.md`, which globs `src/**/*.ts` so it loads on an edit here rather than waiting to be looked up. It holds the `process.exitCode` requirement and the stderr-in-every-mode rule.
- Color goes through `palette(stream)` in `src/ui.ts`, which reads `NO_COLOR` and the stream's `isTTY` at write time and hands back a blank set when either says no. Ask about the stream being written to rather than about the process, since `showHelp` in `src/cli.ts` frames on stdout while every other writer frames on stderr, and `process.stdin.isTTY` is a third question about prompting.
- No file outside `src/ui.ts` defines an escape constant. `src/ui.test.ts` walks the tree and fails the build on one, because sixteen files each spelling their own grey is what made color impossible to turn off in the first place.
- Exit-code coverage spawns the CLI from `src/commands/exit-code.test.ts`, because an action imported in process would set the code on the test runner. The two `feedback.ts` branches gated on `isToolkitSource` need a copy of `src/` under a temp root, since `PROJECT_ROOT` resolves from the CLI's own location rather than from the working directory.
- A linked worktree carries an empty `node_modules` and resolves packages from an ancestor, so a fixture symlinking `node_modules` walks up for the populated one rather than naming the repository root.
- The `feedback` guard on `process.stdin.isTTY` is the one error path a pipe cannot reach. `script -qec` allocates a pty and forwards the child status, both util-linux spellings, so that case skips off Linux.
- `Bun.Glob` has no exclude option. A walker that must skip vendored trees filters scanned paths by segment, and forgetting to leaves the skip silently absent wherever `git check-ignore` is unavailable.
- Bun's `$` parses a bare `(` inside a template literal as shell syntax, so a git format string written inline as `--format=%(refname)` throws `Unexpected token` when the command runs rather than when the file is type checked. Pass such an argument through an interpolated array, which Bun escapes whole. `branchRefs` in `src/worktree.ts` is the shape to copy.
- Every git or `gh` call resolving a repository strips the environment through `gitEnv()`, since a hook exports `GIT_DIR` into each process it runs and it beats `-C`. The Bun spelling is `.env(gitEnv())` and the `execa` one is `{ env: gitEnv(), extendEnv: false }`. `git --version` is the one call that needs neither, resolving no repository at all. `src/gh-invocations.test.ts` walks `src/` for an `execa('gh', ...)` call missing the strip and fails the build on one.
- `gh pr view --json files` caps its list at 100 rows and puts nothing on the record saying it did, measured against `#1250`, which carries 101 files and views as 100. A verb reading a changed set that way gets a set silently short, so `readFromApi` in `src/commands/pr.ts` follows a view that comes back at the cap with `gh api --paginate repos/{owner}/{repo}/pulls/<n>/files` and refuses when that read fails. The cap is the tool's rather than the caller's, which separates it from `gh pr list --limit`, where the bound is one the caller chose and can see.
- Stripping the environment covers one half of repository resolution and not the other. A call naming an explicit `--git-dir` and `--work-tree` still derives its pathspec prefix from the current directory, so a bare name means the work-tree root only while the caller stands outside that tree, and `-C <work-tree>` on the same invocation is what settles it. `records` in `src/records/backup.ts` is the one call site, since every worker session runs from `.claude/worktrees/<name>/`, which sits inside the records work tree.
- A bare positional and a subcommand coexist on one command: `canon docs list` resolves to the subcommand and `canon docs agents` falls through to the positional. This is what preserves the bash shorthand where any non-verb argument means `get`. A doc named after a verb would be shadowed, which the bash `case` did too. `canon standards <name>` takes the same shape, so a standard sharing a subcommand's name is the same trade there.
- Registering an action on a parent carrying subcommands replaces commander's own no-action fallback, which writes help to stderr and exits 1. `outputHelp()` defaults to stdout, so the bare path has to pass `{ error: true }` or the help block lands in the data stream.
- A topic resolves against two spellings, `<dir>/<topic>.md` and `<dir>/<topic>/index.md`, so a domain that outgrows one file keeps the name its callers already type. The file wins when both exist, and a folder with no `index.md` resolves to nothing because the catalog is what reaches the sub-areas. Both listers pin their own depth, so a split domain needs a folder pass added to each.
- `PROJECT_ROOT` derives from `import.meta.url` rather than Bun's `import.meta.dir`, which the test runner leaves undefined and which made the module holding it throw on import there. Both spellings resolve the same directory under Bun, so the derivation is the whole of the change and it is what puts a module reading the package root within reach of a test.
- The constant sits in `src/project-root.ts` rather than beside `execScript`, since a path constant and a process spawn share no reason to change. Importing it from `exec.ts` loaded `execa` to read one string, which is what `040-performance` bans, and the eleven modules wanting the root and no subprocess were paying it.
- An engine module still takes the toolkit root as a parameter wherever the caller's root decides the answer, which keeps root resolution in the command layer. `src/standards/read.ts` is the one module holding both: a project root it is handed, and the package root it imports as the search behind it, which is the only root a target has. Tests build fixtures with `mkdtempSync(join(tmpdir(), 'canon-<domain>-'))`, which for that module is also the only place the package root is separable from the authoring root.

### Reading a tree someone else owns

- `src/sessions/` is the first command whose correctness depends on a file nothing in this repository writes. The client records one JSON file per session under its configuration directory, resolved from `CLAUDE_CONFIG_DIR` before `~/.claude`, and each record carries that session's working directory beside the name a session listing renders. Reading it is what lets a name join to a branch by an exact match rather than by ordering the roster on start time.
- The location, the filenames, and the fields carry no published contract, so an absent registry reports as a refusal rather than as a machine running no sessions. A client that moves the folder then surfaces as a failure instead of an empty roster, which is the same absent-key rule the audits already apply.
- A branch name identifies a branch inside one repository and nothing across a machine, so `--branch` scopes to the shared git directory the command's own working directory resolves to, and refuses outside one. The registry is machine-wide, which is what makes the unscoped match reach a session working in another project, and `main` is the name that collides wherever two are open. The match still returns a count rather than a row, since two sessions can hold one branch and a caller reading the first one picks among candidates without knowing it.
- The liveness check matches a record against the start time it stamped by reading the process filesystem, and falls back to a signal probe where that does not exist. The fallback marks the whole roster unverified rather than dropping rows, since the folder is never pruned and a reused pid would otherwise read as a live session. A record carrying a non-positive pid is dropped at the registry, because signal zero addresses the caller's own process group and would answer for it.

### Writing into a tree someone else owns

- `src/wiki/` scaffolds `.claude/wiki/` in a target and reports a root `wiki/` left by an older scaffold rather than migrating it. A move is a decision the operator owns, since the two roots can both hold pages.
- Porting a guard means porting its side effects. The bash `guard_root` ran `cd "$target"`, which validated the target existed as a by-product of resolving it. A port that reproduces only the stated purpose drops that check, and `mkdir -p` downstream then scaffolds a typo'd path into a new tree.
- Preserving a destination's mode and indent width moved to `internal/rules/core/096-operator-files.md`, which globs `src/**/*.ts`. `writeSettings` is the live implementation of the mode half, after `merge_user_setting` silently tightened `~/.claude/settings.json` from 644 to 600 on every run, and `detectIndent` plus `serializeSettings` are the indent half.

### A catalog command reads the installation, not the branch

Every `canon` command taking `PROJECT_ROOT` reads the installation the CLI was linked from rather than `pwd`, because `src/exec.ts` sets it to `resolve(import.meta.dir, '..')`. A catalog run inside a linked worktree therefore reports that installation's tree rather than the branch's: during a requirement-coverage batch `canon claude skills list --json` reported 30 skills lacking a file while the branch already held 16. A registry-installed binary is staler again, answering 56 skills with published descriptions while the checkout held 59, dropping the three most recently merged. Verify a branch's own tree by walking the filesystem, and treat any task or plan whose test strategy names a catalog command as untestable from a worktree.

### A command module cannot be imported by a test

Logic under `src/commands/` that needs a unit test moves to a pure module under the domain folder, because a test importing a command file cannot run at all. `src/exec.ts` evaluates `resolve(import.meta.dir, '..')` at module scope and `import.meta.dir` is undefined under the vitest transform even with `bun --bun vitest`, so importing `@/commands/init` failed the whole suite with `paths[0] must be of type string` before a case ran. `src/commands/feedback.test.ts` targets `feedback-format.ts` for exactly this reason, and `flagsProvided` moved to `src/init/flags.ts` on the same grounds. Check whether the logic reaches `@/exec` or `@/cli-run`, move it to a sibling importing neither, and have the command file supply impure factories as arguments.

### Driving a prompt needs a PTY

`select` in `src/ui.ts` exits when `process.stdin.isTTY` is false, so every branch behind a prompt is unreachable from vitest and from a plain shell run. `script -qec "<command>" /dev/null` allocates a PTY, and piping timed keystrokes into it exercises the real apply path, with `j` and `\r` moving and confirming. The `canon sync` commit path had no other route to verification: a fake `GitRunner` proved the decision logic, and only the PTY run proved the narrowed staging actually stages the changed paths and that `git` output pipes into the open frame. Order the sleeps against the domain work that runs before the prompt.

### Map a ported conditional to the matching predicate

Porting a bash conditional means mapping the operator to the matching predicate rather than to a bare existence check. `-d` is `isDirectory`, `-f` is `isFile`, and `-e` alone is what `existsSync` provides. `collect_files_for_category` tested `[ ! -d "$dir" ]` and reported a clean `Category not found`, while the port using `existsSync` let `canon snippets install snippets.toml` resolve to the real file sitting beside the category folders and crash with an unhandled `ENOTDIR`. The trap fires wherever a directory of folders also holds files.

### Promoting a repo utility

A repo utility is promoted by reimplementing it in TypeScript under `src/<domain>/`, generalizing repo-specific paths to flags and leaving deeply-coupled layers behind as a follow-up. Both `canon slides` and `canon transcripts` reimplemented career-repo tools rather than lifting Python, which keeps the repo single-stack and covered by `bun run check`. Treat external binaries as user-installed dependencies the way `git` and `gh` already are, and drop repo defaults.

## CLI

The command surface and its flags live in `docs/agents/`. That folder is the canonical invocation contract for agents.
