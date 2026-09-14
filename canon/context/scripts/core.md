---
title: Core scripts
description: Repo maintenance scripts, the guard stages check fires, and the bare-flag repair that runs ahead of them
---

# Core scripts

`scripts/core/` holds repo maintenance: the scripts a contributor runs by `bun run` name and the guard stages `check` fires on every push. Nothing here is a `canon` verb, so the catalog below is the discoverable surface.

What sequences those guards is not here. `bun run check` resolves to `canon gate run`, and the stage table, the changed-file scoping, and every threshold comparison sit in `src/gate/`, described in `canon/context/development/gates.md`. Each check stayed the script it already was, so this folder is what the gate runs rather than what decides when to run it.

## The catalog

- `bootstrap.sh`, run as `bun run bootstrap`: installs deps, links the CLI globally, and appends the Claude Code aliases to `~/.zshrc`. Idempotent and re-runnable, which cuts both ways on the alias block: `install_aliases` returns at the marker check, so growing the canonical block reaches nobody who already ran it until they delete the marked block and re-run
- `update.sh`, run as `bun run update`: interactive dep update via `bun update --interactive`, then `canon gate run --nested`
- `clean.sh`, run as `bun run clean`: wipes `node_modules/`, clears bun cache, reinstalls from lockfile
- `snapshot.sh`, run as `bun run snapshot`: writes the project file tree to `.canon/tmp/project/PROJECT-SNAPSHOT.md` for Claude chat context, framing entirely to stderr
- `regen-indexes.sh`: thin wrapper calling `canon indexes regen` by path so a linked worktree uses its own CLI
- `regen-hero.sh`: fills every `assets/captures/*.html.tmpl` and writes the `.html` beside it. The catalogs supply the counts so no figure on the README frame is hand-maintained, and `canon design css --no-components` supplies the palette so neither frame carries its own copy of a hex. Clone-only, and it writes the HTML while `canon capture` renders each image and stamps both sides with a digest.
  - The name says hero because the hero was the only template when it was written. Every citation across `docs/`, `canon/context/`, and `src/` spells that name, so the file keeps it and the loop covers whatever the folder holds. A template naming a placeholder nothing fills fails the run rather than shipping the literal braces.
  - The catalogs reach `bun --eval` as files under a `mktemp -d` rather than as environment variables, because Linux caps a single env entry at 131,072 bytes and `standards list --json` crossed it at 136,227 once two standards landed, up from 114,813
  - The failure is `execve` returning E2BIG, which reports `Argument list too long` and names no catalog, so it reads as a broken interpreter rather than as a payload that outgrew its channel. A file path is bounded whatever the catalogs grow to.
- `check-skill-paths.sh`: fails when a file under `claude/skills/` references a `wiki/` path, which resolves to nothing in a target
- `check-plugin-boundary.sh`: walks `claude/` with symlinks followed and fails when a shipped file resolves under `internal/`
- `check-seed-independence.sh`: walks the `.md` under every root `collect_seed_roots` discovers and fails on `canon` not immediately followed by `/`, so seed prose a target reads as instruction about itself never names a binary that target may not have. The walk is scoped to `tooling/*/seeds/` alone, so a citation landing in `governance/rules/` passes CI unflagged even when the rule carries content moved out of the seed and ships to every target the same way, and a moved bullet's independence has to be checked by hand against the same standard.
  - The regex matches the substring inside any word starting `canon` and continuing with something other than a slash, so "canonical" trips it exactly as `canon` alone would. Seed prose describing something as a "canonical doc" reads as a citation of the CLI binary, so write around the word rather than adding it to a seed file.
- `check-color-source.sh`: walks `scripts/` and fails when any `.sh` other than `scripts/lib/ui.sh` spells an SGR escape, so one answer sits behind every bash writer
- `check-ignore-parity.sh`: compares the record-root patterns in this repository's `.gitignore` against the `# Claude` array the claude manifest ships, so the ignore set a target receives cannot drift from the one the toolkit runs on. The comparison is exact and carries no exception list, which the move to `.canon/` is what allowed, and `canon/context/tooling.md` carries why the comparison exists
- `repair-bare-flag.sh`: sources `repair_bare_flag` and runs it, which is how the gate reaches that rule without holding a second copy of the guard that spares a genuinely bare repository
- `list-seed-roots.sh`: prints every `tooling/*/seeds` carrying a `.claude/`, which is how the seed-standards stage reads the same discovery `check-seed-independence.sh` reads

## What the hero frame chooses and what it samples

`regen-hero.sh` carries a `FEATURED_SKILLS` list of ten chosen names for the skills column rather than sampling it, because an even sample lands on the entries closest to commodity and on none of the workflow the toolkit exists to carry. The run fails when a chosen name is absent from the catalog or when the list is not exactly `LISTED` long, so renaming or retiring a shipped skill breaks the Hero stage until the list is updated. The length assert is not decoration: `SKILL_MORE` counts down from `LISTED` rather than from the number of names rendered, so a list of any other length prints a remainder wrong by the difference.

The rules column still samples, but only over rules a stack names. A rule no stack reaches is opt-in behind `--add`, and featuring one advertises an entry an ordinary `canon gov install` never delivers. The standards column samples the whole catalog, because three of the top four cited standards already appear and a second hand-kept list buys one swap for the same staleness. Every count and every `+N more` reads the whole catalog either way, so curation governs which names appear and nothing else.

The command count in the stats row reads `grep -c '^import { register as ' src/cli.ts`, since the commands have no `--json` catalog and `--help` is hand-authored ASCII that drifts from what is registered. A command added without that import shape leaves the frame's count low and nothing reports it.

## Reading a JSON payload from bash

`bun --eval` exits 0 when its script throws while stdin is a pipe, and exits 1 on the same throw with no pipe attached, measured on Bun 1.3.14. A script piping a catalog into it and branching on `$?` therefore reads a parse failure as a success. A throw also prints nothing, so the empty output then reads as whichever clean result an empty string means, which is how a broken catalog reports as a clean sweep.

Print a sentinel from inside the eval and branch on that instead, covering a payload that is not JSON and a payload missing the key on one path. The `stale` grep idiom the drift assertions use does not reach an array of names, which is what forces the sentinel where a script still needs one.

No stage carries either shape. Every reading that needs a payload runs through `src/gate/measures.ts`, where a `try` around `JSON.parse` separates the two states with nothing to carry between processes, and the guidance above stays here for the next script that reaches for the interpreter.

## Verification

CI runs every stage through `bun run check:ci`, which passes `--all`. The local run scopes shell, types, and tests to the changed-file set, so it is the weaker of the two. See `canon/context/ci.md`.

`repair_bare_flag` runs ahead of every stage rather than as one of them, because Claude Code's worktree entry leaves `core.bare` set in the shared config and that flag breaks the git reads that scope the run. It writes only when the flag is set and the repository's common dir is named `.git`, which spares a genuinely bare repository that keeps its objects at the root. `session-worktree` carries the same repair at entry, and this copy covers the entries that never go through the skill. See `canon/context/claude-plugin/skill-procedures.md` for the split and `wiki/claude/claude-worktrees.md` for the upstream issue.

It lives in `scripts/lib/worktree.sh` rather than inline in the gate so `src/worktree-repair.test.ts` can source it, which is the one bash function in the repo under test. `scripts/core/repair-bare-flag.sh` is the two-line caller `canon gate run` reaches it through, which is what kept the rule in one place when the sequencing moved into TypeScript. The function takes its target root as an argument defaulting to `PROJECT_ROOT`, since a test cannot set that for a sourced function without leaking it across cases. The test builds six repository shapes and the `basename` guard is what it exists to pin: deleting that line leaves five cases passing and fails only the genuinely-bare one, which is the case where an unguarded repair does damage. Tests gate on `^src/` locally, so an edit to the lib alone runs them only under `check:ci`, which passes `--all`.

The test strips every inherited `GIT_*` variable before building its fixtures. Git hooks export `GIT_DIR`, so the suite passed standalone and failed under `pre-push` until it did: `git -C real-bare.git` resolved against the toolkit's own repository rather than the fixture, and the genuinely-bare case reported the wrong flag. Any future test that shells out to git needs the same scrub, and the failure is invisible to a normal `bun run test`.

### Stage gotchas

- Nine stages call this checkout's CLI, and each reaches it through `cliRunner` in `src/gate/sequencer.ts` rather than through a globally installed `canon`, which resolves to the main checkout no matter which worktree is running and would have the gate measure the wrong tree.
- Every stage pays its own process, the CLI ones a bun startup apiece, which is what the shell script paid too. The stages calling the CLI sit together in `STAGES` for the ordering that buys a reader, not for any saved startup.

### The seed-standards stage

- The seed-standards stage discovers its roots rather than listing them, reading `scripts/core/list-seed-roots.sh` for the same `collect_seed_roots` walk `check-seed-independence.sh` reads, so a new stack is covered without an edit to either caller and the two cannot disagree about which roots exist.
- It reports the entries it measured per root and warns on a root that measured none, rather than printing one verdict for the set. A root can resolve an audited folder and hold no entry in it, which `tooling/claude/seeds` does today, and a single pass line over that reads as coverage of a tree nothing opened.
- The count comes from `--gate --json`, whose record lands on stdout while the frame stays on stderr, so a passing run prints the counts alone and a failing one is re-run for its frame
- It branches on the audit's exit code rather than on pass against fail, because 1 and 2 mean opposite things there. 2 is a seed breaking the standard it seeds and fails the push. 1 is the audit refusing, which a seed root carrying a `.claude/` but no audited folder produces, and it warns instead, rather than red-failing a stack that seeds nothing a standard governs.
- The measure reads the exit code as a value, so nothing here discards a non-zero exit with `|| true` the way a `set -e` shell script would otherwise need to.

### The plugin boundary stage

- `check-plugin-boundary.sh` collects violations and passes on an empty collection, so a missing `claude/` or a missing `realpath` would report the boundary clean or blame a leak for an absent tool. Both are guarded up front and exit 1 naming the cause. Anything added to that walk needs the same treatment, since a producer that fails and a tree that is clean both arrive as zero rows.

`check-ignore-parity.sh` takes it on both sides of its comparison, since an unreadable `.gitignore` and an array the parse missed each arrive as an empty list that satisfies parity vacuously. It stays a standalone script rather than folding into the gate's own TypeScript, since it is the check itself rather than the sequencing around it. A standalone script takes `PROJECT_ROOT` from the environment and a Vitest file points it at a fixture tree, which is the shape `src/worktree-port.test.ts` already uses against a seed script.

`check-color-source.sh` takes that treatment too, exiting 1 when `scripts/lib/ui.sh` is absent rather than reporting a tree it never measured. Its walk stops at `scripts/` on purpose, since the seed scripts under `tooling/*/configs/scripts/` have to keep escapes of their own: a target that installs them has no shared library to source. It matches SGR alone, which leaves the cursor and erase sequences an interactive prompt writes legal.

A walk built on `find -L claude/ -type f` inside a process substitution whose status nothing reads can pass silently on a missing root: a missing `claude/` makes `find` fail, the loop runs zero times, and the guard exits 0 without walking anything, which reads as verified once a planted violation turns it red. Proving a gate goes red on a planted violation does not prove it goes red when its input never arrives, so the right probe for a collect-and-pass walk is removing the input root, not only seeding a violation inside it. The same shape reaches a consumer reading structured output: both standards-audit hooks read findings out of a `canon markdown audit --json` record, and the verb writes no record at all outside a git repository, so a hook can report a file clean that it never checked. Assert the whole payload arrived before reading any field out of it.

### Quoting a pathspec changes what it matches

Quoting a glob passed to `git diff --` changes what it matches. `'claude/skills/*/references'` quoted returns nothing, because git pattern-matches the whole path and a file one level deeper never matches, while unquoted the shell expands to real directory paths and a literal directory pathspec does cover its contents. Reproducing the skill-references gate by hand returned an empty set against a file that was in fact modified, which reads as proof the file sits outside scope. The gate passed the glob straight to git, saw the file, and failed. That hazard is a hand-run one now rather than one the gate carries: a `drift` check in `src/gate/stages.ts` spells its pathspec as one argument and no shell ever sees it, so what git receives is what the table says. Append `/*` or name the directory literally when a hand-run scope check is what is wanted.

### The poll compares snapshots rather than reading the remote

`role-orchestrator/scripts/poll.sh` compares the open list against a baseline at `.canon/tmp/pr-poll/baseline.txt`, so `No movement.` is a claim about two snapshots rather than about the remote. A merge is reported on the run after it lands, and a pull request that opens and closes inside one interval never enters the baseline and is never reported: two did exactly that inside a single three-minute interval and the poll emitted no line for either, while two others merged and reported `GONE` on the following run after the sweep had already been done by hand. Cancelling and restarting the loop leaves the old baseline in place, so the first run afterwards replays every state change since the cancel. The same snapshot reading makes a `RESPONSE` line say nothing about whether a response is still open, since the comparison never runs against the review it would be triggering, so a worker reply a later review already superseded routes to a re-review whose delta is empty. Read `main` and `gh pr list` directly before any sweep or handoff.

See `canon/context/scripts/framing.md` for how UI framing crosses the exec boundary these stages sit on.
