---
title: Core scripts
description: Repo maintenance scripts, the guard stages check fires, and the bare-flag repair that runs ahead of them
---

# Core scripts

`scripts/core/` holds repo maintenance, being the scripts a contributor runs by `bun run` name and the guard stages `check` fires on every push. Nothing here is a `canon` verb, so the catalog below is the discoverable surface.

`bun run check` resolves to `canon gate run`, and the stage table, the changed-file scoping, and every threshold comparison sit in `src/gate/`, described in `canon/context/development/gates/overview.md`. This folder is what the gate runs rather than what decides when to run it.

## Layout

### The catalog

Three scripts remain, and the five boundary checks live as measures in `src/gate/boundaries.ts`, described under the plugin boundary stage below.

- `bootstrap.sh`, run as `bun run bootstrap`, installs deps, links the CLI globally, and appends the Claude Code aliases to `~/.zshrc`
- `regen-hero.ts` fills every `assets/captures/*.html.tmpl` and writes the `.html` beside it. It is clone-only.
- `check-color-source.sh` walks `scripts/` and `sandbox/` and fails when any `.sh` other than `scripts/lib/ui.sh` spells an SGR escape, so one answer sits behind every bash writer

`bootstrap.sh` is idempotent and re-runnable, which cuts both ways on the alias block. `install_aliases` returns at the marker check, so growing the canonical block reaches nobody who already ran it until they delete the marked block and re-run.

### The hero regenerator

`regen-hero.ts` writes the HTML while `canon capture` renders each image and stamps both sides with a digest. The catalogs supply the counts so no figure on the README frame is hand-maintained, and `buildDesignCss` without its component half supplies the palette so neither frame carries its own hex.

- The name says hero while the loop covers every template in the folder, since every citation across `docs/`, `canon/context/`, and `src/` spells that name
- A template naming a placeholder nothing fills fails the run rather than shipping the literal braces
- Each catalog is read in-process through the module its verb calls, and the command count through `countCommands` in `src/counts/catalogs.ts`, so no catalog crosses an environment or file channel
- The pure half, every row builder and refusal, sits in `src/capture/frame-values.ts` with a test beside it, since `tsc` and vitest reach `src/` only
- The verb layer is skipped, so the checkout-mismatch warning from `gov list` and its siblings never prints, which is right since a script run by path cannot resolve to the main checkout

## Decisions

### What the hero frame chooses and what it samples

`src/capture/frame-values.ts` carries a `FEATURED_SKILLS` list of ten chosen names rather than sampling the skills column, because an even sample lands on the entries closest to commodity and on none of the workflow the toolkit exists to carry.

- The run fails when a chosen name is absent from the catalog or when the list is not exactly `LISTED` long, so renaming or retiring a shipped skill breaks the Hero stage until the list is updated
- The length assert matters because `SKILL_MORE` counts down from `LISTED`, so a list of any other length prints a remainder wrong by the difference
- The rules column samples only over rules a stack names, since featuring an opt-in rule advertises an entry an ordinary `canon gov install` never delivers
- Every count and every `+N more` reads the whole catalog, so curation governs which names appear and nothing else

The command count reads `grep -c '^import { register as ' src/cli.ts`, since the commands have no `--json` catalog and `--help` is hand-authored ASCII that drifts from what is registered. A command added without that import shape leaves the count low and nothing reports it.

### Reading a JSON payload from bash

`bun --eval` exits 0 when its script throws while stdin is a pipe, and exits 1 on the same throw with no pipe. A script piping a catalog into it and branching on `$?` reads a parse failure as a success, and the empty output then reads as a clean result.

Print a sentinel from inside the eval and branch on that, covering a payload that is not JSON and one missing the key on a single path.

- The `stale` grep idiom the drift assertions use does not reach an array of names, which forces the sentinel
- No stage carries either shape today, since every reading that needs a payload runs through `src/gate/measures.ts`, where a `try` around `JSON.parse` separates the two states

### Verification

CI runs every stage through `bun run check:ci`, which passes `--all`. The local run scopes shell, types, and tests to the changed-file set, so it is the weaker of the two. See `canon/context/ci/overview.md`.

The `core.bare` repair that runs ahead of every stage is TypeScript now, in `src/worktrees/bare-flag.ts`.

## Gotchas

### Stage process cost

Nine stages call this checkout's CLI, and each reaches it through `cliRunner` in `src/gate/sequencer.ts` rather than a globally installed `canon`. A global install resolves to the main checkout from any worktree and would have the gate measure the wrong tree.

Every stage pays its own process, the CLI ones a bun startup apiece. The CLI stages sit together in `STAGES` for the ordering that buys a reader, not for any saved startup.

### The seed-standards stage

The stage discovers its roots through `seedRoots` in `src/tooling/seeds.ts`, which the Seed independence measure imports as well. A new stack is covered without an edit to either caller, and the two cannot disagree about which roots exist.

- It reports the entries measured per root and warns on a root that measured none, since `tooling/claude/seeds` holds no entry in its audited folder and one pass line would read as coverage
- The count comes from `--gate --json`, whose record lands on stdout while the frame stays on stderr, so a passing run prints the counts alone and a failing one is re-run for its frame
- It branches on the exit code because 1 and 2 mean opposite things. 2 is a seed breaking its own standard and fails the push.
- Exit 1 is the audit refusing, as a seed root with a `.claude/` but no audited folder produces, and it warns
- The measure reads the exit code as a value, so nothing discards a non-zero exit with `|| true`

### The plugin boundary stage

`src/gate/boundaries.ts` holds five measures guarding what crosses from this repository into a target, being ignore parity, capability seeding, plugin boundary, seed independence, and skill paths. They read the tree in-process and report `unmeasured` wherever the walk covered nothing.

- A failed producer and a clean tree both arrive as zero rows, so a missing `claude/`, `.gitignore`, or parsed array each report unmeasured instead of a pass
- Anything added to a walk there needs the same treatment
- Unmeasured warns on a contributor's machine and refuses under CI
- The plugin boundary walk follows symlinks the way `find -L` did and tracks the real directories on its current descent, so a loop under `claude/` ends. A leak reports as `<path> -> <resolved>`.

### Seed independence

The measure matches `canon` not followed by `/`, so "canonical" trips it exactly as `canon` alone would. Write around the word in seed prose rather than adding it to a seed file.

The walk is scoped to `tooling/*/seeds/` alone. A citation landing in `governance/rules/` passes CI unflagged even when the rule carries content moved out of a seed and ships to every target the same way, so check a moved bullet's independence by hand against the same standard.

### Walk and failure reporting

Capability seeding lists a source folder the way a shell `*` did, skipping dotfiles and directories, so `.husky/_` is never read as an unseeded capability.

- Hook wiring compares whole path segments across every `command` at any depth of the seeded `settings.json`
- A `settings.json` that does not parse is a failure rather than unmeasured, since it is a broken file in the tree and not a missing input
- A failing measure keeps its `failure` to the stage's one line and returns the header, offender lines, and remediation as an `output` emission, so the `--json` record's `failure` stays one line

### The ignore parity measure

Ignore parity is a measure rather than a standalone script, since every check in the set is a reading with a verdict. The standalone shape cost a second manifest parser (an awk over TOML where `Bun.TOML` was available) and a bash-exec test file per script.

`ignoreParity` reads the same `# Claude` array through `Bun.TOML` and refuses an empty read on both sides of its comparison, since an unreadable `.gitignore` and a missed array each arrive as an empty list that satisfies parity vacuously.

- Its test points the measure at a fixture tree with a `MeasureContext` whose `run` and `cli` throw, the shape `documentCeiling`'s tests use

### The color check

`check-color-source.sh` exits 1 when `scripts/lib/ui.sh` or either walked root is absent rather than reporting a tree it never measured.

- Its walk stops at `scripts/` and `sandbox/` on purpose, since seed scripts under `tooling/*/configs/scripts/` keep their own escapes and a target has no shared library to source
- It matches SGR alone, which leaves the cursor and erase sequences an interactive prompt writes legal

### Probe a gate with its input missing

A collect-and-pass walk can pass silently on a missing root. A `find -L claude/ -type f` inside a process substitution whose status nothing reads fails on a missing `claude/`, the loop runs zero times, and the guard exits 0 having walked nothing.

- Planting a violation proves a gate goes red when it sees one, not when its input never arrives, so remove the input root as well
- A consumer reading structured output has the same shape, since `canon markdown audit --json` writes no record outside a git repository and a hook can report a file clean that it never checked
- Assert the whole payload arrived before reading a field

### Quoting a pathspec changes what it matches

Quoting a glob passed to `git diff --` changes what it matches. `'claude/skills/*/references'` quoted returns nothing, because git pattern-matches the whole path and a file one level deeper never matches, while unquoted the shell expands to real directory paths.

A hand-run scope check with the quoted form returns an empty set against a modified file, which reads as proof the file is out of scope. The gate does not carry the hazard, since a `drift` check in `src/gate/stages.ts` spells its pathspec as one argument no shell sees. Append `/*` or name the directory literally for a hand-run check.

### The poll compares snapshots rather than reading the remote

`role-orchestrator/scripts/poll.ts` compares the open list against a baseline at `.canon/tmp/pr/poll/baseline.txt`, so `No movement.` is a claim about two snapshots rather than about the remote.

- A merge is reported on the run after it lands, and a pull request that opens and closes inside one interval never enters the baseline
- Cancelling and restarting leaves the old baseline, so the first run afterwards replays every state change since the cancel
- A `RESPONSE` line says nothing about whether a response is still open, since the comparison never runs against the review it would be triggering
- A worker reply a later review already superseded therefore routes to a re-review whose delta is empty
- Read `main` and the REST open list (`gh api --paginate 'repos/{owner}/{repo}/pulls?state=open'`) directly before any sweep or handoff

See `canon/context/scripts/framing.md` for how UI framing crosses the exec boundary these stages sit on.
