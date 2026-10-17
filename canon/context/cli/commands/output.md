---
title: Writing files and output
description: Stdout against stderr, writing into a target, record-root resolution, batching edits into one invocation, and validators with their repairs
---

# Writing files and output

## Decisions

### Stdout is the product

A command whose stdout is the product writes the document with `process.stdout.write` and everything else with the `log_*` helpers, which are stderr-only. `canon docs <topic>` is the one command a caller captures with `$(...)`, so a single frame character on stdout would corrupt the document silently.

### Writes into a target keep the mode

Anything writing a file into a target routes through `copyPreservingMode` in `src/sync/copy.ts`. `copyFile` imposes the source's mode on an existing destination, so a target file deliberately at 600 comes back at the source's mode. The bash `cp` it replaces left an existing mode alone.

### Writes outside a target take an argument

`canon claude setup` defaults to `$HOME/.claude` but accepts a path. That is the only way to cover the settings merge without pointing a test at the operator's real config, and the sandbox scenario passes a sandbox-local path for the same reason.

### A preview runs the apply's function

`planGitignore` dry-runs `mergeSections`, so the preview and the apply cannot disagree. Parsing the source a second time for the preview lost, since two reads drift.

`govArgs` in `src/init/steps.ts` has the same shape. It builds both the `gov install` argv and the command a `--skip governance` notice tells the caller to paste.

### Machine output goes through `JSON.stringify`

Interpolating a name into a JSON string literal through `printf` emits output a consuming skill cannot parse once the name carries a quote.

### The reporter shapes the record

The emitted record differs from the result interface behind it in field names. `ArchiveSuccess` in `src/tasks/archive.ts` carries `stem`, and `recordFor` in `src/commands/tasks.ts` emits it as `task`. A reference documenting the record off the interface names a field no caller receives.

### Record roots

A record folder resolves at two roots through `recordDir` in `src/roots/record.ts`. `.canon/<folder>` is read first and `.claude/<folder>` second, and a folder neither root carries resolves to the creation default, `.canon/`. The read order and the default agree.

### No call site spells a root

A hand-composed path resolves against one root and reports nothing when wrong. So reads go through `recordDir`, a containment test through `recordDirs`, which names both roots whatever is on disk, and a write through `creationDir` or `creationRel`.

The scratch folder is the one name that differs by root, and the resolver owns that spelling so no caller carries a variant.

### Surface entries route through `surfaceDir`

The `SEEDED_DIRS` presence check in `canon claude sync` (`seededDirPath` in `src/commands/claude.ts`) resolves under `SURFACE_ROOTS` (`canon`/`.claude`), not `RECORD_ROOTS` (`.canon`/`.claude`). Routing it through `recordDir` would report a migrated target's surface folder as missing, since that resolver never checks `canon/`.

### The backup resolves the root itself

`workTree` and `recordsGitDir` in `src/records/backup.ts` both read `recordRoot`. A history opened at one root beside a work tree at the other stages the deletion of every folder a move relocated and pushes it.

### Scratch verbs resolve the main root

A verb editing shared session scratch resolves the root through `mainWorktreeRoot`, not the working directory. The task record verbs, `canon intake answer`, and every `canon teach` verb share the reason.

Every worker runs in a linked worktree where the file-editing tools refuse a main-root path and the banned stream editors are what a shell route reaches for, so the write has to resolve the root in-process.

### A tracked tree resolves the current root

A verb reading a tracked tree resolves `currentWorktreeRoot`, so it answers about the checkout the caller edited. `canon records validate` split both ways on `isSharedScratch` while one kind read the tracked standards corpus.

Every kind now reads the main root, there being no kind over a tracked corpus. A default keyed on a property every member shared is the thing to re-test when a member arrives without it.

### Batch edits into one invocation

A verb landing several edits in one file takes the whole batch in one call. Concurrent calls read the same file and the last write keeps only its own change, so `canon intake answer` scopes a call to one cluster and `canon teach glossary` writes one workspace's terms the same way.

A repeatable flag carrying `<key>=<value>` is the shape, splitting on the first separator so a value carrying its own survives. That lets `canon teach resource` take a URL holding a query string.

### List edits keep wrapped lines

A verb editing a markdown list groups each bullet with the indented lines wrapped under it. Filtering by line drops every line of a wrapped entry but the first, silently, which is how `canon teach glossary` reached a sandbox fixture carrying a wrapped entry.

`bulletRange` in `src/teach/workspace.ts` ends the span at the last bullet or indented continuation, so an unindented paragraph under a list stays outside and is neither sorted nor moved.

### The writer declares the shape

`src/records/validate.ts` imports the workspace filenames, subfolder names, folder pattern, and the mission heading read as exit criteria from `src/teach/workspace.ts`. The writer and the check cannot disagree on a filename, and a layout change lands in one module.

The heading is tested by equality against that constant, since a validator matching a spelling the reader cannot find would pass a mission whose criteria read as empty.

### Validators report only

`canon records` carries no repair verb, so `Finding` carries no `remedy`. The next standard redefining its required frontmatter brings a verb back with its first transform, which is cheaper than keeping one nothing exercised.

### Count what cannot be answered

A reader over a prose corpus counts what it cannot answer apart from what it can. `canon intake list` reports an item with no answer slot separately from unread and answered, since folding it into either hides a malformed file behind a number reading as work remaining or done.

### A folder prefix keeps old arguments working

`matchSlug` in `src/intake/folder.ts` tries an exact match against the bare argument first, then the one entry whose name is an ordinal ahead of it. `canon intake list toolkit-overview` keeps resolving once the folder becomes `21-toolkit-overview`.

Every outcome reports `basename(opened)` rather than the caller's argument, so `list`, `list <slug>`, and `answer <slug>` name the folder the same way in `--json`.

### More than one suffix match is a collision

`matchSlug` returns a discriminated `SlugMatch` rather than `string | undefined`. `openFolder` refuses `ambiguous-slug` naming every match, distinct from `no-folder`, so a caller can tell a typo from two dumps sharing a topic.
