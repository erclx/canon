---
title: Install and sync
description: Where rules land in a target, why install and sync and build stay separate verbs, the shared sync engine, this repository's own consumed copy, and the command surface
---

# Install and sync

Rules install per-file at `.claude/rules/canon/<subdir>/<rule>.md` with subdirectories preserved, covering `core/`, `lang/`, `framework/`, `lib/`, `ui/`, and `claude/`. Source rules already carry the Claude shape, so the copy is a passthrough rather than a transform.

## Decisions

### Three verbs rather than flags on one

Install bootstraps a stack and overwrites. Sync updates only what is already present and never adds. Build concatenates into a paste payload. Collapsing them would mean guessing intent from target state.

Install overwrites existing rules on purpose. Delete the rules you do not want after install rather than adding optional or addon complexity to stack definitions.

### Gov was the first domain on the shared engine

Gov went first because its source lookup is the thinnest of the four. The engine owns target validation, the scan report, the prompt, and the apply loop, and the adapter supplies two things only: where a destination file's source lives, and what counts as a change beyond a content diff.

Sync matches an installed rule to its source by rule name rather than by relative path. A rule that moves between bands in the toolkit still syncs into the subdirectory the target already uses, so a reorganization here does not strand installed copies.

### This repository's own rules are produced, not written

The toolkit's `.claude/rules/` is produced from `internal/governance.toml` rather than copied by hand. The record names one stack and its extras, `canon gov regen` resolves it into `.claude/rules/canon/` through the same stack machinery an install uses, and anything under `internal/rules/` installs alongside into a separate `.claude/rules/internal/`, since it governs this repository's own authoring paths and ships nowhere. Recording the subset stops the producer from reading its own output to decide what that output should be.

Registering a new rule for this repository means naming it somewhere the record resolves. Add it to a stack in `governance/stacks/`, to the `add` list in `internal/governance.toml`, or to `internal/rules/` when it governs toolkit authoring alone.

A rule whose source no stack names never installs, and the drift assertion still passes, because the copy matches what the record resolves to. A file written into `.claude/rules/` by hand is deleted on the next `bun run check`.

## Gotchas

- `runInstall` writes two stamp records after copying rules: `recordStamp` for the file hashes a sync would refresh, and `writeChainStamp` for the single stack name the operator gave, alongside `{domain: 'governance', toolkitRoot: PROJECT_ROOT}`. The second is what lets a later sync answer what the target's stack lists without re-deriving it from installed band folders, since `resolveRules` walks that stack's own `extends` ancestors when a reader asks it again.
- `canon gov sync` diffs before applying and requires confirmation, so it is safe to run repeatedly.
- `canon gov install` and `canon gov sync` refuse to run against the toolkit root, because a target's rules are the operator's to edit. `canon gov regen` runs against it on purpose, since the destination there is produced output.
- `scripts/lib/gov.sh` is narrowed to `rule_subdir` alone. It is called once per rule file inside a loop, so routing it through the CLI would cost a process per file, and it stays permanently because four of its five callers are sandbox scripts.
- The payload builder behind `build` is `src/gov/payload.ts`, and frontmatter stripping is `src/frontmatter.ts`, which `docs` shares. Do not duplicate either inside `src/gov/`.
- Projects that previously installed `.cursor/rules/` from this toolkit retain those files. Sync no longer touches them. Run `rm -rf .cursor/rules/` to clean up if Cursor is no longer in use.
- A target still on the flat `.claude/rules/<subdir>/` layout from before the `canon/` wrapper landed is invisible to both bootstrap verbs. `canon gov sync` narrows its walk to `.claude/rules/canon/`, so it reports the missing-surfaces message and exits 0 rather than reading the flat tree at all. `canon gov install` writes only into that same narrowed destination and never reads or clears the flat one, so the target ends up holding both, and Claude Code loads both copies of an edited rule at session start, one of them frozen. `canon migrate rule-layout` moves a target off the flat layout first. Run it before either bootstrap verb sees anything.

## CLI

| Command             | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `canon gov install` | Bootstrap rules for a stack into `.claude/rules/canon/`           |
| `canon gov sync`    | Update installed rules in target, clean up stale `.claude/GOV.md` |
| `canon gov build`   | Concatenate installed rules into `.canon/tmp/gov/rules.md`        |
| `canon gov regen`   | Rebuild this repository's own `.claude/rules/` from its record    |
| `canon gov list`    | Emit catalog of stacks, rules, and rules no stack reaches         |

Flags, arguments, and JSON shapes live in `docs/agents/index.md`. Every verb is TypeScript and carries a real commander option surface, so a mistyped flag fails with a suggestion.

Commands that write files require confirmation before running, and `CANON_NON_INTERACTIVE=1` resolves each confirm prompt to its first option. The stack picker is the exception and refuses headlessly, since defaulting there would choose a whole stack for the caller.

### Why `list` is TypeScript

`list` migrated when folder entries landed. Its bash matched a rules array against `"[0-9]{3}-[a-z0-9-]+"`, so a folder entry matched nothing and `base` would have reported zero rules to `setup-gov`, which dedupes `--add` extras against that list. Expanding in bash beside the resolver would have put the same rule in two languages.

`gov list --json` carries `unreferenced` alongside `stacks` and `rules`, on every invocation rather than behind a flag. The verify stage and a session asking what a stack leaves out read one call, and the key is additive, so a consumer reading either of the other two is untouched.

## Workflow

To set up a new project:

```bash
canon gov install react ../my-app
# resolves react → node → base, copies each rule to .claude/rules/canon/<subdir>/<rule>.md
```

To layer extra rules on top of a stack without creating a new stack definition:

```bash
canon gov install astro --add 200-react,260-shadcn,300-testing-ts ../my-app
# installs astro stack rules plus the three extras, deduped
```

`sync` and `build` take a target path and no other argument, so the CLI table above is the whole surface.
