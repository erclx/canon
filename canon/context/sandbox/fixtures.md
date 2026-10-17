---
title: Fixtures
description: Fixture tree layout, the helpers that stage it, the record root a tree spells, and the traps in keeping a staged tree honest
---

# Fixtures

A scenario's file content lives under `sandbox/fixtures/<category>/<scenario>/<arm>/<stage>/`, and `ctx.fixtures` from `src/sandbox/scenario.ts` copies one stage into the sandbox. The scenario keeps its own git operations between the calls, so the scenario holds logic and the tree holds content.

```ts
ctx.fixtures('claude', 'task-complete', 'archive', '01-initial')
// commit the stage, then stage the next one
ctx.fixtures('claude', 'task-complete', 'archive', '02-rate-limit')
```

## Decisions

### Tree shape

The first two segments mirror the scenario's own path at `sandbox/<category>/<scenario>.ts`. Both are needed, since scenario basenames such as `sync` repeat across categories.

- Stage numbering carries ordering, not identity. A stage exists because a commit or a branch switch has to happen before the next file lands.
- Each stage splits into two optional subfolders. `create/` copies files in, making parent directories and overwriting what is there.
- `append/` concatenates onto a file the anchor or the injected seeds already provide, and fails when the target is missing, because an absent target means the upstream shape changed
- Every stored file carries a `.fixture` suffix the helper strips on copy, which keeps `canon indexes regen`, oxfmt, `shfmt`, and `shellcheck` off the content
- Without the suffix, a fixture that deliberately drifts from its sibling frontmatter gets normalized by `bun run check` and the state it models disappears

### Examples of the shape

The `git` scenarios show two cases.

- The `utils.js` stages in `pr`, `issue`, and `followup` are `append/` folders over the anchor's `utils.js`, so a stale anchor tree fails the provision loudly
- `ship` and `split` use `create/`
- `git/followup` stages one `lowercase` block for two arms under `shared`, and each arm adds its own second stage after the pull request exists
- A stage two scenarios share still gets a copy per scenario, because the first two segments name one scenario. `pr` and `issue` each store the `capitalize` block.

### Content a scenario stages for every arm

`ctx.fixtures` takes four segments ending in an arm name, and a scenario with one unnamed arm has no segment to pass. Naming the arm to recover the helper moves the declaration under that name too, so `canon sandbox check <category>:<command>` with no arm then asserts nothing and reports a clean run.

The `shared` folder answers both cases. It sits beside the arm folders and holds a stage that more than one arm reaches, or that a scenario with no arm names stages for its only run. A scenario calls it as `ctx.fixtures('infra', 'indexes', 'shared', 'folder')`.

- `armsFor` in `src/sandbox/coverage.ts` counts a folder as an arm only when it carries an `expect.toml`, and `shared` carries none
- A default arm's `expect.toml` stays at the scenario level
- A seed function several arms call stores its stage once under `shared/<helper>`, and an arm adding to the result stages its own folder after the call
- `infra/indexes` is the worked case, where `seed_nested_folder` calls `seed_folder` and then stages `nested/01-guides`

### What leaves a scenario and what stays

A heredoc with a quoted delimiter is a literal body, so it leaves the scenario and becomes a stored file that arrives byte for byte, `${`, backticks, and `$(` included. Four kinds stay inline.

- An unquoted heredoc, which interpolates. `write_entry` in `infra/context.ts` fills in a title, and a substitution step in the helper would be harness behavior for two call sites.
- A `chmod`, since `cp` carries the stored file's mode and a `.fixture` suffix on an executable reads as a shell file nobody can lint
- A body fed to a command's stdin rather than written to a path, as `infra/feedback.ts` reads `refusal/stdin/report.md.fixture` through `fixture_stage_dir`
- A body whose path interpolates a root, as `infra/record-root.ts` stores records under a neutral `seed-records/` folder and moves them to the root the arm names

No quoted heredoc is left in the catalog. A file the root `.gitignore` ignores, such as the `.env` in `search-craft`, also stays inline, and the unquoted heredocs in `git-worktree`, `plan-feature`, `plan-groundwork`, and `infra/context` each interpolate a variable or a `$(...)`.

### The anchor tree

`sandbox/fixtures/anchor/create/` is the one tree outside the four-segment layout. It belongs to no single scenario, since every anchor scenario provisions from it, so `stage_anchor_tree` calls `create_from_fixtures` directly.

The tree is copied rather than cloned from the remote, because a clone that deletes `.git` and re-initializes is a file transfer. The remote stays real because anchor scenarios push to it and drive `gh` against it.

- It holds the minimum a scenario reads, being `utils.js`, which `git/{pr,issue,followup}.ts` append to, plus a `.gitignore` matching the empty tree's
- Several anchor scenarios wipe it before staging their own, so grow it only when a scenario reads a missing file

### Claude anchor scenarios

The claude anchor scenarios (`auto-ship`, `review-pr`, `review-address`, `review-ui`) keep every `git push`, `gh pr create`, and cleanup call in the script and stage only file content between them. A stage sits wherever a command other than a write separates two writes.

A body a pull request or comment carries is read from a stored file, so the stored bytes reach `gh` unchanged.

- `canon sandbox equivalence --stub-remote` proves what such a scenario sends
- The three arms posting through `canon pr evidence` read `red-on-base` under the stub, since the stub `gh` does not model that verb's call
- They compare identical up to it, and a real remote run covers the rest

### Content staged from the toolkit itself

`pick_dropped_root` and `restore_dropped_file` stage the toolkit's own deleted history. An arm covering the reverse walk needs a folder at a root this repository dropped, holding bytes it published, since attribution matches content against the blobs history holds for that path and a hand-authored file scores `unattributed`.

### Staging a history rather than a tree

A scenario covering a verb whose subject is git history stages a repository of its own, since the ordering such a verb reads cannot be expressed as files.

The `test-order` arm of `infra:gov` runs `git init` into a subdirectory after the outer arm's commit, so the outer tree never records a gitlink, and writes one commit per verdict the verb reports.

- The files each commit carries are one line apiece and sit inline in the scenario, and the fixture folder holds the expectation alone
- `canon sandbox check` reads the tree and nothing else, so the arm writes stdout, stderr, and the exit status to three files, letting the declaration assert each separately
- Capturing the status matters for any arm over a command that exits non-zero by design, since `set -e` would abort the scenario on the outcome the arm exists to observe

### The record root a tree spells

A fixture tree spells its own record root and nothing reconciles it against the arm's expectations. `create_from_fixtures` copies the stored path verbatim, so a tree staging `.claude/plans/` provisions a project read at the old root, while the `expect.toml` asserts `.canon/`. The two meet only on a paid headless run. <!-- canon-keep-record-root -->

- No arm stages a record under `.claude/` now, and `find sandbox/fixtures -path '*/create/.claude/*' -name '*.fixture'` lists only files the harness itself reads from there
- A new arm can reintroduce the trap, and nothing gates it
- Staging at `.canon/` takes one extra file, since the root `.gitignore`'s bare `.canon/` matches at any depth and a fixture under `create/.canon/` stays untracked until something un-ignores it
- `sandbox/fixtures/claude/.gitignore`, carrying `!.canon/`, does that for every claude arm and is checked against the Ignore parity stage
- Staging consistently at `.canon/` keeps every read and write resolving to one root

## Gotchas

### Staged content

Three habits keep a staged tree honest.

- A stored path repeating its parent folder, such as `canon/config/config.json`, fails the Folder-echoed filenames stage, so store it under a neutral name and `mv` it into place after `ctx.fixtures`
- A stage leaves the tree coherent with what the scenario claims, so one changing a module's signature carries its callers, or the arm tests the fixture's incoherence
- A scenario picking files with `find ... | sort | head -n N` stops testing anything once the source tree grows, so select by the property the scenario needs

### Triggers and timing

Three traps depend on what is already in the tree or on the clock.

- A trigger keyed to a file entering the tree never fires when the seed already put it there, as the setup commit carries `canon/REQUIREMENTS.md` and a later write produces `M` rather than `A`
- Run `git show --name-status --format="" HEAD` after provisioning a new arm, and `rm -f` a seeded path before the initial commit when the arm needs it added later
- A helper building a work list from `git diff --name-only` must skip a path no longer in the tree, or a delete-only branch fails with `cp: cannot stat`. Treat a non-fatal error mid-run as a defect.
- A fixture modelling a timed heuristic must outlast the check window by a wide margin, since two equal sleeps finish in whichever order load puts them
- The `smoke-pass` and `smoke-fail` fixtures on `claude:target-setup` sleep three times the skill's five-second window

### Ignored and unpinned paths

Three paths look present and are not.

- With `SANDBOX_INJECT_SEEDS` on, a stage holding only records under `.canon/` leaves `git add .` nothing to commit and `set -e` aborts the provision. Drop the commit, as `claude:session-worktree` does.
- The root `.gitignore` carries `.env.*` beside `.env`, so a stored `.env.fixture` never reaches the index, and a scenario needing an env file writes it inline
- `canon sandbox check` mints a fresh run id when nothing pins one, so it never finds a hand-provisioned tree. Set `CANON_SANDBOX_DIR` to that tree's path, per `canon/context/sandbox/isolation.md`.

### Matching a real install

An injector that reproduces by hand what a real CLI verb installs drifts silently. The cheap proof is running the verb into a scratch target and diffing the two trees.

Where the artifact is a git repository, diff `git ls-files -s` for modes and blob hashes, the commit subjects in order, the checked-out branch, and `git status --porcelain`, since commit SHAs carry timestamps that never match.

- Running the genuine CLI is not enough on its own, since a fixture that skips a domain measures a project shape nobody ships
- An eval arm installing seeds without governance confounds a finding about a routing rule the missing rules would have carried

### The equivalence verb

`canon sandbox equivalence` is the before and after provisioning diff, so a content slice runs it rather than a scratch script. It adds the baseline as a worktree with history, since `infra:drift unclaimed` reads deleted paths through `pick_dropped_root` and fails with no dropped root on a one-commit copy.

- Its `MASKS` constant in `src/sandbox/equivalence.ts` lists what two runs of one commit differ by, each with its reason
- The masks cover the install stamp's `syncedAt`, the fake occupant's process id, a package fetch's downloaded count, the commit id in a submodule index entry, and a bare repository's object files
- A mask can rewrite a pattern in a value while the rest of the key still has to match, and a masked file's blob hash leaves the index with it
- Twenty-one arms differ when `--base HEAD` provisions one commit on both sides, and no mask covers them yet. Read a `differs` on one of them against a head-against-head run before blaming the change.

Those arms are `infra:drift` (the report), `infra:gov` install, sync, and test-order, `infra:init`, `infra:tooling` and the `tooling` stacks (package-install wall times and tool caches), `infra:record-root/records-push`, `infra:comments/trend`, `infra:sync`, and `claude:read-frames/resolved`.

### Stub remote and cleanup

An anchor arm force-pushes `main` on the shared remote, so a content slice over one runs `canon sandbox equivalence <category> --stub-remote`.

Each arm gets a local bare repository behind a `url.<bare>.insteadOf` rewrite, a stub `gh` ahead of the real one on `PATH`, a dead local `HTTPS_PROXY`, and pinned commit dates, so commit ids depend on the tree alone.

- `src/sandbox/stub-remote.ts` holds the stub, and the manifest gains the stub `gh` log and each remote ref with its tip tree and commit subjects
- A `gh` call the stub does not model exits non-zero and is logged, so a new call turns an arm red and the stub needs a line in the same change
- The method proves what a scenario sends to `git` and `gh`, not how GitHub answers
- The worktree-cleanup scenario backgrounds a six-hour `sleep` as its fake occupant, so the verb starts every provision in its own process group and kills the group when it returns

### Bases and real arms

`--base main` reads the local `main` ref, which can trail `origin/main`. A worktree cut from the newer remote then reads every arm of a seed-injecting scenario as `differs` on the seed files, so pass `--base origin/main` there.

- Run `bun install` in a fresh linked worktree before the verb, since the baseline worktree resolves dependencies from the checkout and every arm otherwise reads `differs` on a missing `execa`
- `--out` takes an absolute path outside the repository
- The real-arm case in `src/sandbox/equivalence.test.ts` builds both sides from one commit, with `root` a detached `HEAD` worktree, since the live checkout would read an uncommitted edit as a difference
- That case therefore does not notice an uncommitted change that breaks provisioning, and a hand-run `canon sandbox equivalence` still compares the working tree
