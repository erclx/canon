---
title: Overview
description: What a command owes, commander registration, migrating a domain off bash verb by verb, and the gotchas in wiring a command and testing one
---

# Overview

## Overview

Every `canon` verb is registered in commander and either handled in TypeScript or dispatched into a `manage-*.sh` script. This folder holds what decides which, what a migrated verb owes, and the rules a command follows once it writes files or asks questions.

The domain-wide layout and the gotchas crossing every command sit in `canon/context/cli/overview.md`.

## Layout

- `src/commands/` owns one file per `canon` subcommand, each one not yet migrated a thin pass-through to a `manage-*.sh` script

## Decisions

### A migrated command defines its options

It defines its real option surface in commander rather than forwarding argv. `indexes` is the first, so a mistyped subcommand fails with a suggestion instead of reaching a shell script. Every command still on bash carries `allowUnknownOption()` and parses nothing.

Commands still on bash stay thin. A command file parses arguments and execs, so behavior changes land in the bash script and not in two places.

### Read provenance, not the value

A flag carrying a default stays distinguishable from one the operator passed. `getOptionValueSource` reports `default` rather than `cli`, which lets `canon init` default `--stack` to `base` and keep prompting on a bare run.

A value test collapses the two, so read provenance whenever a default and an explicit pass must behave differently.

### Defaults belong on the flag

A default in a branch behind an absent flag hides from `--help`. On the flag it shows there, and the resolver stays one function both the preview and the step list call, so the two cannot disagree about what will install.

### Help is re-enabled per level

The root program sets `helpOption(false)` for its hand-rolled help, and subcommands inherit it. A migrated command re-enables help explicitly at each level or `--help` returns an unknown-option error.

### The sandbox command

`sandbox.ts` carries the scenario picker and hands provisioning, `reset`, and `clean` to `src/sandbox/provision.ts`. It also holds the sandbox reads that are not provisioning, with the report logic in `src/sandbox/` so the command file keeps only the framing. `canon/context/sandbox/index.md` reasons about each read.

### A `check` subcommand registers after its parent

`sandbox` keeps `allowUnknownOption` and `passThroughOptions`, so `canon sandbox git:commit`, `reset`, `clean`, and the `--no-header` flag `canon sandbox run` passes all reach the provisioning action as words. Commander resolves the named subcommand first.

A second such subcommand needs the same ordering.

### A positional and a subcommand coexist

`canon docs list` resolves to the subcommand and `canon docs agents` falls through to the positional. That preserves the bash shorthand where any non-verb argument means `get`. A doc named after a verb would be shadowed, as the bash `case` did too.

### The top-level help block

`COMMAND_GROUPS` in `src/cli/help.ts` is the block. `renderHelp(stream)` frames it only when `stream.isTTY === true` and prints without the frame glyphs into a pipe, with the same indentation and 80-column cut so the two forms carry identical text.

- Color follows `palette` and `NO_COLOR`, while the frame follows the TTY alone, so `NO_COLOR` on a terminal keeps the glyphs
- Five headings hold every registered command once, each description cut to fit 80 columns
- The grouping duplicates the README's domain split and has no other source

### The help block is tested by spawning

`src/cli/help-option.test.ts` fails on a registered command with no row or a row naming no command, so a new command cannot ship unlisted. It reads the printed block by spawning the CLI.

The web command field parses the same block, so a change to the row shape or the headings has to keep `commandNamesFromHelp` reading every row.

### `--help --all`

`canon <verb> --help --all` prints the verb's help and every visible leaf's help below it, separated by a blank line alone, so a reader splits on the `Usage:` header.

`src/cli/help-all.ts` routes argv before `program.parse()` and captures each block through `outputHelp()`. `helpInformation()` leaves out the `addHelpText` blocks that carry every exit code and example.

### A bare `canon --help --all` prints the top help

Printing the whole tree there was rejected on cost, at about 47,000 tokens. A command with its help option disabled, such as `sandbox`, falls through to its own parse.

The `COMMAND_GROUPS` descriptions carry no subcommand hints, because a partial list misled and a full one cut at 80 columns for the largest groups.

### An unknown subcommand under `--help`

Commander answers `--help` before it resolves operands, so `canon <group> <unknown> --help` would print the group's help and exit 0. The router refuses with exit 1, only on a group that takes no operand.

A group with its own argument, its own action, or a default subcommand, such as `docs <topic>` or `inventory run`, still reads the word as an operand.

### Parent actions replace the fallback

Registering an action on a parent carrying subcommands replaces commander's no-action fallback, which writes help to stderr and exits 1. `outputHelp()` defaults to stdout, so the bare path passes `{ error: true }` or the help block lands in the data stream.

### Topics resolve two spellings

A topic resolves against `<dir>/<topic>.md` and `<dir>/<topic>/index.md`, so a domain outgrowing one file keeps the name callers type. The file wins when both exist, and a folder with no `index.md` resolves to nothing, since the catalog is what reaches the sub-areas.

Both listers pin their own depth, so a split domain needs a folder pass added to each.

### Migrating a domain off bash

A domain migrates one verb at a time. `tooling` and `gov` register their migrated verbs natively and name each remaining verb as an explicit pass-through, which let each dispatcher be deleted before every verb had moved.

Naming them, rather than falling back to `allowUnknownOption()` on the whole domain, keeps `--help` honest for the verbs that did move.

### A bash verb registers by hand

It calls `execScript` on its script. The shared pass-through helper went when its last two callers, `docs list` and `standards list`, moved to TypeScript.

### Pass-throughs open the frame

Whichever layer runs first opens the timeline frame, or the bash verb emits a closing `└` with nothing above it. Each pass-through calls `intro` before it execs, the obligation a deleted dispatcher hands upward.

### Pass-throughs disable help

A pass-through sets `helpOption(false)`. Commander resolves `--help` before the action runs, so the built-in option prints a one-line stub and hides the flag surface the bash script documents. Disabling it lets the flag reach the script, which owns that surface until the verb migrates.

### Step lists take their factory

A step list takes its child-process factory as an argument. `src/init/steps.ts` does, so a test reads the list for its labels and argv without spawning anything.

### The test runner

They run under `bun --bun vitest`, since migrated code uses `Bun.YAML`, `Bun.Glob`, and `Bun.$`, which the Node runtime vitest defaults to lacks.

Bash that needs a migrated capability shells into the CLI by path (`bun "$PROJECT_ROOT/src/cli.ts" ...`), not the global `canon`, so a linked worktree exercises its own code.

## Gotchas

### Map a ported conditional to the matching predicate

`-d` is `isDirectory`, `-f` is `isFile`, and `-e` alone is what `existsSync` provides. A conditional ported as `existsSync` in place of a directory test resolves true against a same-named file.

A domain install passed a manifest filename then crashes with an unhandled `ENOTDIR` wherever a directory of folders also holds a file of that name.

### Promoting a repo utility

Reimplement it in TypeScript under `src/<domain>/`, generalize repo-specific paths to flags, and leave deeply coupled layers behind as a follow-up. `canon slides` and `canon transcripts` reimplemented career-repo tools rather than lifting Python, which keeps the repo single-stack and covered by `bun run check`.

Treat external binaries as user-installed dependencies the way `git` and `gh` are, and drop repo defaults.

### A command module cannot be imported by a test

Logic under `src/commands/` needing a unit test moves to a pure module under the domain folder, since a command file pulls in the whole spawn and prompt layer.

`import.meta.dir` is undefined under the vitest transform even with `bun --bun vitest`. Evaluating it at module scope in `exec.ts` would fail the whole suite with `paths[0] must be of type string` on importing `@/commands/init`.

### Where the split lives

`PROJECT_ROOT` lives in `src/roots/project.ts` and derives from `import.meta.url`. `src/commands/feedback.test.ts` targets `src/feedback/body.ts`, and `flagsProvided` lives in `src/init/flags.ts`, on the same grounds.

Check whether the logic reaches `@/cli/exec` or `@/cli/run`, move it to a sibling importing neither, and have the command file supply impure factories as arguments.
