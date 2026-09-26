---
title: Overview
description: What a command owes, commander registration, migrating a domain off bash verb by verb, and the gotchas in wiring a command and testing one
---

# Overview

## Overview

Every `canon` verb is registered in commander and either handled in TypeScript or dispatched into a `manage-*.sh` script. This folder holds what decides which of the two a verb gets, what a migrated verb owes, and the rules a command follows once it is writing files or asking questions. The domain-wide layout and the gotchas crossing every command sit in `canon/context/cli/overview.md`.

## Layout

- `src/commands/` owns one file per `canon` subcommand, each one not yet migrated a thin pass-through to a `manage-*.sh` script

## Decisions

### Registration

- A migrated command defines its real option surface in commander rather than forwarding argv. `indexes` is the first, so a mistyped subcommand now fails with a suggestion instead of reaching a shell script. Every command still on bash carries `allowUnknownOption()` and parses nothing.
- Commands still on bash stay thin. A command file parses arguments and execs, so behavior changes land in the bash script rather than in two places.
- A flag that carries a default is still distinguishable from one the operator passed. `getOptionValueSource` reports `default` rather than `cli`, which is what lets `canon init` default `--stack` to `base` and keep prompting on a bare run. Read provenance rather than the value whenever a default and an explicit pass have to behave differently, since a value test collapses the two.
- A default belongs on the flag rather than in a branch behind an absent one. The default then shows up in `--help` where a caller can see it, and the resolver stays a single function both the preview and the step list call, so the two cannot disagree about what will install.
- The root program sets `helpOption(false)` for its own hand-rolled help, and subcommands inherit it. A migrated command re-enables help explicitly at each level or `--help` returns an unknown-option error.
- `sandbox.ts` is the exception that carries interactive select prompts before the exec, because the scenario picker needs the TS prompt surface. It also holds the sandbox reads that are not provisioning, with the report logic in `src/sandbox/` so the command file keeps only the framing. Each read is reasoned about in `canon/context/sandbox/index.md`.
- A `check` subcommand coexists with a pass-through parent by registering after it. `sandbox` keeps `allowUnknownOption` and `passThroughOptions` so `canon sandbox git:commit` still reaches `manage-sandbox.sh`, and commander resolves the named subcommand first. Adding a second such subcommand needs the same ordering.
- A bare positional and a subcommand coexist on one command: `canon docs list` resolves to the subcommand and `canon docs agents` falls through to the positional. This is what preserves the bash shorthand where any non-verb argument means `get`. A doc named after a verb would be shadowed, which the bash `case` did too. `canon standards <name>` takes the same shape, so a standard sharing a subcommand's name is the same trade there.
- The top-level help block is `COMMAND_GROUPS` in `src/help.ts`, which `renderHelp(stream)` frames only when `stream.isTTY === true` and prints without the frame glyphs into a pipe, keeping the same indentation and the same 80-column cut so the two forms carry identical text. Color follows `palette` and `NO_COLOR`, while the frame follows the TTY alone, so `NO_COLOR` on a terminal keeps the glyphs. It has five headings holding every registered command once, with each description cut to fit 80 columns rather than wrapped. The grouping duplicates the README's domain split and has no other source, and `src/help-option.test.ts` fails on a registered command with no row or a row naming no command, so a new command cannot ship unlisted. The test reads the printed block by spawning the CLI, and the web command field parses the same block, so a change to the row shape or the headings has to keep `commandNamesFromHelp` reading every row.
- Registering an action on a parent carrying subcommands replaces commander's own no-action fallback, which writes help to stderr and exits 1. `outputHelp()` defaults to stdout, so the bare path has to pass `{ error: true }` or the help block lands in the data stream.
- A topic resolves against two spellings, `<dir>/<topic>.md` and `<dir>/<topic>/index.md`, so a domain that outgrows one file keeps the name its callers already type. The file wins when both exist, and a folder with no `index.md` resolves to nothing because the catalog is what reaches the sub-areas. Both listers pin their own depth, so a split domain needs a folder pass added to each.

### Migrating a domain off bash

- A domain migrates one verb at a time. `tooling`, `gov`, and `snippets` register their migrated verbs natively and name each remaining verb as an explicit pass-through, which is what let each dispatcher be deleted before every verb had moved. Naming them, rather than falling back to `allowUnknownOption()` on the whole domain, keeps `--help` honest for the verbs that did move.
- The pass-through registration lives in `src/commands/pass-through.ts` and takes the domain name, since the loop is identical for every domain and only the banner and script path vary. Gov, snippets, and standards all call it. A verb whose script sits somewhere other than `scripts/<domain>/<verb>.sh` registers by hand instead.
- Whichever layer runs first opens the timeline frame, or the bash verb emits a closing `└` with nothing above it. Each pass-through calls `intro` before it execs for exactly this reason, which is the obligation a deleted dispatcher hands upward.
- A pass-through verb sets `helpOption(false)`. Commander resolves `--help` before the action runs, so leaving the built-in option on prints a one-line stub and hides the flag surface the bash script documents. Disabling it lets the flag reach the script, which owns that surface until the verb migrates.
- A step list takes its child-process factory as an argument. `src/init/steps.ts` does, so a test reads the list for its labels and argv without spawning anything.
- Tests run under `bun --bun vitest` rather than plain vitest. Migrated code uses `Bun.YAML`, `Bun.Glob`, and `Bun.$`, which do not exist in the Node runtime vitest defaults to.
- Bash that still needs a migrated capability shells into the CLI by path (`bun "$PROJECT_ROOT/src/cli.ts" ...`) rather than via the global `canon`, so a linked worktree exercises its own code.

## Gotchas

### Map a ported conditional to the matching predicate

Porting a bash conditional means mapping the operator to the matching predicate rather than to a bare existence check. `-d` is `isDirectory`, `-f` is `isFile`, and `-e` alone is what `existsSync` provides. A conditional ported as `existsSync` in place of a directory test resolves true against a same-named file, so `canon snippets install snippets.toml` crashes with an unhandled `ENOTDIR` wherever a directory of folders also holds a file of that name.

### Promoting a repo utility

A repo utility is promoted by reimplementing it in TypeScript under `src/<domain>/`, generalizing repo-specific paths to flags and leaving deeply-coupled layers behind as a follow-up. Both `canon slides` and `canon transcripts` reimplemented career-repo tools rather than lifting Python, which keeps the repo single-stack and covered by `bun run check`. Treat external binaries as user-installed dependencies the way `git` and `gh` already are, and drop repo defaults.

### A command module cannot be imported by a test

Logic under `src/commands/` that needs a unit test moves to a pure module under the domain folder, because a test importing a command file cannot run at all. `src/exec.ts` evaluates `resolve(import.meta.dir, '..')` at module scope and `import.meta.dir` is undefined under the vitest transform even with `bun --bun vitest`, so importing `@/commands/init` failed the whole suite with `paths[0] must be of type string` before a case ran. `src/commands/feedback.test.ts` targets `feedback-format.ts` for exactly this reason, and `flagsProvided` moved to `src/init/flags.ts` on the same grounds. Check whether the logic reaches `@/exec` or `@/cli-run`, move it to a sibling importing neither, and have the command file supply impure factories as arguments.
