---
title: Scripts
description: The bash scripts under scripts/, the frame library they source, the frozen eval records, and where the TypeScript CLI took over
---

# Scripts

## Overview

Owns the bash under `scripts/`, being repo maintenance, the shared frame library, and the frozen records of a retired eval. No domain keeps a bash dispatcher or a verb folder, since `src/commands/<domain>.ts` routes every verb. The TypeScript side is described in `canon/context/cli/index.md`.

## Layout

### `scripts/core/`

Holds the scripts a contributor runs by `bun run` name and the ones a gate stage or workflow fires. Nothing here is a `canon` verb, and `bun run check` itself resolves to `canon gate run`.

- `bootstrap.sh` installs dependencies, links the CLI globally, and appends the alias block to `~/.zshrc`. A re-run returns at the marker, so a grown block reaches no one until they delete the old one.
- `regen-hero.ts` fills each `assets/captures/*.html.tmpl`, reading every catalog in-process, and a placeholder nothing fills fails the run. Its pure half sits in `src/capture/frame-values.ts`.
- `FEATURED_SKILLS` in that module is a hand-chosen list of exactly `LISTED` names, so renaming or retiring a shipped skill fails the Hero stage until the list is updated
- `check-color-source.sh` fails when a `.sh` outside `scripts/lib/ui.sh` spells an SGR escape. Its walk stops at `scripts/` and `sandbox/`, since seed scripts keep their own escapes.
- `capture-home.sh` builds and captures the landing page for both `pr-visual-checks.yml` and the frame refresh, and the `regen-web-*.ts` scripts write the committed previews and favicon

### `scripts/lib/`

Holds `ui.sh` alone, sourced and never executed. It provides the framed log lines and the color palette, and holds no picker, which lives in `src/cli/ui.ts`.

- Sourcing it under bash below 4 exits with `brew install bash` instructions
- `open_timeline` and `close_timeline` frame stderr, paired with `trap close_timeline EXIT`. `log_*` writes stderr and data goes to stdout, so output pipes clean.
- `set_palette <fd>` is the one place a bash escape is spelled, and it answers per stream. A writer declares the six palette names `local` and calls it for fd 2 at write time.
- A consumer framing to stderr with a bare `echo` does the same, placed after any branch that calls a help function, since dynamic scoping hands a callee what its caller declared
- A TypeScript command that a bash caller invokes owns its frame and takes `--nested` to suppress it, as `canon gate run` and `canon tooling inject` do

### `scripts/eval/`

Holds the frozen records of a retired test that asked whether a session that never saw an artifact can author a conforming one from it. The runner was deleted and is restorable from git history.

- Each record opens with a banner refusing edits, so a sweep excludes them and a path inside one that no longer resolves is the record working
- `result-context.md` and `result-wireframes.md` refuse every edit, while `result-seed.md` refuses only its quoted and machine-derived blocks
- A restored run spends real money, and the operator authorizes the spend while the session performs the run
- A fixture a headless run is pointed at lives outside the repository under `mktemp -d`, since a session beneath the project root loads its `CLAUDE.md`, rules, and context
- `ledger.md` takes one appended row per run, with its table last in the file

### Other folders

The scenario tree sits outside this folder.

- `sandbox/` holds the scenario tree `canon sandbox` provisions from, described in `canon/context/sandbox/index.md`

## Gotchas

- Sweep a deleted bash file's callers by path (`source`, `exec`, `bash <path>`) and never by function name, which undercounts. A name audit found 2 callers of `lib/inject.sh` where 17 existed.
- A gate walking a root that is missing passes with nothing walked, so probe it by removing the input root as well as by planting a violation
- Quoting a pathspec changes what it matches, so `git diff -- 'claude/skills/*/references'` returns nothing for a modified file. Append `/*` or name the directory literally in a hand-run scope check.
- `canon markdown audit --json` writes no record outside a git repository, so a consumer reading it needs the whole payload before it trusts a field
- A harness that reports writes by diffing one directory cannot see a write outside it, and the sandbox harness shares it. Read the transcript beside the file list and clear the stray path.
