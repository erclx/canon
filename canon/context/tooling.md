---
title: Tooling
description: Stacks, configs, seeds, references, manifests
---

# Tooling system

## Overview

Owns the golden configs a project inherits, layered across a `base` to `web` to framework chain where each layer ships only its own slice. A stack is a folder holding configs, seeds, a manifest, and a reference. Sync auto-discovers new stacks, so adding one requires no infrastructure change.

## Layout

- `tooling/<stack>/` owns one stack, always with a `manifest.toml` and a `reference.md`
- `tooling/<stack>/configs/` owns golden files that always overwrite on sync
- `tooling/<stack>/seeds/` owns user-owned files that sync preserves
- `tooling/claude/` owns storage for `canon claude`, excluded from stack discovery
- `src/tooling/` owns the manifest walk, scan, injection engine, and the reference resolver, in TypeScript
- `scripts/tooling/` owns the create and verify subcommands, still bash

| Stack        | Extends | Ships                                                                     |
| ------------ | ------- | ------------------------------------------------------------------------- |
| `base`       | -       | Universal: prettier, cspell, commitlint, husky, shell                     |
| `web`        | base    | Web-universal: ESLint, Vitest, Playwright, Tailwind, CI, screenshots      |
| `vite-react` | web     | Framework glue: vite.config, vitest.config, playwright.config, tsconfig   |
| `astro`      | web     | Framework glue: astro.config, getViteConfig vitest, astro-aware eslint    |
| `nextjs`     | web     | Framework glue: next.config, plain-defineConfig vitest, App Router eslint |
| `python`     | base    | `uv` runtime plus ruff, mypy, pytest, and coverage sidecars               |
| `cloudflare` | -       | Parameterized Cloudflare Pages deploy workflow, no deps or scripts        |

## Decisions

- Configs overwrite and seeds are preserved. The boundary is structural versus user-extensible: linters and formatters with no project-specific surface ship as configs, while files projects routinely extend (`cspell.json`, `.lintstagedrc`) ship as seeds.
- An overwrite needs authority a caller states. `runSync` resolves a write mode through `resolveWriteMode` in `src/commands/tooling.ts`, where `--check` reports, `--write` applies, a TTY prompts, and a headless caller with neither flag reports and exits 1. The install stamp follows the same authority, so a run with none leaves `canon/config/config.json` alone rather than recording a sync it never performed. A confirm prompt carrying `nonInteractiveDefault` reads silence as consent, which is what made `CANON_NON_INTERACTIVE=1` mean apply-all and cost a real target its deploy job and a shipped harness.
- The overwrite contract names every config path rather than the category. `scripts/core/regen-tooling-paths.sh` writes the block in `claude/skills/canon-cli/SKILL.md` from `canon tooling list --json` crossed with each stack's `configs/`, and `bun run check` asserts it against the tree. Reading the list from the verb rather than from a directory walk keeps an excluded stack out of a contract about what that verb does.
- Stack-specific configs override the extends chain. `scan` in `src/tooling/scan.ts` walks the current stack first, and a file seen there blocks the same relative path from every parent layer.
- Which stack wins a duplicate differs by category, and the split is inherited rather than designed. Configs, seeds, and scripts resolve nearest stack first. Dependencies and gitignore entries resolve from the furthest ancestor inward. The TypeScript port preserved both directions rather than unifying them, because unifying would silently change what a target receives.
- `sync` dropped the `Review diffs` prompt branch. It was the only path that shelled out to `code --diff`, which is the behavior an earlier fix removed for headless callers, so rebuilding it would reintroduce the defect the migration exists to remove. Compare with git after syncing instead.
- Injection is reachable as `canon tooling inject <stack>` so `canon claude` and the sandbox can apply one stack without the scan and prompt. The excluded-stack guard sits on `sync` rather than in the shared path, which is what lets `canon claude` drive the `claude` stack through it.
- `python` extends `base` directly rather than going through `web`. It runs on `uv` instead of `bun`, so the web layer's assumptions do not apply.
- Dictionary seeds merge rather than copy-once. `.cspell/*.txt` accumulates project terms over time, so sync appends new entries and sorts. Every other seed type copies once and is then left alone.
- A word a new seeded config file spells has to land in that stack's own seeded dictionary, not this checkout's. The root `cspell.json` ignores `tooling/**` entirely, so this checkout's own spell check never reads a file under `tooling/*/configs/` or `tooling/*/seeds/`, and only a target that installs the stack and runs its own `check:spell` meets an unrecognized word there. Seeding `phase-label-gate.yml`'s `bunx -y @erclx/canon` invocation into `tooling/base/configs/` surfaced this: the sandbox scenario for `tooling/base` failed its own spell check until `erclx` was added to `tooling/base/seeds/.cspell/tech-stack.txt`.
- The reverse holds too. Stating a stack-specific word in `.claude/context/*.md` prose needs that word in this checkout's own root `.cspell/tech-stack.txt`, since the root `cspell.json` checks `.claude/context/` even though it ignores `tooling/**`. Measured 2026-09-04: adding `tsgolint` to `tooling/vite-react/seeds/.cspell/tech-stack.txt` alone left this file's own `check:spell` failing on the same word once this Testing section named it in prose.
- Seed markdown may not name the toolkit binary. `scripts/core/check-seed-independence.sh`, gated in `bun run check`'s Seed independence stage, greps every `tooling/*/seeds/.claude/**/*.md` file for the literal substring `canon` and fails the run if found. A seeded `.sh` hook that calls the toolkit CLI on purpose is exempt by extension, since scoping the walk by extension leaves it outside without an exemption list to maintain. A scaffolded project may not have `canon` installed, so seed prose describing an optional toolkit-CLI-backed capability states the capability rather than the binary, such as "a markdown-bans audit tool" rather than "`canon markdown audit`".
- Gitignore merging is additive only and existing entries are never touched, so a project can reorder or annotate its own ignores without sync fighting it.
- Scripts are never overwritten except through `[scripts.override]`, which exists for three cases: scaffolds that ship an anti-pattern by default, toolkit-owned wrappers whose body must stay in lockstep with the shipped shell scripts, and a key whose value the stack owns where the scaffold writes its own. `dev`, `preview`, and `lint` are the third case, since every scaffold that defines one of them keeps it through an ordinary `[scripts]` entry. `lint` lives at the `web` level rather than per-child, since the value is shared rather than framework-specific, unlike `dev`/`preview`, which differ by framework and live per-child instead.
- A served port derives from the working directory rather than from a literal. `scripts/worktree-port.sh` in the web layer prints a base plus an offset hashed from the worktree folder name into a band of 50, each server-starting script exports it, and every config adds it to the stack default. A claim file was the alternative and needs a lock. `strictPort` and Playwright's `reuseExistingServer: false` are what make a collision fail loudly, since a suite reusing whatever answers on the port reports a pass against another branch.
- A folder left under `.claude/worktrees/` after its worktree was removed is refused rather than served, closed against the one installed target on this stack, where two such folders derived the main checkout's port on all three bases. Git reports the parent repository from inside one, so the test separating a linked worktree from the main checkout passes it, and the collision arrives with no signal at all where the deliberate one arrives through `strictPort`. Location is what separates a leftover from an ordinary subdirectory, since neither is a registered worktree and the base port is correct for the subdirectory. Handing a leftover the same name-derived offset the registered worktrees take was the alternative, and it moves which port collides rather than reporting anything, on top of reintroducing the two-name collision the band of 50 already carries.
- The two shapes reach the base port through different branches. A folder whose own `.git` was deleted sends git upward and lands in the main-checkout test, and a folder whose `.git` names a pruned administrative directory makes git refuse outright and lands in the fallback that answers 0 for a plain directory. A fix keyed on either alone reaches one of them, so the second walks up from the working directory for a `.git` file naming a target that is gone.
- Every manifest call site grew a `&& export VAR &&` guard in the same change, because the refusal reaches nothing without it. The shipped form was `VAR=$(bash scripts/worktree-port.sh) <server>`, and an assignment prefix discards the exit status of its own substitution, so a refusing helper started the server with `VAR` empty and every config read that back as an offset of zero, which is the main checkout's port. Measured 2026-08-19 under `bun run` against all three forms: the prefix served 4321 and exited 0, and both guards refused and exited 1. The bare assignment carries the status where the prefix drops it, so the guard reads it and the export puts the value back in the environment the server inherits. Guarding with a throwaway first call was the alternative and it invokes the helper twice for the same answer.
- Targets already carrying the old copy keep the defect, recorded rather than chased. A seed is a file a project owns once installed, `canon tooling sync web . --write` replaces it, and nothing reports the drift until that runs. The accepted cost is an unsynced target serving the wrong port silently.
- The capture seed writes a folder per section holding one file per theme, rather than a flat `<name>-<state>.png`. A route's themes sit together, which is what makes the filename's embedded state suffix unnecessary. The `ROUTES` and `STATES` consts collapse into one `CASES` record where each entry is one output file. Measured at `d2c0281c`: the one target that adopted the seed had already converged on section folders split by theme.
- The seed ships no run-mode set. The one target that grew this seed carries four modes and they encode its deployment shape, which is the part that does not travel, so a mode set risks teaching a convention the next target abandons the way this one abandoned the flat layout. The seed ships the output path and the case record and says nothing about modes, leaving the choice per project.
- Server readiness stays in `scripts/screenshot.sh` rather than moving into the seed. The wrapper already builds, starts the preview, polls it for ten seconds, and refuses a port already in use, so lifting it into TypeScript rewrites working shell to satisfy the wording of an intake item rather than a defect.
- The sweep under `screenshots/` is gitignored and per-worktree. A linked worktree is its own directory, so it partitions by branch for free, unlike the review folder every skill writes to, which resolves against the main root and always overwrites. A `CaptureCase` flagged `evidence: true` breaks from that: its output under `evidence/` carries no hostname or worktree segment and commits, so a capture worth sharing reaches the pull request on its own rather than being attached by hand. `--require-base-url` skips a flagged case entirely, since a production smoke run should not overwrite the committed baseline with what a live deployment happens to render, and exits 1 rather than reporting success when that skip leaves zero cases run, since a template flagging every one of its cases would otherwise check nothing against a live host and say so nowhere. The golden template leaves one case unflagged for exactly this reason, so a fresh scaffold's `smoke:prod` always has a route to check.
- A first commit to `evidence/` is conditional on running the capture twice with no code change between the runs and confirming byte-identical output, since cross-restart determinism is unmeasured and the two-run check is what catches a flaky render locally before it reaches the pull request.
- `governance/rules/ui/440-surface-capture.md` fires on every component file rather than being scoped to routes and pages, since a component with no capture attached can carry a real defect unseen. Wide globs with the discrimination moved into the rule body is the route the widened rule takes: a component the production build strips out, such as a dev-only scaffold switcher, carries its own exemption in the rule body rather than sitting outside a narrower glob. The four sibling rules in that folder still scope by file extension alone, and this one keys on a path and states its exemption beside it. The accepted cost: a component that ships to production and renders no surface of its own, a provider or a layout wrapper, fires the rule too, since the exemption above reaches only what the build strips out. Measured at `64a4297b` on 2026-09-07.
- The config is the source, and the reference carries only what a config cannot express, such as anti-patterns and opinions.
- Stacks do not compose horizontally in the sense of two `extends` chains resolving at one root in a single `sync` call. Single-root polyglot in that sense is unsupported, and a monorepo uses the subfolder pattern instead. A second, orthogonal stack synced onto the same root as an existing chain is a different case and works today: `cloudflare` sets `extends = ""` and ships one config file with no dependency or gitignore entries, so a second `canon tooling sync cloudflare . --write` call at a root already carrying `astro` or `vite-react` collides with nothing in that chain. The unsupported case is one `sync` call resolving two `extends` chains at once, not two independent `sync` invocations for two unrelated concerns.
- `tooling/claude/` is storage, not a stack. It holds seeds, user-level config, and a minimal manifest consumed only by the `canon claude` CLI, so `TOOLING_STACK_EXCLUDE` keeps it out of discovery.
- The non-goal against shipping application code turns on the word application, and its own carve-out in `.claude/REQUIREMENTS.md` already reads configs, seeds, snippets, and rules
- Test files, an e2e spec, the screenshot template, and six shell scripts land executable non-config source in a target, and `injectManifest` in `src/tooling/inject.ts` runs `bun add -D` against it. The non-goal's build-exclusion carve-out is what covers this class: each of the four already-shipped test-infrastructure files proves out under it, since none reaches a target's production build.
- The scenario switcher component ships from `tooling/astro/configs/` rather than `tooling/web/` because `vite-react` shares the `web` parent and cannot parse `.astro` syntax. `vite-react` gets no equivalent until a React version is written against a real decision.
- A whole-stack install records the chain it resolved into `canon/config/config.json` through `recordToolingChain` in `src/tooling/stamp.ts`, which is what makes tooling drift measurable in `canon sync --check`. The write lands after the copies, so a partial apply that throws leaves the previous record rather than a claim the target does not meet.
- Rationale and the workspace-root refusal sit in `canon/context/cli/sync.md`

## Gotchas

- Commit golden config changes with `--no-verify`. Lint-staged runs against the template files themselves, not project source.
- `canon capture` and `bun run screenshot` both produce PNGs and overlap nowhere else. `src/capture/render.ts` drives Chromium over static HTML files and never a running app. Both are available in a target now that `src/capture` ships, so the two are told apart by what they point at rather than by which one an install carries.
- `bun run screenshot` is a web-stack config a target owns, and it builds that target, serves it, and captures the running application
- `scripts/screenshot.sh`'s `EXIT` trap guards `kill "$PREVIEW_PID"` the same way it guards the `wait` beside it, so a successful capture exits 0 regardless of whether `astro preview`'s detached background process has already exited by trap time. That exit-status guard leaves the port itself untouched: the trap also kills whatever `lsof -ti tcp:"$PREVIEW_PORT"` reports bound, between the pid-based kill and the wait, when `lsof` is on `PATH`. Otherwise it warns to stderr and falls back to the pid-only kill, since `lsof` appears nowhere else in this repository and a minimal container may not carry it. Killing by port is ordinarily safe against a bystander because the script's own preflight `curl` refuses the run if the port already answers before the preview starts, so anything found bound at teardown is a descendant of this run's own preview process. The one window that argument does not cover sits between that preflight and the trap's own installation, during `bun run build`: a bystander binding the port there would make this run's own preview fail to bind, the readiness loop time out, and the trap kill that bystander on the way out. `scripts/worktree-port.sh` deriving a distinct port per worktree is what keeps this narrow rather than routine. `src/screenshot-trap.test.ts` reproduces the pid race with a stubbed `bun run preview` that forks a detached child and returns immediately, asserting exit status on both a successful and a genuinely failing capture, and a third case binds a real socket from outside the tracked pid and asserts the port is unbound once the script exits. Measured 2026-09-06.
- The astro golden config's `@` alias resolves with `path.resolve('./src')`, which reads the invoking process's cwd rather than the config file's own directory. This is silently correct only when the consumer has its own `package.json` at the astro root and every script is invoked from there, which every stack the manifest assumes carries. A consumer running astro against `--root <subdir>` from elsewhere, with no `package.json` inside that subdir, gets the alias and every relative build path resolved against the wrong tree, with `dist/` and `.astro/` landing beside the wrong `package.json` and no error. Invoke astro with the shell's cwd already set to the project root instead of passing `--root` from elsewhere.
- An astro `public/` folder symlinked to a source elsewhere, the way the landing page points `web/public/assets/*.png` at the repository's own `assets/`, inherits the same cost `claude/standards` and `claude/snippets` already carry: a native Windows checkout without symlink support materializes each entry as a plain text file holding the relative path, astro copies `public/` into `dist/` verbatim, and nothing stages or builds notices, so the page renders a broken image with no error. A deploy that builds in CI on Linux is unaffected. The loss lands only on a contributor building locally on such a checkout.

### Manifest syntax

- The syntax invariants and the manifest-to-reference symmetry moved to `internal/rules/claude/595-tooling-reference.md`, which globs `tooling/*/manifest.toml` alongside `tooling/*/reference.md` so an edit to either side loads both. `internal/standards/tooling-reference.md` carries the symmetry in prose.
- A manifest edit shipping a stale reference is what widened that glob. The rule matched the reference alone, and the manifest is the side that moves first
- `runtime` is reserved and read by nothing today. `scaffold` is read only by `scripts/sandbox/tooling/upstream.sh`, not yet by `canon tooling sync`.
- Bun's script shell expands command substitution and a leading environment assignment, so a script value may carry `VAR=$(bash scripts/x.sh) command`. Verified 2026-08-13 against `bun run`.
- Both lists carry two entries, `.canon/` and `.claude/worktrees/`. A target that syncs and never runs `canon migrate records` stops ignoring records that are still under `.claude/`. `scripts/core/check-ignore-parity.sh` reads the whole file rather than one header, since a claude-scoped entry filed under a header of its own would read as missing from a list that carries it, and it drops the trailing slash so either side may be written without one. `.canon` is matched as a bare root as well as a prefix, since a pattern outside the case the loop matches on is one the check passes having compared nothing. It gates `bun run check` rather than reporting, because the manifest reaches every target on the next `canon tooling sync` and a drift between the two lists surfaces to nobody.
- No exception mechanism exists: a single root entry can withhold nothing inside itself, since the bare `.canon/` spelling admits no blanket carve-out. Written instead as `.canon/*`, a negation reaches only the folder it names, at one line per tracked folder, and a new folder stays auto-ignored under the wildcard regardless. `diagrams` stays in `DEFAULT_FOLDERS` in `src/context/folders.ts`, so the audit still covers a folder a project names, though a target now ignores its diagrams with the rest of its records rather than tracking them. `BACKED_FOLDERS` in `src/records/backup.ts` names `diagrams` regardless, so a target's own `canon records push` carries the folder either way.
- The comparison reads a closed set in both directions and is blind to a folder a shipped command creates that neither file names, since the baseline it reads is the closed set rather than the created one. Catching that second class means walking the commands for what they write under `.claude/`. A folder whose contents are committed on purpose belongs in neither file, which is why `.claude/canon/` is absent from both and correct.

### Sync and layering

- Syncing a monorepo subtree without `--skip base` re-drops husky per subtree. Git honors only one `core.hooksPath`, so the extra hook dirs silently break.
- `--skip base` relies on the layer boundary holding: repo-root-once configs live in `base`, per-root configs live in `web` and the adapters. Moving a per-root config into `base` would break the split.
- Non-`.txt` seeds are copy-once. To re-seed a structured file, delete it and sync again.
- Preserving a destination's mode moved to `internal/rules/core/096-operator-files.md`. `tooling/web/configs/scripts/verify.sh` is 644 while base ships 755, so a copy applying the source mode would strip the executable bit on the `web` and `astro` chains.
- `copyPreservingMode` in `src/copy.ts` is the implementation, sitting at the top level rather than in `src/tooling/` because the sync engine needs the same guarantee
- `Bun.Glob` skips dotfiles unless `dot: true` is set. Tooling configs are almost entirely dotfiles, so omitting it matches 4 of 14 files in `base` and fails silently.

### Seed ownership

- Whether a hook, a workflow, or a husky script installs turns on presence in its domain's seed or config source, gated by `scripts/core/check-capability-seeding.sh` and recorded in `canon/ARCHITECTURE.md` under "A capability's presence in a seed or config decides whether it installs, and a gate is exempt by kind".
- The base stack owns `canon/context/index.md` and the claude tree ships none, though it seeds three sibling indexes. Base owns it because it seeds the entries listed, and two trees writing one target path let install order pick the content, since neither installer overwrites a file the target has. Without one the tree is not auditable, since `resolveFolders` skips a folder lacking it.
- Per-stack `ci.md` and `development.md` seeds are not shipped, because seeds are user-owned and never overwritten. Stack references carry `## CI docs (extend)` sections telling the agent which rows to append instead.

`planSeeds` in `src/claude/seeds.ts` iterates a literal `SUBDIRS` array rather than listing the tree, so a folder added under `tooling/claude/seeds/.claude/` or `tooling/claude/seeds/canon/` is invisible to `canon init` while the sandbox still shows it, because `inject_seeds` in `scripts/manage-sandbox.sh` does a plain `cp -r` of the whole tree. The two paths disagree and the sandbox is the one that looks right. Pair every seed-folder addition with the `SUBDIRS` entry, an assertion in `scripts/core/install-check.sh`, and a run of `canon claude init` into an empty repo. The array order is also the install and timeline order, which `src/claude/seeds-list.test.ts` asserts against.

Two seed sources can write one destination, and nothing reports the collision: `canon init` runs base tooling before the Claude domain, and `pendingSeeds` skips any destination that already exists, so a Claude-domain seed for a destination the base stack's context seeds, under `tooling/base/seeds/canon/context/`, already fill is inert on the normal path and would only land, empty, on a bare `canon claude init`. Grep `tooling/*/seeds/.claude/` for the same destination path before adding a file, since the resolution is by domain order in `src/commands/init.ts` rather than by intent.

### The seed gate

- The seed tree is held to the standards it seeds by a `check` stage, not by a rule path. Widening the `paths` globs on the claude rules was the alternative and it fires only when a session happens to edit a seed, which leaves a seed nobody touches wrong indefinitely.
- The merge gate runs `context audit <root> --gate` against each `tooling/<stack>/seeds/` carrying a `.claude/` or a `canon/`, discovered per run through `scripts/core/list-seed-roots.sh` rather than listed, so a new stack is covered without an edit to the stage. A stack seeding only tracked surfaces carries `canon/` alone, which a `.claude/` test would drop from both seed stages.
- `check-seed-independence.sh` reads the token `canon` in seed prose as a CLI citation, and skips it where a `/` follows, since that spelling is the tracked surface root the seed installs rather than the binary
- The seed gate reaches only what the index-plus-entry contract covers, which today is `tooling/base/seeds/canon/context/`. The claude tree seeds four folders holding an `index.md` and no entries, so the gate measures their indexes and nothing else, and `ARCHITECTURE.md`, `DESIGN.md`, and `REQUIREMENTS.md` sit under no audited folder and stay out.
- Reaching those three needs an audit keyed to a document standard rather than a folder, which no command has
- A seed exempts itself from the section check with `stub: true` in its frontmatter, and both install paths strip the field so no target receives it. The exemption exists because the section check carries a false-positive class its own comment in `src/context/audit.ts` records: a standard may sanction omitting a section, and no measure separates that from a file that forgot it.
- Reporting is the right answer where the finding is advisory, and the seed gate makes it fail, so the tree needs a way to say an omission is deliberate
- No seed sets the marker today. Every skeletal seed is skeletal in its body and still declares each section its standard requires, which is what the gate measures. Marking one that already passes would switch off a live check for nothing, so the field stays unset until a seed genuinely has to omit a section.
- Stripping is duplicated across two install paths because the seed trees are, `injectSeeds` in `src/tooling/inject.ts` for the stacks and `applySeeds` in `src/claude/seeds.ts` for the claude tree. Both narrow to `.md`, so hook scripts and `settings.json` still copy byte for byte, and `src/seed-marker.ts` holds the one reader and the one stripper they share.

The citation gate resolves every context-entry path string against this repository's root, including lines instructing a target project about its own tree, so those pass only while the toolkit's layout matches the layout it seeds. Splitting a seeded domain into a folder breaks every citation site that names the domain's flat, target-facing path, since `tooling/base/seeds/` seeds a flat file and retargeting those citations to the split path would ship a path resolving nowhere into every scaffolded project.

Classify every citation site by whose tree it names rather than by its path before splitting a seeded domain. Keep the flat spelling on a target-facing line and suppress it with `<!-- audit-ignore-citations -->`, or reword to drop the path where a marker would ship into a file a target reads daily. The CI entry sits in this position now, since it seeds a similarly flat file.

### Seed independence

- `tooling/*/seeds/**/*.md` prose may not name the toolkit CLI token literally, not even in a line explaining what an installed rule's own command citation refers to. `scripts/core/check-seed-independence.sh` greps every seed markdown file for the string and fails the push on a hit, since a scaffolded project may not have the CLI installed. A line explaining a cited command names the capability instead, a toolkit CLI with its own commands, present only where installed.

## Manifest authoring

Each stack has a `manifest.toml` that controls what sync does. `[stack]` is the only required block.

```toml
[stack]
name = "stack-name"     # must match the folder name under tooling/
extends = "parent"      # parent stack to inherit from, empty string if none
runtime = "runtime-name"      # reserved: package manager for this stack (not active yet)
scaffold = "scaffold-command"  # bootstrap command, read today by sandbox/tooling/upstream.sh
```

```toml
[dependencies.dev]
packages = []

[scripts]
"script-key" = "command --flag"

[gitignore]
"# group-label" = ["pattern/", ".file"]
```

`[dependencies.dev]` injects into `devDependencies`, adding only missing packages. `[scripts]` injects into the `scripts` block, adding only missing keys. `[gitignore]` appends each group as a comment header plus one line per path. Group keys use single-word labels (`# VSCode`, `# Python`) so headers stay stable across renames.

`mergeSections` in `src/tooling/gitignore.ts` writes that header only when the whole group is missing from the target. A group the target already carries takes its new entries bare at the end of the file, so an entry added to a shipped group does reach an already-scaffolded project on the next sync, sitting detached from the header it belongs under. Presence is re-tested against the growing file and ignores a trailing slash, so `.canon/tmp` and `.canon/tmp/` count as one entry.

```toml
[verify]
prepare = "command to run after scaffold, before sync"
```

`[verify] prepare` declares a post-scaffold, pre-sync setup command for `canon tooling verify`. Use it for integrations that cannot ship as golden configs, such as astro's `bunx astro add react --yes`. Optional.

## CLI

| Command                   | What it does                                                    |
| ------------------------- | --------------------------------------------------------------- |
| `canon init`              | Bootstrap a project with base tooling and toolkit domains       |
| `canon tooling`           | Full sync: configs, seeds, deps, and gitignore entries          |
| `canon tooling reference` | Print a stack's reference doc. Reads, never writes.             |
| `canon tooling create`    | Create a new stack folder with stub manifest and reference      |
| `canon tooling list`      | Emit catalog of stacks with extends chain and dep summary       |
| `canon tooling verify`    | Scaffold into a temp dir, sync, then run the full project check |

Flags and arguments live in `docs/agents/index.md`.

Every stack-name lookup in `src/commands/tooling.ts` (`prepare`, `promptForStack`, `printReference`) resolves against `PROJECT_ROOT`, never the caller's working directory, because a stack is toolkit-authored and a target project never carries its own `tooling/` folder. `listStacks` called against a non-`PROJECT_ROOT` root returns an empty list from any real target rather than falling back.

## Common workflows

Bootstrap a new project with `canon init`, which installs base configs, Claude workflow, and governance in one command, and scaffolds an empty `.claude/wiki/`. Governance installs the `base` stack when `--stack` is absent, and `--skip governance` is the way to decline it. Neither standards nor snippets installs into a project, so neither carries a flag. The `setup-init` skill resolves the flags from project detection and runs the chain in one shot.

Sync tooling with `canon tooling` and pick stack and path. Pass `--skip <stack>` to drop a layer from the resolved chain. A stack's reference doc reads through `canon tooling reference <stack>` and takes no part in sync.

Set up a multi-language monorepo by letting the repo root own the `base` layer and giving each language its own subfolder:

```bash
canon init                                              # base at the root
canon tooling sync vite-react ./frontend --skip base --write
canon tooling sync python ./backend --skip base --write
```

`--skip <stack>` removes the named layer and its parents across configs, seeds, deps, scripts, and gitignore. Each subtree still gets its own language configs, and its own stack reference reads through `canon tooling reference <stack>`.

## Testing

`canon tooling verify <stack>` is the end-to-end validator. It scaffolds fresh into `.canon/tmp/verify-<stack>/`, runs the optional `[verify] prepare` hook, invokes `canon tooling sync <stack> . --write`, then executes `bun run lint:fix`, `bun run check`, `bun run test:e2e`, and `bun run screenshot`, asserts screenshot artifacts, and reports a pass/fail matrix. The tmp dir auto-removes on success. Use `--keep` to inspect a green run, or rely on the auto-preserve on failure.

Run it after any change to `tooling/<stack>/configs/`, a manifest, or the sync logic in `src/tooling/`.

The stack it names has to be one that scaffolds. `canon tooling verify web` refuses with `Stack 'web' has no scaffold command in manifest.`, because the web layer is a shared parent rather than a stack that scaffolds, so a change to `tooling/web/configs/` is validated through its two consumers, `vite-react` and `astro`, rather than through the layer that owns the edited file. The instruction above names the folder edited and not the stack that can run, which is the gap a session editing a parent layer falls into. Measured 2026-08-14.

The scaffold and sync phases are confirmed against local source. The phases beyond them are not confirmed to pass on this machine.

The six words that block `check:spell` sit in the seed that introduces each one: `errexit`, `esac`, and `regen` in `tooling/base/seeds/.cspell/tech-stack.txt` (from `.husky/post-merge` and `.lintstagedrc`, both `base` configs), `cksum` and `toplevel` in `tooling/web/seeds/.cspell/tech-stack.txt` (from `scripts/worktree-port.sh`, a `web` config), and `tsgolint` in `tooling/vite-react/seeds/.cspell/tech-stack.txt` (from the scaffold's own `README.md`, not a canon seed).

`astro` needs `tooling/web/manifest.toml`'s `typescript` dependency pinned to `^6`, since its scaffold never lists `typescript` of its own and an unpinned install resolves past `typescript-eslint`'s peer range, throwing before its own `scripts/verify.sh` reaches `Spelling` under `set -e`. `scripts/tooling/verify.sh` exports `CI` before scaffolding starts, so the `isCI` branches in the two shipped `playwright.config.ts` files run the way a target's real CI job runs them instead of being skipped.

The Sync phase in `scripts/tooling/verify.sh` shells to `bun "$PROJECT_ROOT/src/cli.ts"` rather than bare `canon`, so it resolves the checkout it runs from instead of whatever install sits on PATH. Its output names the binary that answers, and `src/tooling-verify.test.ts` proves the resolution against a fixture stubbing both binaries, failing the run if the Sync phase ever reaches PATH `canon` again. Never verify a tooling edit through bare `canon tooling verify`, which still resolves whatever install sits on PATH. Run `bun src/cli.ts tooling verify <stack>` from the worktree, or `bash scripts/tooling/verify.sh <stack>` directly, where `PROJECT_ROOT` self-derives from `SCRIPT_DIR`.

`canon tooling sync` carries the identical trap. A bare `canon` on PATH resolves `PROJECT_ROOT` to the installed package rather than the checkout a caller stands in, and `sync` carries no internal reroute the way `verify.sh`'s Sync phase reroutes its own call. `findCheckoutMismatch` in `src/project-root.ts` walks upward from `process.cwd()` for the nearest ancestor `package.json` sharing this package's own name, and `checkoutMismatchWarning` beside it formats the line naming both roots.

Every verb that answers from `PROJECT_ROOT` warns rather than refuses when that ancestor differs: `create`, `inject`, `list`, and `prune-gitignore` are covered, the first through `execScript`, the middle two through `prepare()`, and `list` through an explicit call of its own.

`canon tooling reference` is the one tooling verb still exempt, alongside `canon standards <name>`, and both for the same reason. `referenceRoots` and `standardRoots` put the caller's own working root ahead of the package corpus, so a caller standing in the checkout it means to read already reads that checkout. What survives there is narrower: a cwd one level short of the `tooling/` or `standards/` folder falls through to the package corpus with nothing said.

The precedence those two resolvers implement is a deliberate choice rather than a gap to fix. The `canon/ARCHITECTURE.md` entry on the warning's reach carries the cross-domain accounting for every other verb.

A further gap surfaced upstream of this checkout and astro-only rather than shared across stacks. `astro preview` backgrounds itself by default in the astro release the scaffold resolves, so Playwright's `webServer` config meets `Process from config.webServer exited early` before any browser launches. `tooling/astro/configs/playwright.config.ts`'s `webServer` block sets `env: { ASTRO_PREVIEW_BACKGROUND: '0' }`, which keeps Playwright's own spawned process foregrounded without touching the shared `preview` script a human or an agent still runs by hand. Measured 2026-09-04: eight consecutive clean runs against the patched block, across two independent scaffolds.

`vite-react`'s shipped config needs no equivalent fix, since its `webServer` command runs plain `vite` through `bun run dev`, which stays foregrounded on its own. Measured against the untouched scaffold: three consecutive passes.

`vite-react`'s raw scaffold ships its own `"lint": "oxlint"` script and a bare `.oxlintrc.json` that `applyScripts` alone never replaces, since it only fills a script key the target lacks. `tooling/web/manifest.toml`'s `[scripts.override]` forces `lint` back to the stack's own eslint invocation regardless. Left unpatched, the oxlint version that scaffold resolves runs silently under its own default rule set rather than refusing to find files: 10 files, 116 rules, 0 warnings, exit 0, and never reaches the stack's ESLint config or its `--max-warnings 0` gate.

Unit tests cover the manifest walk, the gitignore transforms, the package.json comparisons, and the scan. Equivalence against the bash this replaced was established by syncing every stack into paired fixtures and diffing contents and file modes, which is the check to repeat when changing injection order or copy semantics.

Measured 2026-09-05: two `bun e2e/screenshot.ts` captures against the same built `astro` preview, with no code change between them, produced byte-identical PNGs for both cases in `screenshots/localhost/home/`, confirmed by SHA-256.

`canon tooling verify <stack>` scaffolds fresh, so a stack whose manifest leaves a dependency unpinned resolves whatever is current at scaffold time. `web`'s `@playwright/test` carries no version, so a scaffold can resolve a newer release than this checkout's own pinned devDependency, and the two need different cached browser binaries. Install browsers from inside the scaffold, `.canon/tmp/verify-<stack>/node_modules/.bin/playwright install <browsers>`, rather than from this checkout's root, which targets the wrong version and fails E2E with `browserType.launch: Executable doesn't exist`. Measured 2026-09-05 against `astro`.

Building `nextjs`, its current non-interactive scaffold flags are `--skip-install` and `--disable-git`, not the older `--no-install`/`--no-git`, and there is no `--turbopack` flag since Turbopack is the default bundler. `--no-agents-md` suppresses the scaffold-time `AGENTS.md`/`CLAUDE.md` write, avoiding the root-`CLAUDE.md` collision. The stack's `typecheck` script runs `next typegen && tsc --noEmit` rather than bare `tsc --noEmit`, since the App Router's route-level types (`LayoutProps`, `PageProps`) generate into a gitignored `.next/types/` absent from a fresh checkout.

`nextjs` carries a `[gitignore]` group naming `.next/`, matching `astro`'s group, for a target whose own `.gitignore` never carried that scaffold default. `eslint-plugin-check-file`'s `folder-naming-convention` needs a `src/app/**` off-block the same way astro's `pages/**` needs one, for the App Router's special folder syntax (`[id]`, `(group)`, `@slot`).

`tooling/astro/configs/eslint.config.js`'s `check-file/filename-naming-convention` block scopes `files` to `**/*.{ts,tsx,js,jsx,astro}` and the rule's own pattern to `**/*.{ts,tsx,astro}`, leaving `.js`/`.jsx` outside the rule's own pattern to match `web` and `nextjs`, which enforce neither extension despite selecting them in the same block. `astro`, `web`, and `nextjs` all gate component filenames `KEBAB_CASE` rather than carving out Astro's own PascalCase convention, since a component's name in markup comes from the import binding rather than the filename, so kebab-case costs nothing at the call site.

`check-file/folder-naming-convention`'s configured pattern needs a trailing slash (`src/**/!(__tests__|pages)/`) to capture any path segment at all: `micromatch.capture()` returns `undefined` against a pattern with no trailing slash for every directory, which the rule reads as nothing to check, so the rule is inert without it across all three stacks.

With the slash restored, `astro`'s `src/pages/[id]/` and `src/pages/blog/[...slug]/` and `nextjs`'s `[id]`, `(group)`, and `@slot` folders under `src/app/**` all fail plain `KEBAB_CASE`, so both stacks carry their own off-block for that convention (`pages/**` for astro, the existing `src/app/**` override for nextjs). Measured 2026-09-07 against all three shipped configs.

Verifying against this eslint config needs `eslint@9` pinned in a scratch install: ESLint 10 crashes on load against `typescript-eslint@8.69.0`'s bundled `@typescript-eslint/utils`, since ESLint 10 dropped the `LegacyESLint` shim that package still imports.

## Adding a new stack

1. Run `canon tooling create` to generate the stub structure
2. Fill in `manifest.toml` with `extends`, deps, scripts, and optionally `[gitignore]` or `[verify]`
3. Fill in `reference.md` with prose documentation
4. Add golden configs to `configs/` for anything that ships as source of truth
5. Add seed files to `seeds/` for user-owned files that accumulate over time
6. Run `canon tooling verify <name>` to validate end-to-end

Sync auto-discovers the new stack.
