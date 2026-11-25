---
title: Install and sync
description: What each install and sync verb writes, refuses, or leaves alone, and the rule detection record
---

# Install and sync

What each verb writes, refuses, and leaves alone. `canon --help` lists flags, and `canon docs drift-report` covers what `canon sync --check` reports.

## Bootstrap

`canon init [path]` installs up to four core domains and reports each independently. A failed domain does not abort the run, which finishes the rest and exits 1 naming the failures.

Any flag skips the confirmation prompt, but the `base` default of `--stack` does not count, so a bare `canon init` still prompts. `--skip` takes `governance` and `records`, and warns on any other value.

## Governance install

- `canon gov install <stack> [target]` needs the stack on a call with no terminal, else lists the valid names on stderr and exits 1
- A headless call takes Yes at the install confirm, and `--yes` answers it at a terminal too. Neither picks a stack.
- It refuses the toolkit root and a missing path
- `--add <rules>` with no stack installs into the one positional, or the current directory, keeping the recorded chain. Pass `./node` for a target named like a stack.

A flat installed-rule layout makes `gov sync` report "No governance surfaces found in target" and exit 0, and `gov install` write a second, wrapped copy. Run `canon migrate rule-layout` first.

## Governance sync

`canon gov sync [target]` updates what `.claude/rules/canon/` holds and adds nothing. `.claude/rules/project/` is never read, so put project rules there. After an apply it lists each copied rule with its globs and matching file count, and `--json` puts `{ "coverage": [...] }` on stdout.

- A rule the toolkit no longer ships is deleted, edited or not
- A rule renamed in `governance/renames.toml` moves, and its local edits are dropped
- A rule the recorded stack lists and the tree lacks reports as `missing` with no change
- A retired `.claude/GOV.md` is removed
- A binary older than the stamp holds every rule it has no source for and asks for an upgrade

After a rename the new name shows as `missing` when the stamp records a stack, and `gov install <stack>` adds it. A partner `governance/splits.toml` names shows as `missing` when the tree holds the split rule and lacks the partner, and `gov install --add <partner>` adds it.

`canon gov regen [--root <path>]` runs against the toolkit root alone. It rewrites `.claude/rules/canon/` and `.claude/rules/internal/` from `internal/`, and exits 1 when the record names something that does not resolve.

## Rule detection

`canon gov detect [target] [--stack <stack>] [--json]` proposes opt-in rules and writes nothing, from `governance/detect.toml` evidence keyed by rule basename.

- `deps` match package names in `package.json`, `pyproject.toml`, `go.mod`, and `composer.json`
- `files` are globs matched against git-listed paths and their folders, to depth two. Install what the operator keeps with `canon gov install --add <rules> <target>`.

```json
{
  "target": "",
  "stack": "node",
  "proposals": [
    {
      "rule": "react",
      "evidence": [{ "kind": "dep", "match": "react", "path": "package.json" }]
    }
  ]
}
```

- `kind` is `dep` or `file`, and `stack` is null without `--stack`, which drops rules that stack resolves
- A glob without a wildcard is also tested on disk, an unparseable manifest contributes nothing, and outside git the walk skips `.git`, `node_modules`, `vendor`, and `.venv`
- It exits 0 on any readable target and 1 for a missing target or an unresolved stack

## Tooling

- `canon tooling diff <stack> [target]` is the read-only comparison, exiting 1 on any difference, and it reads a dependency on a later major than the stack pins as `ahead`, which counts as no change
- A `--json` refusal answers `{ ok: false, reason, message }`, so branch on the record
- `withheld` entries are `{ rel, stack, present }`, hold every `.github/` file below the git root, and count toward no exit
- `present` marks a copy an earlier sync left, which is reported and never deleted
- `canon tooling sync <stack> [target]` writes only under `--write`. `--check` reports and exits 0, and a headless run with neither flag exits 1. It never installs over an `ahead` dependency.

### Warnings

Both verbs print a warning beside the comparison, and `diff --json` carries each as a `warnings` entry of `{ code, config, message }`. A warning counts toward no exit, since nothing `sync` writes would clear it.

`tailwind-unimported` fires when a root config registers `@tailwindcss/vite` and no `.css` file imports Tailwind. The fix is `@import 'tailwindcss';` in the global stylesheet.

### Drift cause and the write hold

A `drifted` entry in `configs` carries a `cause`, read against the golden hash the last write recorded for that path.

- `stale`: the target still hashes to the record, so canon moved and the project did not. `--write` replaces it.
- `edited`: the target no longer hashes to the record. `--write` holds it.
- `unattributed`: no hash is recorded, as on every target synced before hashes existed. `--write` holds it.

A config no stack in the recorded chain ships is a first install and is never held, so a fresh scaffold takes every golden config of a stack new to it, even after `canon init` recorded `base`.

A held path stays drifted, so the next headless run still exits 1. Pass `--replace <path>` once per path to take the golden copy, as the command the write prints does. A `--replace` naming no config the chain writes refuses with `unknown-replace`.

### Dispositions

`decline <path> [target] [--reason <text>]`, `customize <path> [target]`, and `lift <path> [target]` set or clear one path's disposition, each with `--json`. The path is relative to the target, or `package.json:<key>` for a script, and resolves against the recorded chain, never a stack argument.

A bare script name is not read as a script, so it refuses with `not-golden` and a message naming the address.

- A success answers `{ ok: true, action, path, entry? }`, where `entry` is the recorded `{ disposition, base?, reason? }` and is absent after a lift
- A declined or customized path leaves `configs`, `seeds`, and `withheld` for `dispositions`, as `{ rel, stack, kind, disposition, present, moved? }`
- A held script leaves `scripts` the same way, with `kind: 'script'`, `rel` its address, and `present` true when the target defines the key
- `moved` is set on a customized config or script alone, and counts toward the exit once the golden copy no longer matches `base`
- Sync and inject never write a path in `dispositions`, and nothing deletes one the project still holds

A refusal answers `{ ok: false, reason, message }` with exit 1:

| `reason`                | Meaning                                                   |
| ----------------------- | --------------------------------------------------------- |
| `no-chain`              | No tooling chain is recorded, so run `tooling sync` first |
| `bad-path`              | The path leaves the target                                |
| `not-golden`            | No stack in the recorded chain ships the path             |
| `already-held`          | The path is already declined or customized, so lift it    |
| `seed-not-customizable` | The path is a seed, which sync never overwrites           |
| `missing-file`          | `customize` named a config the target does not hold       |
| `missing-script`        | `customize` named a script the target does not define     |
| `not-held`              | `lift` named a path with no disposition                   |
| `toolkit-root`          | The target is the toolkit checkout, the source of truth   |

`canon tooling inject` and `prune-gitignore` apply one stack with no scan or prompt, and the latter prints the number removed on stdout. Use `sync` unless scripting provisioning, and pass `--nested` inside an open frame.

## Whole-project sync

`canon sync [path]` runs every installed domain sync, then offers a commit and pull request. Headlessly it applies the syncs, refuses the git workflow, reports what it would have made, and exits 0. It refuses a dirty working tree.
