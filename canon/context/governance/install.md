---
title: Install and sync
description: Where rules land in a target, why install and sync and build stay separate verbs, the shared sync engine, this repository's own consumed copy, and the command surface
---

# Install and sync

Rules install per-file at `.claude/rules/canon/<subdir>/<rule>.md` with each band subdirectory preserved. Source rules already carry the Claude shape, so the copy is a passthrough rather than a transform.

## Decisions

### Three verbs rather than flags on one

Install bootstraps a stack and overwrites. Sync updates only what is already present and never adds. Build concatenates into a paste payload. Collapsing them would mean guessing intent from target state.

Install overwrites existing rules on purpose. Delete the rules you do not want after install rather than adding optional or addon complexity to stack definitions.

### Gov runs on the shared sync engine

The engine in `src/sync/engine.ts` owns target validation, the scan report, the prompt, and the apply loop. The gov adapter supplies two things only: where a destination file's source lives, and what counts as a change beyond a content diff.

Sync matches an installed rule to its source by rule name rather than by relative path. A rule that moves between bands here still syncs into the subdirectory the target already uses, so a reorganization does not strand installed copies.

### This repository's own rules are produced, not written

The toolkit's `.claude/rules/` is produced from `internal/governance.toml` rather than copied by hand. The record names one stack and its extras, `canon gov regen` resolves it into `.claude/rules/canon/` through the same stack machinery an install uses, and everything under `internal/rules/` installs beside it into `.claude/rules/internal/`. Recording the subset stops the producer from reading its own output to decide what that output should be.

Registering a new rule for this repository means naming it somewhere the record resolves: a stack in `governance/stacks/`, the `add` list in `internal/governance.toml`, or `internal/rules/` when it governs toolkit authoring alone. A rule no stack names never installs, and the drift assertion still passes, because the copy matches what the record resolves to.

Committing the consumed copy lets a citation spell one path that resolves here and in every target that installed the same content, where reading the authoring root directly would leave each citation needing two spellings.

### Only governance keeps a consumed copy

`standards/`, `snippets/`, and `internal/` carry no mirror, since nothing installs any of the three into a project. A `standards/` mirror would buy only a path this repository resolves, at the cost of a tracked copy regenerated on every check and a citation form that reads as portable and is not. `internal/rules/claude/598-authoring-layout.md` states the root each carrier resolves against instead, and the accepted cost is that a citation here reads differently from the same citation in a rule or a shipped body.

`snippets/` needs no mirror because the `claude/snippets` symlink already serves every plugin cache, and `internal/` has no install channel to mirror. `scripts/core/regen-claude-copies.sh` is one delegation to `canon gov regen`.

## Gotchas

- `runInstall` in `src/commands/gov.ts` writes two stamp records after copying: `recordStamp` for the file hashes a sync refreshes, and `writeChainStamp` for the stack name the operator gave. The chain stamp lets a later sync answer what the target's stack lists without re-deriving it from installed band folders.
- `canon gov install` and `canon gov sync` refuse to run against the toolkit root, because a target's rules are the operator's to edit. `canon gov regen` runs against it on purpose, since the destination there is produced output.
- `scripts/lib/gov.sh` holds `rule_subdir` alone. It is called once per rule file inside a loop, so routing it through the CLI would cost a process per file, and it stays because the sandbox scripts are its callers.
- The payload builder behind `build` is `src/gov/payload.ts`, and frontmatter stripping is `src/frontmatter.ts`, which `docs` shares. Do not duplicate either inside `src/gov/`.
- A project holding `.cursor/rules/` from an earlier toolkit version keeps those files, since sync does not touch them. Remove the folder by hand in a project that does not use Cursor.
- A target on the flat `.claude/rules/<subdir>/` layout is invisible to both bootstrap verbs. Sync walks only `.claude/rules/canon/` and exits 0, and install writes there without clearing the flat tree. Claude Code then loads both copies of an edited rule, one of them frozen. Run `canon migrate rule-layout` before either verb.

## CLI

- `canon gov install` bootstraps a stack, `sync` refreshes what is installed and clears a stale `.claude/GOV.md`, `build` writes the paste payload, `regen` rebuilds this repository's own copy, and `list` emits the catalog.
- Flags, arguments, and JSON shapes live in `docs/agents/install-and-sync.md` and `canon gov --help`.
- `CANON_NON_INTERACTIVE=1` resolves each confirm prompt to its first option. The stack picker refuses headlessly instead, since defaulting there would choose a whole stack for the caller.

### Why `list` is TypeScript

Bash cannot express the folder-entry match. The regex bash would apply to a rules array matches nothing for a folder entry, so `base` would report zero rules to the `target-setup` skill, which dedupes `--add` extras against that list. Expanding the match in bash beside the resolver would also put one rule-matching logic in two languages.

`gov list --json` carries `unreferenced` beside `stacks` and `rules` on every invocation rather than behind a flag. The gate stage and a session asking what a stack leaves out read one call, and the key is additive, so a consumer reading either of the other two is untouched.

## Workflow

Set up a new project:

```bash
canon gov install react ../my-app
# resolves react → node → base, copies each rule to .claude/rules/canon/<subdir>/<rule>.md
```

Layer extra rules on a stack without defining a new one:

```bash
canon gov install astro --add 200-react,260-shadcn,300-testing-ts ../my-app
# installs astro stack rules plus the three extras, deduped
```
