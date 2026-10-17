---
title: Install and sync
description: What each install and sync verb writes, refuses, or leaves alone, the drift report and its seven side sections, the rule detection record, and version skew states
---

# Install and sync

What each verb writes, refuses, and leaves alone. `canon --help` lists the verbs and their flags.

## Bootstrap

`canon init [path]` installs up to five core domains and reports each independently. A failed domain does not abort the run, which finishes the rest and exits 1 naming the failures.

Any flag skips the confirmation prompt. `--stack` defaults to `base` and does not count as a flag, so a bare `canon init` still prompts. `--skip` takes `wiki`, `governance`, and `records`, and warns on any other value.

## Governance install

- `canon gov install <stack> [target]` needs the stack under `CANON_NON_INTERACTIVE=1`, and without it lists the valid names on stderr and exits 1
- It refuses the toolkit root and a path that does not exist
- `--add <rules>` with no stack installs into the one positional, or the current directory, and keeps the recorded chain. Pass `./node` for a target named like a stack.

A flat installed-rule layout makes `gov sync` report "No governance surfaces found in target" and exit 0, and `gov install` write a second, wrapped copy. Run `canon migrate rule-layout` first.

## Governance sync

`canon gov sync [target]` updates what `.claude/rules/canon/` holds and adds nothing. `.claude/rules/project/` is never read, so put project rules there.

- A rule the toolkit no longer ships is deleted, edited or not
- A rule renamed in `governance/renames.toml` moves, and its local edits are dropped
- A rule the recorded stack lists and the tree lacks reports as `missing` with no change
- A retired `.claude/GOV.md` is removed
- A binary older than the stamp holds every rule it has no source for and asks for an upgrade

The sync lists each change by path first. After a rename the new name shows as `missing` when the stamp records a stack, and `gov install <stack>` adds it.

`canon gov regen [--root <path>]` runs against the toolkit root alone. It rewrites `.claude/rules/canon/` from `internal/governance.toml` and `.claude/rules/internal/` from `internal/rules/`, and exits 1 when the record names something that does not resolve.

## Rule detection

`canon gov detect [target] [--stack <stack>] [--json]` proposes opt-in rules and writes nothing. Evidence comes from `governance/detect.toml`, keyed by rule basename.

- `deps` match package names in `package.json`, `pyproject.toml`, `go.mod`, and `composer.json`
- `files` are globs matched against git-listed paths and their folders, to depth two

```json
{
  "target": "/abs/path/my-app",
  "stack": "node",
  "proposals": [
    {
      "rule": "react",
      "evidence": [{ "kind": "dep", "match": "react", "path": "package.json" }]
    }
  ]
}
```

Here `kind` is `dep` or `file`, and `stack` is null without `--stack`, which drops rules that stack resolves. The verb exits 0 on any readable target and 1 for a missing target or an unresolved stack. Install what the operator keeps with `canon gov install --add <rules> <target>`.

## Tooling

- `canon tooling diff <stack> [target]` is the read-only comparison, exiting 1 when anything differs and 0 when nothing does
- A `--json` refusal answers `{ ok: false, reason, message }`, so branch on the record
- `withheld` entries are `{ rel, stack, present }`, hold every `.github/` file when the target sits below its git root, and count toward no exit
- `canon tooling sync <stack> [target]` writes only under `--write`. `--check` reports and exits 0, and a headless run with neither flag exits 1.

`canon tooling inject` and `canon tooling prune-gitignore` apply one stack with no scan or prompt. `prune-gitignore` prints the number removed on stdout. Use `sync` unless scripting provisioning, and pass `--nested` inside an open frame.

## Design

- `canon design install` copies `base.css` to `.claude/design/` and creates no override
- A project overrides by writing `.claude/design/project/`, which `design sync` never touches. `design sync` deletes nothing it finds no source for.
- `canon design fonts add <file> --family <name>` copies a `woff2`, `woff`, `ttf`, or `otf` face into `project/fonts/` and appends its `fonts.css` rule. Mismatched bytes refuse as `invalid-font`.
- `fonts list --json` flags a missing or out-of-folder file as a `problem`
- `canon sync` skips the domain where `design install` never ran

## Whole-project sync

`canon sync [path]` runs every installed domain sync, then offers a commit and pull request. Headlessly it applies the syncs, refuses the git workflow, reports the branch and commit it would have made, and exits 0. It refuses a dirty working tree.

## Drift report

`canon sync --check` writes nothing and needs no clean tree. `--json` emits the record, and `--exit-code` fails a CI job.

| State        | Meaning                                                            |
| ------------ | ------------------------------------------------------------------ |
| `stale`      | Still matches what the toolkit installed                           |
| `customized` | The project edited it                                              |
| `stranded`   | Sits at a path the toolkit no longer installs to                   |
| `orphaned`   | The project authored it                                            |
| `drifted`    | No stamp covers it                                                 |
| `missing`    | Governance only. The recorded stack lists it and the tree lacks it |
| `retired`    | Governance only. The toolkit no longer ships it                    |
| `renamed`    | Governance only. The toolkit ships it under a new name             |

`retired` and `renamed` count toward `--exit-code`. `orphaned` and `missing` do not.

- Attribution reads `canon/config/config.json`, then `.claude/canon/config.json`, then the retired `.claude/canon.json`, and moves none
- With none of them it matches the toolkit's git history. A published version reports `stale`, and anything else stays `drifted`.
- A registry install has no history and reports `historyUnavailable`
- `covers` names the domains the target stamped, and each domain keeps its own anchor
- Tooling records its stack chain, nearest first. `tooling.measured: false` means none was recorded, and tooling never counts toward `--exit-code`.

## Side sections

Seven sections sit outside the per-domain scan. They produce no change, and no sync applies them. Each returns empty when `managed` is false. A managed target holds `.claude/`, a `CLAUDE.md`, or a root-layout domain, and an unmanaged one is routed to `canon init`.

| Section           | Reports                                                               | Exit |
| ----------------- | --------------------------------------------------------------------- | ---- |
| `seeds`           | Each seed as `matching`, `stale`, `drifted`, or `missing`             | No   |
| `superseded`      | A file a newer seed folder replaced, as `replacedBy`. Never deleted.  | No   |
| `unmigrated`      | A domain at its old root, with `rootPath`, `installPath`, and a count | Yes  |
| `unmovedSurfaces` | A surface at its `.claude/` spelling, as `rel` and `movesTo`          | No   |
| `newRules`        | A rule the recorded stack lists and the tree lacks                    | No   |
| `newSkills`       | A plugin skill the target has not seen. Needs no command.             | No   |
| `reverse`         | `unclaimed` folders the toolkit once shipped                          | No   |

The Exit column marks what counts toward `--exit-code`. `canon migrate surface-roots` closes `unmovedSurfaces`, and `canon gov install` closes `newRules`. A `reverse` entry is attributed `dropped`, `project`, or `unattributed`.

`newRules` and `newSkills` come back empty on a shallow clone or a registry install, which reads as unmeasured rather than clean.

## Version skew

`canon sync --check` and `canon claude skills drift` report the installed version against the newest published one in `skew.state`. No other command looks it up. The report never changes an exit code, so branch on the field.

| State     | Meaning                                              |
| --------- | ---------------------------------------------------- |
| `behind`  | Names `canon upgrade` as the remedy                  |
| `current` | Installed matches published                          |
| `unknown` | Carries the reason the registry could not be reached |

`canon upgrade --json` adds `pending`, where the checkout holds a release npm does not serve yet. Its `message` starts `CLI stays at`, `checkout` names the version, and it exits 0.
