---
title: Install and sync
description: Where rules land in a target, why install and sync and build stay separate verbs, detection of opt-in rules, an add with no stack, the shared sync engine, this repository's own consumed copy, and the command surface
---

# Install and sync

Rules install per-file at `.claude/rules/canon/<subdir>/<rule>.md` with each domain subdirectory preserved. Source rules already carry the Claude shape, so the copy is a passthrough rather than a transform.

## Layout

### CLI

- `canon gov install` bootstraps a stack or installs named rules alone, `sync` refreshes what is installed and clears a stale `.claude/GOV.md`, `build` writes the paste payload, `regen` rebuilds this repository's own copy, `list` emits the catalog, and `detect` proposes opt-in rules for a target.
- Flags, arguments, and JSON shapes live in `docs/agents/install-and-sync.md` and `canon gov --help`.
- `CANON_NON_INTERACTIVE=1` resolves each confirm prompt to its first option. The stack picker refuses headlessly instead, since defaulting there would choose a whole stack for the caller.

#### Why `list` is TypeScript

Bash cannot express the folder-entry match. The regex bash would apply to a rules array matches nothing for a folder entry, so `base` would report zero rules to the `target-setup` skill, which dedupes `--add` extras against that list. Expanding the match in bash beside the resolver would also put one rule-matching logic in two languages.

`gov list --json` carries `unreferenced` and `staleDetect` beside `stacks` and `rules` on every invocation rather than behind a flag, and each rule carries its `detect` evidence or null. The gate stage and a session asking what a stack leaves out read one call, and the key is additive, so a consumer reading either of the other two is untouched.

### Workflow

Set up a new project:

```bash
canon gov install node ../my-app
# resolves node → base, copies each rule to .claude/rules/canon/<subdir>/<rule>.md
```

Layer extra rules on a stack without defining a new one:

```bash
canon gov install node --add astro,react,shadcn ../my-app
# installs node stack rules plus the three extras, deduped
```

Add rules to a target with no stack, after asking what its evidence proposes:

```bash
canon gov detect ../my-app --stack node --json
canon gov install --add react,zod ../my-app
```

## Decisions

### Three verbs rather than flags on one

Install bootstraps a stack and overwrites. Sync updates only what is already present and never adds. Build concatenates into a paste payload. Collapsing them would mean guessing intent from target state.

Install overwrites existing rules on purpose. Delete the rules you do not want after install rather than adding optional or addon complexity to stack definitions.

### Gov runs on the shared sync engine

The engine in `src/sync/engine.ts` owns target validation, the scan report, the prompt, and the apply loop. The gov adapter supplies two things only: where a destination file's source lives, and what counts as a change beyond a content diff.

Sync matches an installed rule to its source by rule name rather than by relative path. A rule that moves between folders here still syncs into the subdirectory the target already uses, so a reorganization does not strand installed copies.

### This repository's own rules are produced, not written

The toolkit's `.claude/rules/` is produced from `internal/governance.toml` rather than copied by hand. The record names one stack and its extras, `canon gov regen` resolves it into `.claude/rules/canon/` through the same stack machinery an install uses, and everything under `internal/rules/` installs beside it into `.claude/rules/internal/`. Recording the subset stops the producer from reading its own output to decide what that output should be.

Registering a new rule for this repository means naming it somewhere the record resolves: a stack in `governance/stacks/`, the `add` list in `internal/governance.toml`, or `internal/rules/` when it governs toolkit authoring alone. A rule no stack names never installs, and the drift assertion still passes, because the copy matches what the record resolves to.

Committing the consumed copy lets a citation spell one path that resolves here and in every target that installed the same content, where reading the authoring root directly would leave each citation needing two spellings.

### Detection proposes opt-in rules from evidence the toolkit holds

A rule no stack names reaches a project when `canon gov detect` proposes it. Each such rule keeps a table in `governance/detect.toml`, keyed by rule basename, listing the dependency names and the file globs that mark a project as wanting it. The verb reads the target's manifests and git-listed paths to depth two, leaves out every rule the caller's stack resolves, and returns each match with the manifest or path that matched, so `target-setup` puts proposals to the operator rather than deciding them.

The rejected alternative was the skill matching a detected technology against each rule's `description` and `paths` by hand. That reimplemented in prose what a verb can answer, and two sessions reading one project could propose different rules. The evidence also stays out of rule frontmatter, since frontmatter installs into every target and Claude Code would carry a key it never reads. The basename key keeps the file inside the reach of a rule rename sweep.

### An add with no stack leaves the chain alone

`canon gov install --add a,b <target>` installs the named rules with no stack under them. A first positional that names no stack reads as the target, and one that does keeps its meaning as the stack, so a folder named `node` needs `./node`. The path records the file hashes and skips `writeChainStamp`, because the extras are not a stack and overwriting the chain would cost a target the missing-rule report its stack install recorded.

### Only governance keeps a consumed copy

`internal/` carries no mirror, since nothing installs it into a project. A mirror would buy only a path this repository resolves, at the cost of a tracked copy regenerated on every check and a citation form that reads as portable and is not. `internal/rules/claude/authoring-layout.md` states the root each carrier resolves against instead, and the accepted cost is that a citation here reads differently from the same citation in a rule or a shipped body.

`internal/` has no install channel to mirror. The Consumed copies gate stage runs `canon gov regen` directly.

## Gotchas

- `runInstall` in `src/commands/gov.ts` writes two stamp records after copying a stack: `recordStamp` for the file hashes a sync refreshes, and `writeChainStamp` for the stack name the operator gave. The chain stamp lets a later sync answer what the target's stack lists without re-deriving it from installed domain folders. An add with no stack writes only the first.
- `canon gov install` and `canon gov sync` refuse to run against the toolkit root, because a target's rules are the operator's to edit. `canon gov regen` runs against it on purpose, since the destination there is produced output.
- The payload builder behind `build` is `src/gov/payload.ts`, and frontmatter stripping is `src/markdown/frontmatter.ts`, which `docs` shares. Do not duplicate either inside `src/gov/`.
- A project holding `.cursor/rules/` from an earlier toolkit version keeps those files, since sync does not touch them. Remove the folder by hand in a project that does not use Cursor.
- A target on the flat `.claude/rules/<subdir>/` layout is invisible to both bootstrap verbs. Sync walks only `.claude/rules/canon/` and exits 0, and install writes there without clearing the flat tree. Claude Code then loads both copies of an edited rule, one of them frozen. Run `canon migrate rule-layout` before either verb.
