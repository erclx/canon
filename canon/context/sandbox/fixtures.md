---
title: Fixtures
description: Fixture tree layout, the helpers that stage it, the record root a tree spells, and the traps in keeping a staged tree honest
---

# Fixtures

A scenario's file content lives under `sandbox/fixtures/<category>/<scenario>/<arm>/<stage>/`, and `stage_fixtures` from `scripts/lib/sandbox-fixtures.sh` copies one stage into the sandbox. The scenario keeps its own git operations between the calls, so the script holds logic and the tree holds content.

```bash
stage_fixtures claude task-board archive 01-initial
git add . && git commit -m "feat(api): serve the task list" --no-verify -q
stage_fixtures claude task-board archive 02-rate-limit
```

## Decisions

### Tree shape

- The first two segments mirror the scenario's own path at `sandbox/<category>/<scenario>.sh`. Both are needed, since scenario basenames such as `sync` repeat across categories.
- Stage numbering carries ordering, not identity. A stage exists because a commit or a branch switch has to happen before the next file lands.
- Each stage splits into two optional subfolders. `create/` copies files in, making parent directories and overwriting what is there. `append/` concatenates onto a file the anchor or the injected seeds already provide, and fails when the target is missing, because an absent target means the upstream shape changed and the scenario's assumption is stale.
- Every stored file carries a `.fixture` suffix the helper strips on copy. The suffix keeps the repository's own checks off the content: `canon indexes regen`, prettier, `shfmt`, and `shellcheck` all skip it. Without it, a fixture that deliberately drifts from its sibling frontmatter gets normalized by `bun run check` and the state it models disappears.

The `git` scenarios show two cases of the shape. The `utils.js` stages in `pr`, `issue`, and `followup` are `append/` folders over the anchor's `utils.js`, so a stale anchor tree fails the provision loudly. `ship` and `split` use `create/`. `git/followup` stages one `lowercase` block for two arms under `shared`, and each arm adds its own second stage after the pull request exists. A stage that two scenarios share still gets a copy per scenario, because the first two segments name one scenario. `pr` and `issue` each store the `capitalize` block.

### Content a scenario stages for every arm

`stage_fixtures` takes four segments ending in an arm name, and a scenario with one unnamed arm has no segment to pass. Naming the arm to recover the helper moves the declaration under that name too, so `canon sandbox check <category>:<command>` with no arm then asserts nothing and reports a clean run.

The `shared` folder answers both cases. It sits beside the arm folders and holds a stage that more than one arm reaches, or that a scenario with no arm names stages for its only run. A scenario calls it as `stage_fixtures infra indexes shared folder`, with the four-segment call unchanged. `armsFor` in `src/sandbox/coverage.ts` counts a folder as an arm only when it carries an `expect.toml`, and `shared` carries none, so it never reads as an arm and a default arm's `expect.toml` stays at the scenario level.

A seed function one arm calls stores its stage under that arm. One several arms call stores its stage once under `shared/<helper>`, and an arm that adds to the result stages its own folder after the call, so no near-duplicate file appears. `infra/indexes` is the worked case, where `seed_nested_folder` calls `seed_folder` and then stages `nested/01-guides`.

### What leaves a scenario and what stays

A heredoc with a quoted delimiter is a literal body, so it leaves the scenario and becomes a stored file that arrives byte for byte, `${`, backticks, and `$(` included. These stay inline:

- An unquoted heredoc, which interpolates. `write_entry` in `infra/context.sh` fills in a title, and a substitution step in the helper would be harness behavior for two call sites.
- A `chmod`, since `cp` carries the stored file's mode and a `.fixture` suffix on an executable file reads as a shell file nobody can lint.
- A body fed to a command's stdin rather than written to a path. `infra/feedback.sh` reads `refusal/stdin/report.md.fixture` through `fixture_stage_dir`, so the staged tree gains no file.
- A body whose path interpolates a root. `infra/record-root.sh` stores its records under a neutral `seed-records/` folder and moves them to the root the arm names, which keeps a stored `.canon/` path out of the ignore rule and a stored `.claude/` path from pinning the fallback.

No quoted heredoc is left in the catalog. What stays inline is the four kinds above and a file the root `.gitignore` ignores, such as the `.env` in `search-craft`. The unquoted heredocs in `git-worktree`, `plan-feature`, `plan-groundwork`, and `infra/context` each interpolate a variable or a `$(...)`.

### The anchor tree

`sandbox/fixtures/anchor/create/` is the one tree outside the four-segment layout. It belongs to no single scenario, since every anchor scenario provisions from it, so `stage_anchor_tree` calls `create_from_fixtures` directly. The tree is copied rather than cloned from the remote, because a clone that deletes `.git` and re-initializes is a file transfer, and the remote stays real because anchor scenarios push to it and drive `gh` against it.

It holds the minimum a scenario reads: `utils.js`, which `git/{pr,issue,followup}.sh` append to, plus a `.gitignore` matching the one the empty tree starts with. Several anchor scenarios wipe or overwrite the tree before staging their own, so grow it only when a scenario reads a file that is missing.

The claude anchor scenarios (`auto-ship`, `review-pr`, `review-address`, `review-ui`) keep every `git push`, `gh pr create`, and cleanup call in the script and stage only the file content between them. A stage sits wherever a command other than a write, such as a commit, a branch switch, or a copy, separates two writes. A body a pull request or a comment carries is read from a stored file the same way, and the stored bytes reach `gh` unchanged. `canon sandbox equivalence --stub-remote` proves what such a scenario sends. The three arms that post through `canon pr evidence` read `red-on-base` under the stub, since the stub `gh` does not model the call that verb makes. They compare identical up to that call, and a real remote run is what covers the rest.

### Content staged from the toolkit itself

- `stage_toolkit_markdown` stages the toolkit's own `standards/` tree. An arm modelling a real install wants the files a target received, and a copy under `fixtures/` would drift from the source with nothing reporting it. The helper flattens, because both `detectUnmigrated` and the sync engine match a target file to its source by basename against the flat domain root, and a file staged out of a subfolder such as `internal/standards/` reads as project-authored.
- `pick_dropped_root` and `restore_dropped_file` stage the toolkit's own deleted history. An arm covering the reverse walk needs a folder at a root this repository dropped, holding bytes it published, since attribution matches content against the blobs history holds for that path and a hand-authored file scores `unattributed`.

### Staging a history rather than a tree

A scenario covering a verb whose subject is git history stages a repository of its own, since the ordering such a verb reads cannot be expressed as files. The `test-order` arm of `infra:gov` runs `git init` into a subdirectory after the outer `stage_setup` commit, so the outer tree never records the nested repository as a gitlink, and writes one commit per verdict the verb reports. The files each commit carries are one line apiece and sit inline in the scenario, which keeps the sequence readable in one place, and the fixture folder holds the expectation alone.

`canon sandbox check` reads the tree and nothing else, so the arm writes stdout, stderr, and the exit status to three files rather than printing to the terminal. That lets the declaration assert the classification, the record shape, and the exit code separately. Capturing the status matters for any arm over a command that exits non-zero by design, since `set -e` would abort the scenario on the outcome the arm exists to observe.

### The record root a tree spells

A fixture tree spells its own record root and nothing reconciles it against the arm's expectations. `create_from_fixtures` copies the stored path verbatim, so a tree staging `.claude/plans/` provisions a project the record resolver reads at the old root, while the `expect.toml` beside it asserts `.canon/`. The two meet only on a paid headless run, and every check on a push passes in between. No arm stages a record under `.claude/` now, and `find sandbox/fixtures -path '*/create/.claude/*' -name '*.fixture'` lists only files the harness itself reads from there, such as rules and a deliberately legacy installed copy. A new arm can reintroduce the trap, and nothing gates it. <!-- canon-keep-record-root -->

Staging at `.canon/` takes one extra file. The root `.gitignore`'s bare `.canon/` entry matches at any depth, so a fixture stored under `.../create/.canon/tasks/` cannot be tracked until something un-ignores it. `sandbox/fixtures/claude/.gitignore`, carrying `!.canon/`, does that for every claude arm and is checked clean against the Ignore parity stage. Staging consistently at `.canon/` keeps every read and write in the sandboxed project resolving to one root, where a `.claude/`-staged board meets `.canon/`-spelled assertions only by accident and comes back `missing` on every path.

## Gotchas

### Staged content

- A stored path repeating its parent folder, such as `canon/config/config.json`, fails the Folder-echoed filenames stage, which has no exemption. Store the file under a neutral name beside its folder and `mv` it into place after `stage_fixtures`.
- A stage leaves the tree coherent with what the scenario claims it staged. A stage that changes a module's signature carries its callers, or a skill reading the diff correctly sees a half-migration and the arm tests the fixture's incoherence rather than the skill.
- A scenario picking fixture files positionally with `find ... | sort | head -n N` stops testing anything once the source tree grows, and keeps exiting 0 until the picked path no longer exists. Select by the property the scenario needs, and when a sandbox gate fails mid-migration, run it on unmodified `main` before assuming the branch caused it.
- A trigger keyed to a file entering the tree never fires when the seed already put it there. With `SANDBOX_INJECT_SEEDS` on, the setup commit carries `canon/REQUIREMENTS.md`, so a later fixture writing it produces `M` rather than `A`. Run `git show --name-status --format="" HEAD` inside the tree after provisioning a new arm, and `rm -f` a seeded path before the initial commit whenever the arm depends on it being added later.
- A fixture built by cutting a seeded file at a line number is coupled to that file's line order and reports nothing when the coupling breaks. `sandbox/claude/seed-sync.sh` cuts the seed at the `## Commands` heading behind a `grep -q` check that fails loudly on a miss. Prefer staging keyed to a heading, and re-read an arm that slices a seeded file whenever that file is edited.
- A helper building a work list from `git diff --name-only` or `git ls-files` treats every path as present unless it skips one no longer in the tree, so a delete-only branch is where a missing existence check surfaces. The copy fails with `cp: cannot stat` while provisioning completes. Fix the guard in the same branch as any deletion-shaped change, and treat a non-fatal error printed mid-run as a defect.
- A fixture modelling a timed heuristic outlasts the check window by a wide margin. Two sleeps of equal length finish in whichever order machine load puts them, so a fixture sleeping exactly the window the skill waits makes the arm flaky on the axis it exists to prove. The `dev` and `preview` fixtures on `claude:target-setup`'s `smoke-pass` and `smoke-fail` arms sleep three times the skill's five-second window.

### Ignored and unpinned paths

- With `SANDBOX_INJECT_SEEDS` on, the install writes `.canon/` into the sandbox `.gitignore`, so a stage holding only records under `.canon/` leaves `git add .` nothing to commit and `set -e` aborts the provision. Drop the commit, since a target never tracks those records either. `claude:session-worktree` and the `teach-lesson` arm of `claude:draft-figure` stage their records untracked for this reason.
- The root `.gitignore` carries `.env.*` beside `.env`, so a stored `.env.fixture` or `.env.local.fixture` never reaches the index. A scenario needing an env file writes it inline in `stage_setup`.
- `canon sandbox check` mints a fresh run id when nothing pins one, so it never finds a tree provisioned by hand or by an earlier call. Set `CANON_SANDBOX_DIR` to that tree's path for the check, as `canon/context/sandbox/isolation.md` states for the general case.

### Matching a real install

- An injector that reproduces by hand what a real CLI verb installs drifts silently. The cheap proof is running the verb into a scratch target and diffing the two trees. Where the artifact is a git repository, diff `git ls-files -s` for modes and blob hashes, the commit subjects in order, the checked-out branch, and `git status --porcelain`, since commit SHAs carry timestamps that never match.
- `canon sandbox equivalence` is the before and after provisioning diff, so a content slice runs it rather than a scratch script. It adds the baseline as a worktree with history, since `infra:drift unclaimed` reads deleted paths through `pick_dropped_root` and fails with no dropped root on a one-commit copy. Its `MASKS` constant in `src/sandbox/equivalence.ts` lists what two runs of one commit differ by, each with its reason. Those go past the run id: the install stamp's `syncedAt` time, the fake occupant's process id in the worktree-cleanup narration, a package fetch's downloaded count (the base side warms the cache the head side reads), the commit id in a submodule index entry, and a bare repository's object files. A mask can rewrite a pattern in a value while the rest of the key still has to match, and a masked file's blob hash leaves the index with it.
- Twenty-one arms differ when `--base HEAD` provisions one commit on both sides, so they differ on any base and no mask covers them yet: `infra:drift` (the report), `infra:gov` install, sync, and test-order (an install stamp under a subfolder, commit ids), `infra:init`, `infra:tooling`, and the `tooling` stacks (package-install wall times, the Go test cache, spinner frames, mypy, ruff, and composer caches), `infra:record-root/records-push`, `infra:comments/trend`, and `infra:sync` (commit ids), and `claude:read-frames/resolved`. Read a `differs` on one of them against a head-against-head run before blaming the change.
- An anchor arm force-pushes `main` on the shared remote, so a content slice over one runs `canon sandbox equivalence <category> --stub-remote`. Each arm gets a local bare repository behind a `url.<bare>.insteadOf` rewrite, a stub `gh` ahead of the real one on `PATH`, a dead local `HTTPS_PROXY`, and pinned commit dates, so commit ids depend on the tree alone. `src/sandbox/stub-remote.ts` holds the stub. The manifest gains the stub `gh` log, one argv per line, and each remote ref with its tip tree and commit subjects. A `gh` call the stub does not model exits non-zero and is logged, which turns a new call into a red arm, so the stub needs a line in the same change. The method proves what a scenario sends to `git` and `gh`, not how GitHub answers. Arms with no `expect.toml` are enumerated from the scenario files, which is why this works for the `git` category.
- The worktree-cleanup scenario backgrounds a six-hour `sleep` as its fake occupant and nothing stops it. The verb starts every provision in its own process group and kills the group when the provision returns, which keeps repeated runs from leaving a live session per side in the roster.
- `--base main` reads the local `main` ref, which can trail `origin/main`. A worktree cut from the newer remote then reads every arm of a seed-injecting scenario as `differs` on the seed files, arms the branch never touched included, so pass `--base origin/main` there.
- Run `bun install` in a fresh linked worktree before `canon sandbox equivalence`. The baseline worktree the verb adds resolves its dependencies from the checkout, so with none installed every base provision exits 1 on a missing `execa` and every arm reads `differs` rather than `red-on-base`. `--out` takes an absolute path outside the repository.
- The real-arm case in `src/sandbox/equivalence.test.ts` fails while any `claude/skills/**/SKILL.md` or any file under `tooling/claude/seeds/` carries uncommitted edits, naming the injected `.claude/skills/<name>/SKILL.md` or the seeded `file:canon/REQUIREMENTS.md` as the difference between its two provisions. Commit the edit before reading that failure as a regression.
- Running the genuine CLI is not enough on its own, since a fixture that skips a domain measures a project shape nobody ships. An eval arm installing seeds without governance confounds a finding about a routing rule the missing rules would have carried.
- A fixture staging drift against an installed `CLAUDE.md` cannot assume the toolkit's commit history is reachable. `seed-sync` goes through the `canon` on PATH, a global install carrying no history, so `historyUnavailable` reads true and a `drifted` file always falls to the skill's appearance heuristic. Expect a one-word change inside an otherwise original sentence to propose an Update rather than read as Customized.
