---
title: Fixtures
description: Fixture tree layout, the helpers that stage it, the record root a tree spells, and the traps in keeping a staged tree honest
---

# Fixtures

A scenario's file content lives under `scripts/sandbox/fixtures/<category>/<scenario>/<arm>/<stage>/`, and `stage_fixtures` from `scripts/lib/sandbox-fixtures.sh` copies one stage into the sandbox. The scenario keeps its own git operations between the calls, so the script holds logic and the tree holds content.

```bash
stage_fixtures claude task-board archive 01-initial
git add . && git commit -m "feat(api): serve the task list" --no-verify -q
stage_fixtures claude task-board archive 02-rate-limit
```

## Decisions

### Tree shape

- The first two segments mirror the scenario's own path at `scripts/sandbox/<category>/<scenario>.sh`. Both are needed, since scenario basenames such as `sync` repeat across categories.
- Stage numbering carries ordering, not identity. A stage exists because a commit or a branch switch has to happen before the next file lands.
- Each stage splits into two optional subfolders. `create/` copies files in, making parent directories and overwriting what is there. `append/` concatenates onto a file the anchor or the injected seeds already provide, and fails when the target is missing, because an absent target means the upstream shape changed and the scenario's assumption is stale.
- Every stored file carries a `.fixture` suffix the helper strips on copy. The suffix keeps the repository's own checks off the content: `canon indexes regen`, prettier, `shfmt`, and `shellcheck` all skip it. Without it, a fixture that deliberately drifts from its sibling frontmatter gets normalized by `bun run check` and the state it models disappears.

### Single-arm scenarios stage inline

`stage_fixtures` takes four segments ending in an arm name, and a scenario with one unnamed arm has no segment to pass. `claude/review-branch`, `claude/write-human`, and `claude/session-map` stage their tree from heredocs inside `stage_setup`, and their fixture folder holds `expect.toml` alone. Naming the arm to recover the helper moves the declaration under that name too, so `canon sandbox check <category>:<command>` with no arm then asserts nothing and reports a clean run.

### The anchor tree

`scripts/sandbox/fixtures/anchor/create/` is the one tree outside the four-segment layout. It belongs to no single scenario, since every anchor scenario provisions from it, so `stage_anchor_tree` calls `create_from_fixtures` directly. The tree is copied rather than cloned from the remote, because a clone that deletes `.git` and re-initializes is a file transfer, and the remote stays real because anchor scenarios push to it and drive `gh` against it.

It holds the minimum a scenario reads: `utils.js`, which `git/{pr,issue,followup}.sh` append to, plus a `.gitignore` matching what `init_empty_sandbox` writes. Several anchor scenarios wipe or overwrite the tree before staging their own, so grow it only when a scenario reads a file that is missing.

### Content staged from the toolkit itself

- `stage_toolkit_markdown` stages the toolkit's own `standards/` tree. An arm modelling a real install wants the files a target received, and a copy under `fixtures/` would drift from the source with nothing reporting it. The helper flattens, because both `detectUnmigrated` and the sync engine match a target file to its source by basename against the flat domain root, and a file staged out of a subfolder such as `internal/standards/` reads as project-authored.
- `pick_dropped_root` and `restore_dropped_file` stage the toolkit's own deleted history. An arm covering the reverse walk needs a folder at a root this repository dropped, holding bytes it published, since attribution matches content against the blobs history holds for that path and a hand-authored file scores `unattributed`.

### Staging a history rather than a tree

A scenario covering a verb whose subject is git history stages a repository of its own, since the ordering such a verb reads cannot be expressed as files. The `test-order` arm of `infra:gov` runs `git init` into a subdirectory after the outer `stage_setup` commit, so the outer tree never records the nested repository as a gitlink, and writes one commit per verdict the verb reports. The files each commit carries are one line apiece and sit inline in the scenario, which keeps the sequence readable in one place, and the fixture folder holds the expectation alone.

`canon sandbox check` reads the tree and nothing else, so the arm writes stdout, stderr, and the exit status to three files rather than printing to the terminal. That lets the declaration assert the classification, the record shape, and the exit code separately. Capturing the status matters for any arm over a command that exits non-zero by design, since `set -e` would abort the scenario on the outcome the arm exists to observe.

### The record root a tree spells

A fixture tree spells its own record root and nothing reconciles it against the arm's expectations. `create_from_fixtures` copies the stored path verbatim, so a tree staging `.claude/plans/` provisions a project the record resolver reads at the old root, while the `expect.toml` beside it asserts `.canon/`. The two meet only on a paid headless run, and every check on a push passes in between. Arms under `claude/context-fold`, `claude/plan-intake`, and `claude/task-board` still stage records under `.claude/`, and `find scripts/sandbox/fixtures -path '*/create/.claude/*' -name '*.fixture'` lists them. <!-- canon-keep-record-root -->

Staging at `.canon/` takes one extra file. The root `.gitignore`'s bare `.canon/` entry matches at any depth, so a fixture stored under `.../create/.canon/tasks/` cannot be tracked until something un-ignores it. `scripts/sandbox/fixtures/claude/task-board/decline/.gitignore`, carrying `!.canon/`, takes that route and is checked clean against `scripts/core/check-ignore-parity.sh`. Staging consistently at `.canon/` keeps every read and write in the sandboxed project resolving to one root, where a `.claude/`-staged board meets `.canon/`-spelled assertions only by accident and comes back `missing` on every path.

## Gotchas

### Staged content

- A stage leaves the tree coherent with what the scenario claims it staged. A stage that changes a module's signature carries its callers, or a skill reading the diff correctly sees a half-migration and the arm tests the fixture's incoherence rather than the skill.
- A scenario picking fixture files positionally with `find ... | sort | head -n N` stops testing anything once the source tree grows, and keeps exiting 0 until the picked path no longer exists. Select by the property the scenario needs, and when a sandbox gate fails mid-migration, run it on unmodified `main` before assuming the branch caused it.
- A trigger keyed to a file entering the tree never fires when the seed already put it there. With `SANDBOX_INJECT_SEEDS` on, the setup commit carries `canon/REQUIREMENTS.md` and `canon/ARCHITECTURE.md`, so a later fixture writing one produces `M` rather than `A`. Run `git show --name-status --format="" HEAD` inside the tree after provisioning a new arm, and `rm -f` a seeded path before the initial commit whenever the arm depends on it being added later.
- A fixture built by cutting a seeded file at a line number is coupled to that file's line order and reports nothing when the coupling breaks. `scripts/sandbox/claude/seed-sync.sh` cuts the seed at the `## Commands` heading behind a `grep -q` check that fails loudly on a miss. Prefer staging keyed to a heading, and re-read an arm that slices a seeded file whenever that file is edited.
- A helper building a work list from `git diff --name-only` or `git ls-files` treats every path as present unless it skips one no longer in the tree, so a delete-only branch is where a missing existence check surfaces. The copy fails with `cp: cannot stat` while provisioning completes. Fix the guard in the same branch as any deletion-shaped change, and treat a non-fatal error printed mid-run as a defect.
- A fixture modelling a timed heuristic outlasts the check window by a wide margin. Two sleeps of equal length finish in whichever order machine load puts them, so a fixture sleeping exactly the window the skill waits makes the arm flaky on the axis it exists to prove. The `dev` and `preview` fixtures on `claude:target-setup`'s `smoke-pass` and `smoke-fail` arms sleep three times the skill's five-second window.

### Matching a real install

- An injector that reproduces by hand what a real CLI verb installs drifts silently. The cheap proof is running the verb into a scratch target and diffing the two trees. Where the artifact is a git repository, diff `git ls-files -s` for modes and blob hashes, the commit subjects in order, the checked-out branch, and `git status --porcelain`, since commit SHAs carry timestamps that never match.
- Running the genuine CLI is not enough on its own, since a fixture that skips a domain measures a project shape nobody ships. An eval arm installing seeds without governance confounds a finding about a routing rule the missing rules would have carried.
- A fixture staging drift against an installed `CLAUDE.md` cannot assume the toolkit's commit history is reachable. `seed-sync` goes through the `canon` on PATH, a global install carrying no history, so `historyUnavailable` reads true and a `drifted` file always falls to the skill's appearance heuristic. Expect a one-word change inside an otherwise original sentence to propose an Update rather than read as Customized.
