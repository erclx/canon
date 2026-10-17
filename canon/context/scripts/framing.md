---
title: UI framing
description: Which domains still shell out, who opens the timeline frame once a dispatcher is gone, and the stream contract framing rests on
---

# UI framing

Every `canon` command prints inside one timeline frame, and the frame has to survive a call crossing from TypeScript into bash and back. This file holds where that boundary sits and which side owns the frame at each crossing. The output shape is in `docs/agents/output-shape.md`.

## Decisions

### The exec boundary

No domain has a dispatcher. Each command file handles its verbs in TypeScript and shells out for a few.

- `src/commands/tooling.ts` handles `sync`, `inject`, `prune-gitignore`, and `list`, and shells out for `ref`, `create`, and `verify`
- `src/commands/gov.ts` handles `install`, `sync`, and `build`, and shells out for `list` alone
- `src/commands/standards.ts`, `src/commands/docs.ts`, and `src/commands/claude.ts` are TypeScript end to end

A migrated list verb has to open the frame itself. The bash verb never emits `┌`, so a baseline captured by running the script directly matches a frameless port exactly, while the migrated verb loses the header a pass-through dispatch would print. Capture equivalence baselines at the boundary the user invokes.

`claude seeds list` is a real Commander subcommand, since its script sits at `scripts/claude/seeds-list.sh` outside the `scripts/<domain>/<verb>.sh` shape a pass-through assumes. The parent `seeds` command keeps an action handler so an unknown or missing subcommand still reports the two errors a bash `case` would emit.

### Frame ownership

The TypeScript command layer opens the frame above a pass-through, since a bash verb script closes a frame it never opened. `src/commands/gov.ts` calls `intro('canon gov')` before it execs one, and skips the call when the args carry `-h` or `--help`, since a help screen prints its own frame.

- A TypeScript command that both bash and users invoke owns its frame and takes `--nested` to suppress it
- `canon tooling inject` frames itself so direct invocation emits no dangling `│` lines, and the tooling sandbox scenarios pass `--nested` because they have already opened one
- `canon gate run --nested` makes the same split for a caller with a frame of its own
- `src/cli/ui.ts` mirrors `lib/ui.sh`, so a migrated domain keeps the same frame and the same color inside it

When both sides of a call are TypeScript the flag is not needed. `canon claude` calls `injectGitignore` directly inside the open frame rather than shelling into `canon tooling inject --gitignore --nested`, which drops a process per invocation.

### The first option is what a headless run takes

`select({nonInteractiveDefault})` returns the first option under `CANON_NON_INTERACTIVE=1`, so an option list ordered for a human decides what an agent does. A first entry like `Commit and open PR` would make a headless run open a pull request on the target's repository unconfirmed.

Ask what the first option does rather than whether the list reads well. Reordering is enough for a local write. An action reaching outside the machine refuses headlessly and reports what it would have done, which is what `runGitWorkflow` and the standards sync refusal both do.

## Gotchas

### Hidden contracts

The stream split decides how output pipes, and `exec` decides who owns the traps.

- The frame opens in the dispatcher rather than in each subcommand, since prompts and `log_*` assume one is open and opening it first prevents dangling output on error paths
- `log_*` writes to stderr and data goes to stdout, so JSON and lists pipe clean through any wrapper. This is why `--help` is the one exception that prints to stdout.
- `exec` drops the parent trap, so every subcommand re-arms `trap close_timeline EXIT` before any early exit, including `--json` paths
- Subcommand scripts never emit their own `┌`, since a second one produces two frames per invocation

### Color and palette

The color opt-out crosses the boundary by each side answering for itself. `src/cli/exec.ts` runs a delegated script under `stdio: 'inherit'`, so no parent can filter a child's stream and the child reads `NO_COLOR` and its own `[ -t <fd> ]`.

- `set_palette <fd>` in `scripts/lib/ui.sh` is the only place a bash escape is spelled, and it asks per stream rather than once per process
- Every writer in that file declares all six palette names `local` and calls it for fd 2 at write time, so a redirect applied after sourcing still gets the right answer
- A source-time call answers for stdout, the stream 112 of 125 palette reads across 13 consumer scripts reach with a bare `echo`
- The blank palette keeps every frame character and drops only the escapes

A consumer framing to stderr with a bare `echo` declares the six names `local` and calls `set_palette 2` at the top of the function. Without that, a run piping only its data emits a frame colored where a `log_*` writer drew it and plain where the script drew it.

Place the declaration after any branch calling a help function, since dynamic scoping hands a callee whatever the caller declared. The 112 of 125 count is stale and wants a fresh reading.
