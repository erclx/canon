---
title: Scripts
description: The bash scripts under scripts/, the frame library they source, the frozen eval records, and where the TypeScript CLI took over
---

# Scripts

## Overview

Owns the bash under `scripts/`, being repo maintenance, the shared frame library, and the frozen records of a retired eval. No domain keeps a bash dispatcher or a verb folder, since `src/commands/<domain>.ts` routes every verb. The TypeScript side is described in `canon/context/surfaces/cli.md`.

No command under `src/commands/` shells into bash, and `execScript` in `src/cli/exec.ts` has no caller. The bash left is the scripts here, the hooks under `.claude/hooks/`, and the stack scripts under `tooling/`, which run in targets with no guaranteed runtime.

## Layout

### `scripts/`

Traps for any bash script edited under this folder, each a failure that passed a gate while the script was wrong.

- A command in an `EXIT` trap that can fail needs its own `|| true`, since `set -e` applies inside the trap and a bare `kill` on a gone pid turned a good run into exit 1
- A fatal precondition inside `$(helper)` cannot stop the run, since `exit` ends the subshell, so validate in a `require_*` function the main shell calls first
- Read a helper's body before porting its call, since `cd`, `realpath`, and `readlink -f` fail on a missing path as a side effect of resolving
- `exec` drops the parent's `EXIT` trap, so a script that execs re-arms `trap close_timeline EXIT` before any early exit
- `bun --eval` exits 0 on a throw when stdin is a pipe, so print a sentinel and branch on it rather than on `$?`

### `scripts/core/`

Holds the scripts run by `bun run` name or fired by a gate stage or workflow, and none is a `canon` verb. `capture-home.sh` builds the landing page for `pr-visual-checks.yml` and the frame refresh, `regen-web-*.ts` write the committed previews and favicon, and `design-sync.ts` lands board frames in `canon/design/`, which the design entry describes.

- `bootstrap.ts` installs dependencies, links the CLI globally, and appends the alias block to `~/.zshrc`. A re-run stops at the marker, so a grown block reaches no one until they delete the old one.
- `regen-hero.ts` fills each `assets/captures/*.html.tmpl`, reading every catalog in-process, and a placeholder nothing fills fails the run. Its pure half sits in `src/capture/frame-values.ts`.
- `FEATURED_SKILLS` in that module is a hand-chosen list of exactly `LISTED` names, so renaming or retiring a shipped skill fails the Hero stage until the list is updated
- `render-film.ts` renders `assets/film/` once per theme at a pinned `hyperframes` and derives the README GIF, web MP4, and poster with ffmpeg, copying them into `assets/loops/` once both themes succeed
- The command count greps `import { register as ` lines in `src/cli.ts`, so a command registered in another shape leaves the frame low and nothing reports it

### `scripts/ci/`

Holds the programs a workflow step calls once it passes five lines or carries more than one guard, a loop, or a function. A script takes its inputs as arguments or env and keeps the flags its step ran under, since the move relocates a step and does not rewrite it.

- Each script is committed `100755` and runs after `actions/checkout`, so a job that never checked out gets one added
- A workflow step keeps `permissions` and secrets in its own `env`, so the token scope reads off the YAML
- `delete-previews.sh` has a seeded sibling at `tooling/cloudflare/configs/scripts/`, which adds a skip for absent secrets. Keep the two otherwise the same.

### `scripts/eval/`

Holds the frozen records of a retired test that asked whether a session that never saw an artifact can author a conforming one from it. The runner was deleted and is restorable from git history.

- Each record opens with a banner refusing edits, so a sweep excludes them and a path inside one that no longer resolves is the record working
- `result-context.md` and `result-wireframes.md` refuse every edit, while `result-seed.md` refuses only its quoted and machine-derived blocks
- A restored run spends real money, and the operator authorizes the spend while the session performs the run
- A fixture a headless run is pointed at lives outside the repository under `mktemp -d`, since a session beneath the project root loads its `CLAUDE.md`, rules, and context
- `ledger.md` takes one appended row per run, with its table last in the file

### Other folders

The scenario tree sits outside this folder.

- `sandbox/` holds the scenario tree `canon sandbox` provisions from, described in `canon/context/development/sandbox.md`

## Gotchas

- Sweep a deleted bash file's callers by path (`source`, `exec`, `bash <path>`) and never by function name, which undercounts. A name audit found 2 callers of `lib/inject.sh` where 17 existed.
- A gate walking a root that is missing passes with nothing walked, so probe it by removing the input root as well as by planting a violation
- Quoting a pathspec changes what it matches, so `git diff -- 'claude/skills/*/references'` returns nothing for a modified file. Append `/*` or name the directory literally in a hand-run scope check.
- A harness that reports writes by diffing one directory cannot see a write outside it, and the sandbox harness shares it. Read the transcript beside the file list and clear the stray path.
