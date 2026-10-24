---
title: CLI
description: TypeScript entry point and the layer boundary to bash, command registration and migration, the sync engine and its install stamp, the audit commands, and packaging
---

# CLI

## Overview

`src/cli.ts` is the entry point of `canon`, the one `bin` the package ships. It builds a commander program, calls the `register` of each file in `src/commands/`, and routes help ahead of parsing. The source runs as it stands under Bun, so nothing compiles and no `dist/` exists to drift. Use `@/` imports, mapped to `src/` in `tsconfig.json`.

This entry owns the layers every command stands on, from the process layer and root resolvers to the sync engine, the audit set, `canon pr`, and the package. The engine behind a feature verb sits in its own `src/<domain>/` folder and belongs to that domain's entry. Flags and exit codes are in `docs/agents/`.

## Layout

### `src/cli/`

Holds the terminal and process layer every command shares. A `--json` run goes quiet through the `preAction` hook in `src/cli.ts`, leaving warnings and errors alone on stderr, so a test asserts the record and a success line goes through `outroSuccess`.

- `ui.ts` draws the frame on a terminal, bare marks on a pipe, and alone defines an escape. `palette(stream)` reads `NO_COLOR` and that stream's `isTTY`, and `isNonInteractive()` reads stdin's
- `help.ts` renders the top block from `COMMAND_GROUPS`, framed only on a TTY, and `help-option.test.ts` fails on a command with no row
- The web command field parses that block through `commandNamesFromHelp`, so a row-shape change has to keep every row readable
- `help-all.ts` routes `--help --all` before `program.parse()`. A bare `canon --help --all` prints the top block, and a group with no operand refuses an unknown word with exit 1
- `run.ts` spawns a subcommand by path so a worktree runs its own code, and `exec.ts` holds `execScript`, which no command calls now

### `src/commands/`

Holds one file per subcommand, each exporting a `register(program)` that `src/cli.ts` calls.

- Add a command by writing its `register`, calling it from `src/cli.ts`, and adding its row to `COMMAND_GROUPS`
- Define real options in commander and re-enable `helpOption` at each level, since the root disables it. Put a default on the flag, and read `getOptionValueSource` to tell it from an explicit pass
- A parent with subcommands and an action prints help through `outputHelp({ error: true })`, or the block lands in the data stream
- A command file cannot be imported by a test. Move testable logic to a pure module in the domain folder and pass the impure factories in
- A browser-backed command imports its engine inside the action, since `src/cli.ts` loads every `register` at module scope. `src/browser/engine.ts` holds the shared absence predicates

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
- `files.ts` holds `listRepositoryFiles()`, the file set the citation check, markdown corpus, and secret scan read
- `listChangedFiles()` in that file diffs the working tree rather than `HEAD`, so a surface added before the commit is in scope

### `src/sync/`

Holds the one engine `gov` installs and syncs through, the workflow `canon sync` runs afterward, and the install stamp. `format.ts` formats the stamp alone with the target's `oxfmt` or `prettier`, since a formatted seed would read as `customized`.

- An adapter supplies `installedRoot`, `locateSource`, and optional hooks. Widen `SyncAdapter` rather than branching on a domain name in `engine.ts`
- `planSync` marks each walked file with a state such as `stale`, `orphaned`, `retired`, or `renamed`. Location decides ownership before a name lookup, through `projectSubdir` and `ownsInstalledRoot`
- Declare a rename in `governance/renames.toml`, or the old rule lands as `retired` and is deleted. `src/gov/renames.test.ts` fails on a live key, a dead chain, or a cycle
- `stamp.ts` writes `canon/config/config.json` after the copies land and reads three older spellings. Adding a domain means choosing `STAMP_DOMAINS` or `SCANNED_DOMAINS`, and retiring one edits both
- `check.ts` builds `canon sync --check`, `history.ts` recovers `stale` when unstamped, and `reverse.ts` finds dropped files. `hasDrift` skips `orphaned`, tooling, and the new and reverse sections

### `src/targets/`

Owns the machine-level index of target projects, kept under `stateDir()`.

- `registry.ts` records a target as `putDomain` stamps it. A failed write is dropped, since the stamp is the authoritative record
- `sweep.ts` finds installs that predate the index. It descends into a stamped folder, which can hold others, and skips `.claude` so a worktree's stamp copy counts nothing
- `resolve.ts` groups by origin so a target in two clones counts once, and `pulls.ts` reads each target's open pull requests
- `validate.ts` holds `resolveTarget`, the install-directory check under every verb that takes a target

### `src/audits/`

Holds the aggregate behind `canon audits run`, the only audit anything schedules.

- `catalog.ts` holds `AUDITS`, one `AuditSpec` per verb. Its `gatingExits` say which exits are facts, since a reporting verb sets 2 on findings it does not gate
- Add an audit by adding its spec, with a `counts` extractor that returns `undefined` when the record lacks its keys, since zero would read as clean
- `run.ts` runs the specs together and reports one verdict. `--corpus` scopes a run, and an exit 3 from a verb is a defect in the run
- `baseline.ts` compares each count to the recorded baseline. Growth reports and never gates, and it is attributed rather than re-recorded to clear it
- `deps` runs weekly in `verify.yml` and times out at 120 seconds as `no-record`. A missing per-machine folder reports absent, but a missing tracked tree still warns

### `src/context/`

Holds the context-folder audit behind `canon context audit`.

- `audit.ts` reports section, shape, length, provenance, and reference-form findings per entry, and `gate.ts` decides which fail under `--gate`
- `shape-gated.ts` lists the entry paths held to the Overview, Layout, and Gotchas shape. `canon/context/index.md` is regenerated by `canon indexes regen`, never edited
- `citations.ts` resolves every cited path and gates on a miss. It lifts a `canon/context/<name>.md` suffix out of a longer path, so a seed path fails when the entry it mirrors moves
- `requirements.ts` reads the word cap from `canon/REQUIREMENTS.md`, and `index-drift.ts` compares an index to its siblings
- `coverage.ts` reads `roots` from `canon/config/context.toml` and reports a code folder no Layout names or two entries claim with an H3. It gates under `--gate`, and a project with no root passes

### `src/markdown/`

Holds the attribute-standard audit behind `canon markdown audit` and the fence walker every markdown reader shares.

- `bans.ts` and `links.ts` gate. The ban set ships as data, an empty set reports rather than passes, and exit 3 stays apart from the refusal at 1
- `density.ts` measures bullet runs and sentence weight. `scope.ts` names what is measured and what gates, read by the audit, `canon init`, and `canon claude sync` through `scopedDensityFindings`
- A rewrite batch replaces its folder prefix with the entry path in `GATED_PATHS`, never adding beside it, and a `REQUIREMENT.md` gates only on its exact path
- `gated.ts` reads a target's list from `canon/config/markdown.toml`, where a bullet run gates only under a listed prefix, and `gated add` and `canon init` append a prefix only once it is clean
- `colons.ts` and `heading-case.ts` only report. `tables.ts` gates `table-cell` and `table-then-list` as density kinds and reports `table-rows` and `table-token`.

### `src/migrate/`

Holds the one-shot moves behind `canon migrate`, being `records`, `surface-roots`, `record-tree`, `scratch-evidence`, `record-layout`, `rename`, `skill-names`, `rule-layout`, and `session-defaults`. Each plans first and applies only under `--write`.

- `status.ts` orders every move in `MIGRATIONS` and reads each by its exit through `cliRunner`, and a test fails when a registered subcommand is missing from it, so a new move joins by one line there
- `rename.ts` holds the token sweep and `skill-names.ts` the map it reads, so a renamed or merged skill is a map row plus a pointer left at the old name
- A merged skill's pointer sets `disable-model-invocation: true`, counts as a shipped skill, and needs a routing case, `metadata.family`, and a skill-map row
- Each old spelling in the pointer takes a `canon-keep-retired` marker so a later sweep does not move it onto the survivor
- The pointer's paths join the map's `excludedPaths` only after the sweep runs, since excluding first leaves the real body unmoved while every citation names the new one

### `src/pr/`

Holds the readers and writers behind `canon pr`, all over REST since a cloud session's proxy refuses GraphQL. The squash merge in `merge.ts` is a REST `PUT` too, pinned to the head it read so a push landing after the read refuses.

- `rest.ts` is the one boundary where REST payloads take the field names the rest of the folder reads, and list endpoints go through `gh api --paginate`
- `head.ts` and `checks.ts` key on the remote tip, not the local branch, and `checks.ts` tells a conflicted branch from runs that have not started
- `evidence.ts`, `tick.ts`, and `bijection.ts` own the marked comment, the checklist ticks, and the key-changes comparison. `frames.ts` files review frames and reference captures on `canon/frames`
- `preview.ts` and `local.ts` write and remove the address line. The first reads what a branch serves from the deploy workflow's push trigger, the second finds a server by its cwd
- `lift.ts` readies a pull request only when every gate passes, and returns a ready one to draft on a failing review, ui, or evidence gate. `painted.ts` lists the paths no UI close carries across

### `src/listeners/`

Holds the reads of which process listens on a port, shared by `canon pr local` and `canon worktrees reclaim`.

- `machine.ts` reads through `/proc` first and lsof second, and reports no reader at all rather than an empty list on a machine with neither
- `parse.ts` turns each tool's output into pid and port pairs. `belongs.ts` is the nesting test that keeps a listener in the main checkout or a sibling worktree out of a worktree's set

### `src/sessions/`

Holds the live-session roster and the branch claim, split by what a stub has to replace. `transfer/` moves a session between machines and treats a transcript as opaque bytes.

- `registry.ts` reads one JSON file per session under `claudeConfigDir()`. No published contract describes it, so an absent registry refuses rather than reporting an empty roster
- `live.ts` matches a record to its stamped start time, and marks it unverified where it can only probe a signal or, across pid namespaces, a socket file. `liveness()` stays synchronous for the gate
- `resolve.ts` joins a session to its branch, and `--branch` scopes to the shared directory, since names collide across projects
- `resolve.ts` also upgrades an unverified row to `via: 'listener'` when its socket accepts a connection, which is how macOS, with no process filesystem, confirms a row
- `claim.ts` composes `claimed` from the roster, worktrees, and `branchRefs()`, which misses a branch pushed since the last fetch. Two readable flags stay apart so a failed read never reads unclaimed

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
- `src/comments/`, `src/secrets/`, `src/deps/`, `src/labels/`, `src/counts/`, and `src/census/` own the remaining audit engines
- `src/sweep/` owns the skip and mute contract line sweeps read, and `src/version/` and `src/upstream/` own the skew read, the release digest, and the `canon changelog` split

## Gotchas

- `PROJECT_ROOT` is the installation the CLI runs from, so a catalog verb in a linked worktree reports that tree. Run `bun src/cli.ts` to answer from the worktree
- A verb reading a tracked tree uses `currentWorktreeRoot()`, since the main root reports on files the session never edited
- A spawned test sets `CANON_STATE_DIR`, or `gov install` writes a fixture row into the real target index. `runCli` also sets a dead `BUN_CONFIG_REGISTRY`, so a `--write` case seeds first
- A subcommand registered after its parent keeps `passThroughOptions`, so `canon sandbox` words such as `reset` reach its action as words
- A `canon docs` topic resolves `<topic>.md` before `<topic>/index.md`, and each lister pins its own depth, so a split domain needs both passes
