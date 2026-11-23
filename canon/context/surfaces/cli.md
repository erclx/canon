---
title: CLI
description: TypeScript entry point and the layer boundary to bash, command registration, the root and git resolvers, packaging, and the pointers to the sync, audit, and session entries
---

# CLI

## Overview

`src/cli.ts` is the entry point of `canon`, the one `bin` the package ships. It builds a commander program, calls the `register` of each file in `src/commands/`, and routes help ahead of parsing. The source runs as it stands under Bun, so nothing compiles and no `dist/` exists to drift. Use `@/` imports, mapped to `src/` in `tsconfig.json`.

This entry owns the layers every command stands on, from the process layer to the package. The sync engine, the audit set, and `canon pr` sit in the `cli-*` entries. The engine behind a feature verb sits in its own `src/<domain>/` folder and belongs to that domain's entry. Flags and exit codes are in `docs/agents/`.

## Layout

### `src/cli/`

Holds the terminal and process layer every command shares. A `--json` run goes quiet through the `preAction` hook in `src/cli.ts`, leaving warnings and errors alone on stderr, so a test asserts the record and a success line goes through `outroSuccess`.

- `ui.ts` draws the frame on a terminal, bare marks on a pipe, and alone defines an escape. `palette(stream)` reads `NO_COLOR` and that stream's `isTTY`, and `isNonInteractive()` reads stdin's
- `help.ts` renders the top block from `COMMAND_GROUPS`, framed only on a TTY, and `help-option.test.ts` fails on a command with no row
- The web command field parses that block through `commandNamesFromHelp`, so a row-shape change has to keep every row readable
- `help-all.ts` routes `--help --all` before `program.parse()`. A bare `canon --help --all` prints the top block, and a group with no operand refuses an unknown word with exit 1
- `run.ts` spawns a subcommand by path so a worktree runs its own code, and `exec.ts` holds `execScript`, which no command calls now

### `src/commands/`

Holds one file per subcommand, each exporting `register(program)` for `src/cli.ts`. A long one splits into `src/commands/<name>/` by verb.

- Add a command by writing its `register`, calling it from `src/cli.ts`, and adding its row to `COMMAND_GROUPS`
- Define real options in commander and re-enable `helpOption` at each level, since the root disables it. Put a default on the flag, and read `getOptionValueSource` to tell it from an explicit pass
- A parent with subcommands and an action prints help through `outputHelp({ error: true })`, or the block lands in the data stream
- A command file cannot be imported by a test. Move testable logic to a pure module in the domain folder and pass the impure factories in
- A browser-backed command imports its engine inside the action, since `src/cli.ts` loads every `register` at module scope. `src/browser/engine.ts` holds the shared predicates and `SANDBOXED`

### `src/roots/`

Groups the resolvers that answer where something lives.

- `project.ts` derives `PROJECT_ROOT` from `import.meta.url` and holds `checkoutMismatchWarning`, which a verb answering from `PROJECT_ROOT` emits when the caller stands in another checkout
- `record.ts` resolves a record folder through `.canon/` before `.claude/`, and `surface.ts` a surface folder through `canon/` before `.claude/`, each with a creation default
- `legacy.ts` holds `resolveExisting`, the first-existing-path read the stamp, baseline, and label map share
- A verb whose answer depends on the caller's root takes it as a parameter, which keeps root resolution in the command layer

### `src/git/`

Holds every module that reads repository state, named for what it reads.

- `env.ts` holds `gitEnv()`, which strips the variables a hook exports, and `gh-invocations.test.ts` fails on a `gh` call in `src/` that skips it
- `worktree.ts` holds `mainWorktreeRoot()` for shared scratch, `currentWorktreeRoot()` for a tracked tree, `listWorktrees()`, and `branchRefs()`
- `base.ts` holds `baseCandidates()`, the trunk order the base-ref resolver and `src/gov/test-order.ts` each run their own call over
- `files.ts` holds `listRepositoryFiles()`, the corpus three audits read, and `listChangedFiles()`, which diffs the working tree rather than `HEAD`, so an uncommitted surface is in scope
- `revision.ts` holds `readBlobsAt()` and `spaceEvenly()` for every trend

### `package.json`

Decides what the published package `@erclx/canon` carries.

- `files` lists `src`, `scripts`, `governance`, `tooling`, `claude`, and `docs`, minus `scripts/eval` and every test file. `internal/`, `wiki/`, `sandbox/`, and `.claude/` stay out
- `publishConfig.access` is `public`, since a scoped package defaults to restricted and a restricted publish only fails for everyone outside the scope
- Release-please owns the version and writes the plugin manifest through `extra-files`
- `scripts/core/install-check.ts` packs with `--ignore-scripts`, installs the tarball without development dependencies, and asserts an excluded path is absent from it

### Other folders

Each of these owns one slice the folders above lean on.

- `src/capture/` owns the one browser import for `canon capture`, and `src/docs/`, `src/serve/`, and `src/web/` own the docs reader, the static server, and the README citation check
- `src/records/`, `src/tasks/`, and `src/worktrees/` own the record-folder, task-board, and worktree verbs, each planning before it applies
- `src/gate/` and `src/shipped/` own the gate stages and the shipped-references check
- `src/code/`, `src/comments/`, `src/secrets/`, `src/deps/`, `src/labels/`, `src/counts/`, `src/census/`, and `src/history/` own the remaining audit engines
- `src/sweep/` owns the skip and mute contract line sweeps read, and `src/version/` and `src/upstream/` own the skew read, the release digest, and the `canon changelog` split

## Gotchas

- `PROJECT_ROOT` is the installation the CLI runs from, so a catalog verb in a linked worktree reports that tree. Run `bun src/cli.ts` to answer from the worktree
- A verb reading a tracked tree uses `currentWorktreeRoot()`, since the main root reports on files the session never edited
- A spawned test sets `CANON_STATE_DIR`, or `gov install` writes a fixture row into the real target index. `runCli` also sets a dead `BUN_CONFIG_REGISTRY`, so a `--write` case seeds first
- A subcommand registered after its parent keeps `passThroughOptions`, so `canon sandbox` words such as `reset` reach its action as words
- A `canon docs` topic resolves `<topic>.md` before `<topic>/index.md`, and each lister pins its own depth, so a split domain needs both passes
