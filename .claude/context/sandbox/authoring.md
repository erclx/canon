---
title: Authoring
description: Scenario file shape, the three hooks, fixture trees, and the disposable GitHub remote
---

# Writing a sandbox

Each sandbox is a `.sh` file with two optional hook functions and a required `stage_setup` function.

## stage_setup

`stage_setup` sets up scenario-specific state. It runs inside the sandbox tree after provisioning and asset injection are complete. Commit messages inside `stage_setup` must follow `standards/commit.md` conventions.

```bash
stage_setup() {
  # scaffold scenario state
  # end with scenario ready instructions
  log_step "Scenario ready: ..."
  log_info "Action:  what to run"
  log_info "Expect:  what should happen"
}
```

Multi-scenario files list options before calling `select_or_route_scenario`. Use `: ` as the separator between option name and description, per `standards/markdown.md`. Pad option names so the `:` separators align vertically across the list.

```bash
log_info "install/ : clean target, no rules present"
log_info "sync/    : stale .claude/rules/ present"
log_info "list     : read-only catalog dump, no target needed"
```

### Reading git history from a scenario

A scenario reading git history through a pipeline ending in an early exit fails on output it actually read. Scenario files run under `set -o pipefail`, so a `grep -m 1` matching the first line closes the pipe while git is still writing, and the command substitution returns git's SIGPIPE status rather than the match. Take the whole listing through a process substitution with a `while read` loop and `break`, which pipefail does not observe.

The failure is timing-dependent, which is what makes it worth writing down. The same pipeline run by hand in an interactive shell returns the match and exits 0, because git finishes writing before grep exits, and it fails inside the provisioning run where it matters. `infra:drift` carries both reads in the shape that survives.

### Staging a history rather than a tree

A scenario covering a verb whose subject is git history stages a repository of its own, since the ordering such a verb reads cannot be expressed as files in a directory. The `test-order` arm of `infra:gov` is the first of these. It runs `git init` into a subdirectory after the outer `stage_setup` commit, so the outer tree never records the nested repository as a gitlink, and it writes one commit per verdict the verb reports.

Ordering the commits is what the fixture is for, so a stage folder under `scripts/sandbox/fixtures/` cannot hold it. The files each commit carries are one line apiece and sit inline in the scenario, which keeps the sequence and its content readable in one place.

The arm still owes an expectation, and the fixture folder holds that alone. `canon sandbox check` reads the tree and nothing else, so the arm writes stdout, stderr, and the exit status to three files rather than reaching the terminal through `exec`. That is what lets the declaration assert the classification, the record shape, and the exit code separately, where an arm printing to the terminal leaves a reader checking output by eye and the verdict reads `UNCHECKED`.

Holding the status is load-bearing for any arm over a command that exits non-zero by design. `set -e` would abort the scenario on the outcome the arm exists to observe, so the run captures the code into a file and the declaration pins it.

## Fixtures

A scenario's file content lives under `scripts/sandbox/fixtures/<category>/<scenario>/<arm>/<stage>/`, and `stage_fixtures` from `lib/sandbox-fixtures.sh` copies one stage into the sandbox. The scenario keeps its own git operations between the calls, so the script holds logic and the tree holds content.

```bash
stage_fixtures claude docs drift 01-initial
git add . && git commit -m "feat(api): initial task endpoints" --no-verify -q
stage_fixtures claude docs drift 02-postgres
```

The first two segments mirror the scenario's own path at `scripts/sandbox/<category>/<scenario>.sh`. Both are needed, since four scenario basenames repeat across categories (`claude`, `docs`, `review`, and `sync`) and `docs` is a category as well.

`stage_toolkit_markdown` sits in the same library for the other source of staged content, the toolkit's own `standards/` and `snippets/` trees. An arm modelling a real install wants the files a target actually received, and a copy of them under `fixtures/` would drift from the source with nothing reporting it. It flattens, which is the part to keep: both `detectUnmigrated` and the sync engine match a target file to its source by basename against the flat domain root, so a file staged out of a source subfolder such as `internal/standards/` reads as project-authored and the arm asserts against a state it did not stage.

`pick_dropped_root` and `restore_dropped_file` sit beside it for the third source, the toolkit's own deleted history. An arm covering the reverse walk has to stage a folder at a root this repository actually dropped, holding bytes it actually published, since attribution matches content against the blobs history holds for that path and a hand-authored file scores `unattributed` instead. Both read the whole listing through a process substitution rather than a pipeline ending in an early exit, which is the `pipefail` trap the section below records.

Each stage splits into two optional subfolders. `create/` copies files in, making parent directories and overwriting whatever is there. `append/` concatenates onto a file the anchor or the injected seeds already provide, and fails when the target is missing, because an absent target means the upstream shape changed and the scenario's assumption is stale.

Every stored file carries a `.fixture` suffix that the helper strips on copy. The suffix keeps the repository's own checks off the content, since an `index.md.fixture` is not an `index.md`. `canon indexes regen` leaves it alone, and prettier, `shfmt`, and `shellcheck` skip it too. Without the suffix, a fixture that deliberately drifts from its sibling frontmatter gets normalized by `bun run check` and the state it models disappears.

A fixture tree spells its own record root and nothing reconciles it against the arm's expectations. `create_from_fixtures` copies the stored path verbatim, so a tree staging `.claude/plans/` provisions a project the record resolver reads at the old root, while the `expect.toml` beside it asserts `.canon/`. The two only meet on a paid headless run, and every check the repository runs on a push passes in between. The move to `.canon/` renamed the expectation files and left the trees, so 19 fixture files across five arms still stage `plans`, `tasks`, `memory`, or `review` under `.claude/`: `docs/context-entries`, `docs/receipt-sweep`, `intake/file`, `intake/route`, and `tasks/create`. Measured 2026-09-01. <!-- canon-keep-record-root -->

Staging at `.claude/` is not only stale, it is sometimes the only route available. The root `.gitignore`'s bare `.canon/` entry matches at any depth, so a fixture file stored under `.../create/.canon/tasks/*.fixture` cannot be tracked at all until something un-ignores it. `scripts/sandbox/fixtures/claude/task-board/decline/.gitignore`, carrying `!.canon/`, is the first fixture folder to take that route, checked clean against `scripts/core/check-ignore-parity.sh`. It buys more than the ability to track the fixture: staging consistently at `.canon/` keeps every read and write for that sandboxed project resolving to one root, where a `.claude/`-staged board resolves reads and writes there too and only ever meets `.canon/`-spelled assertions by accident, which is the split the five stale arms above are still caught in. Confirmed by running `claude:task-board`'s `archive` arm headlessly: every fixture-staged path came back `missing` against its `.canon/`-spelled `expect.toml`.

Stage numbering carries ordering, not identity. A stage exists because a commit or a branch switch has to happen before the next file lands.

`stage_fixtures` is unavailable to a single-arm scenario. Its path takes four segments ending in an arm name, and a scenario with one unnamed arm has no segment to pass, so `claude/review`, `claude/write-human`, and `claude/session-map` all stage their tree from heredocs inside `stage_setup` instead. That is why a fixture folder for such a scenario holds `expect.toml` alone. Naming the arm to recover the helper is the alternative and it moves the declaration under that name too, so `canon sandbox check <category>:<command>` with no arm then asserts nothing and reports a clean run.

`scripts/sandbox/fixtures/anchor/create/` is the one tree outside the four-segment layout. It belongs to no single scenario, since all nine anchor scenarios provision from it, so `stage_anchor_tree` calls `create_from_fixtures` directly rather than going through `stage_fixtures`. It holds the minimum a scenario reads: `utils.js`, which `git/{pr,issue,followup}.sh` append to, plus a `.gitignore` matching what `init_empty_sandbox` writes. Three of the nine wipe the tree before staging their own and two overwrite what they need, so growing this fixture is warranted only when a scenario reads a file that is missing.

### Rewriting a file provisioning already wrote

`init_empty_sandbox` writes a `.gitignore` holding `.canon/tmp/` and `node_modules` before `stage_setup` runs, so a scenario modelling ignore-entry drift is rewriting a file it did not create. Truncating that file drops both entries beside the ones the arm meant to strip, and a session that installs anything inside the sandbox then has `node_modules` tracked. Copy the file before the write that dirties it and restore the copy afterwards, which removes exactly what the write added and hardcodes nothing about what provisioning put there. Restating the two entries inline works until provisioning gains a third.

The same shape covers any file the harness seeds and a scenario has to modify. A rewrite from a remembered baseline drifts the moment the baseline moves, and nothing reports it, since the arm still provisions and still asserts.

### Keeping a stage coherent

A stage must leave the tree coherent with what the scenario claims it staged. `02-postgres` on the `claude/docs` `drift` arm replaced `src/db.ts` alone, moving `createTask` to `(title, userId)` and returning `rows[0]`, while `src/routes/tasks.ts` stayed at its `01-initial` content calling `createTask(title)` and reading `result.lastInsertRowid`. The commit message said the migration shipped and the route did not compile against the module it imported.

A skill reading that diff saw a half-migration, correctly declined to mark the outcome, and failed four assertions. A stage that changes a module's signature carries its callers, or the arm tests the fixture's incoherence rather than the skill.

## use_config

`use_config` runs before provisioning. Declare it to set sandbox behavior flags.

```bash
use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"  # skip auto-commit after stage_setup
  export SANDBOX_INJECT_SEEDS="true"      # inject tooling/claude/seeds/ into sandbox root
  export SANDBOX_INJECT_GOV="true"        # inject .claude/rules/ into sandbox
}
```

`SANDBOX_INJECT_SEEDS` is a raw copy of `tooling/claude/seeds/.` into the sandbox root, not a run of `canon claude init`. It drops `CLAUDE.md` and `.claude/*` seed files before `stage_setup` runs. Hooks ride along in that tree, which is what makes a hook change observable to a run.

`SANDBOX_INJECT_GOV` runs `canon gov install` against the sandbox rather than copying a source tree. The installer decides what lands, so the sandbox cannot drift from what a target receives, and provisioning exercises the installer as a side effect. `SANDBOX_GOV_STACK` picks the stack and defaults to `base`.

There is no standards injection. Nothing installs the corpus into a project, so a sandbox holding no standards folder is the shape a scaffolded target has, and a scenario driving a skill that reads a standard exercises the resolve a real project takes rather than a staged copy.

A stack install narrows what arrives. The copy it replaced took all 72 rules under `governance/rules`, while `base` resolves to 48, which is what a real target holds since no project carries both the React and FastAPI rules. A scenario needing a framework's rules sets `SANDBOX_GOV_STACK` rather than assuming every rule is present.

A failed install aborts provisioning with the installer's own stderr, since a sandbox missing the rules a scenario depends on would otherwise fail later somewhere unrelated.

### Which commit `SANDBOX_SKIP_AUTO_COMMIT` actually gates

Two helpers in `scripts/manage-sandbox.sh` commit, and the flag reaches only the second. `initialize_sandbox_environment` provisions and then calls `setup_sandbox_assets`, which injects seeds and rules and closes on `commit_environment_setup`. Only afterwards does `execute_sandbox_and_commit` run `stage_setup`, then `inject_changed_skills`, then `commit_sandbox_changes`, which is the one the flag guards.

The order is what lets an arm stage a deliberately dirty tree. Work that `stage_setup` leaves staged, unstaged, or untracked survives provisioning under the flag, because the unconditional commit already ran before `stage_setup` was called. `claude:review-branch` depends on that, staging one bug in each of four halves so the selection rule has all four to read. Reading the two helpers as one makes such a fixture look impossible, which is the misreading to avoid rather than a constraint on the arm.

`inject_changed_skills` runs inside that window and copies each changed skill body to `.claude/skills/<name>/SKILL.md`. Under the flag, those copies would stay untracked in the sandbox and reach an arm whose skill reads untracked files, so each one is also appended to `$SANDBOX/.git/info/exclude` right after the copy, keeping it off `git ls-files --others --exclude-standard` while leaving it in place for `.claude/skills/` resolution to load.

### `inject_changed_skills` resolves against a merge base

Its changed set comes from `resolve_sandbox_skill_diff_base` in `scripts/lib/sandbox-git.sh`, the same `git merge-base HEAD origin/main` form the diff-baseline port carries across five skill bodies, falling back to `merge-base HEAD main` and then to bare `main` if both reads come back empty. A checkout whose local `main` trails the remote therefore still diffs against the branches that actually merged, rather than injecting skill bodies from commits the branch under test never touched.

## use_anchor

`use_anchor` marks a scenario as one that needs a real remote. Declaring it stages the sandbox from the anchor fixture instead of starting empty, and names the repository the scenario will push to.

All nine declare it the same way, delegating to `use_sandbox_anchor` in `lib/sandbox-git.sh` so the repository name lives in one place:

```bash
use_anchor() {
  use_sandbox_anchor
}
```

`ANCHOR_REPO` carries no default. Every declaring scenario calls `use_sandbox_anchor` with no argument and resolves to `aitk-sandbox`, so a fallback would sit permanently unreached.

The library exports `use_sandbox_anchor` rather than declaring `use_anchor` itself. `manage-sandbox.sh` keys off `type -t use_anchor` to decide between staging the anchor fixture and starting empty, so a hook declared at source time would hand an anchor to `git/commit.sh`, `git/stage.sh`, and `infra/indexes.sh`, which source the file for the identity helpers alone.

`manage-sandbox.sh` handles provisioning, asset injection, skill injection, git setup, and baseline tagging. The hook functions configure behavior before that pipeline runs.

After `stage_setup` completes, `manage-sandbox.sh` unions the `claude/skills/**/SKILL.md` diff against `main` with any untracked new skill folders and copies each into `<sandbox>/.claude/skills/<name>/SKILL.md`. That diff lists a skill the branch deleted alongside one it changed, so the loop skips a path no longer in the tree and a branch retiring a skill provisions without a failed copy. This covers dev skills authored in the current branch whether or not they are committed yet. Project-scoped skills take priority over the installed plugin, so invoking `/<skill-name>` in the sandbox session exercises the dev version without `--plugin-dir` or `--bare`.

## Disposable GitHub remote (`aitk-sandbox`)

Set `ANCHOR_REPO="aitk-sandbox"` when a scenario needs a real GitHub remote for `gh` calls (open PRs, push branches, merge, edit PR bodies). The repo at `${GITHUB_ORG}/aitk-sandbox` exists for this purpose and is treated as fully disposable. Any scenario for a `gh`-dependent skill should default to this pattern.

`configure_sandbox_anchor_remote` probes for that repository before it adds the remote, so an absent one is named before the scenario stages its tree rather than surfacing as a push failure partway through. The probe refuses on a missing anchor and names both repairs, since an absent one is nearly always a wrong `GITHUB_ORG` or a rename nobody performed. `SANDBOX_ANCHOR_CREATE=true` opts into having it created as private instead, and the probe says when it did. That flag takes `true` or `1` and refuses every other value, including an explicit `false`, where the three `use_config` flags above are presence tests that any non-empty value turns on. The difference is deliberate, since a presence test on this one would have `false` provisioning a repository.

Refusing is the default because provisioning stages a fixture rather than cloning and every scenario force-pushes to `main`, so a repository created on the spot carries all nine declaring scenarios to a pass against something that is not the anchor. The cost of a silent creation is a green suite rather than the stray empty repository the cheapness argument counts. `canon tooling sync --write` sets the same shape, and `canon records push` refuses outright for the reason `.claude/context/development/scratch.md` records, so the three still differ by how far each goes rather than by accident.

`gh` reports an absent repository and an unreachable host with the same exit status, so the probe separates them on the 404 alone and treats anything else as a network or credential fault. That keeps a transient failure from reading as a missing remote across all nine declaring scenarios.

Each scenario owns its own reset:

1. Closes any open PRs it will recreate (`gh pr close <branch> 2>/dev/null || true`)
2. Deletes any remote branches it will recreate (`git push origin --delete <branch> -q 2>/dev/null || true`)
3. Force-pushes a fresh main (`git push --force origin HEAD:main`)
4. Recreates branches and opens PRs

Wrap each cleanup call with `2>/dev/null || true` so a missing branch or PR from the prior run does not abort the scenario.

An anchor arm that declares `use_anchor` and never calls `configure_sandbox_anchor_remote` runs the full anchor provisioning path with no network call and no force-push to the shared remote, which the other eight anchor arms all make. `provision_sandbox` dispatches on `type -t use_anchor` alone, so a throwaway scenario declaring it with a no-op `stage_setup` serves the same purpose. Reach for one of those when checking provisioning behavior and spend a pushing arm only on the run that has to prove the remote path.

## Gotchas

### Diff a fixture against what the real verb installs

An injector that reproduces by hand what a real CLI verb installs drifts silently, and the cheap proof is running the verb into a scratch target and diffing the two trees. The standards injector was wrong in three independent ways at once and only the first was on record: the layout was wrong, `cp -r` pulled in `bundled/` and `canon/` which never reached a target, and it shipped a source `index.md` that the install rebuilt. A diff against the verb named all three in one run and confirmed the twelve remaining files byte-identical. The lesson outlived the injector, which went with the install channel.

Running the genuine CLI is not enough on its own, since a fixture that skips a domain measures a project shape nobody ships: an eval arm installed seeds without governance and its finding about a routing rule was confounded, because the rules carrying that routing were never there. Where the artifact is a git repository, its leftover git state is part of what gets diffed, so compare `git ls-files -s` for modes and blob hashes, the commit subjects in order, the checked-out branch, and `git status --porcelain`, since a scenario skipping auto-commit ends deliberately dirty and commit SHAs carry timestamps that never match.

### A positional fixture pick stops testing as the tree grows

A scenario picking its fixture files positionally with `find ... | sort | head -n N` stops testing anything once the source tree grows, and it keeps exiting 0. Three scenarios broke this way in three consecutive migration steps: `infra:snippets` got two internal-category files once `snippets/canon/` existed and reported everything up to date while validating nothing, `infra:standards` got `canon/tooling-reference.md`, which flattens to a name with no flat source, and `infra:sync` broke the same way when `standards/` grew subfolders. The mode has since progressed from silently passing to hard failing, with `infra:sync` dying during provisioning because the positional pick names a file the anchor repo does not carry. Select by the property the scenario needs rather than by sort position, and when a sandbox gate fails mid-migration run it on unmodified `main` before assuming the branch caused it.

### A fallback message names one cause and catches every cause

A failure arm naming its expected cause still fires for causes nobody anticipated. `scripts/sandbox/claude/review-pr.sh` passed `-q` to `gh pr create`, which takes no such flag, so every provisioning run since the scenario shipped failed straight into its fallback log line and created no pull request, while the scenario reported ready. Give a fallback arm a message naming the failure rather than a guess at its cause, and follow any setup step whose success is a precondition with a read proving the artifact exists.

### A seeded file defeats an add trigger

A trigger keyed to a file entering the tree never fires when the seed already put it there. With `SANDBOX_INJECT_SEEDS` on, the setup commit already carries `.claude/REQUIREMENTS.md` and `.claude/ARCHITECTURE.md`, so a later fixture writing one produces `M` rather than `A`. The arm that caught this, `claude:docs-fold/diagram-sweep`, retired with the step it covered, and the lesson outlives it. That arm staged `.claude/REQUIREMENTS.md` at stage 02 to make `docs-fold` stub an uncovered kind, provisioned green, and read correct in the scenario output while `git show --name-status` showed `M`, so it could never have exercised the branch it existed to test. Run `git show --name-status --format="" HEAD` inside the tree after provisioning any new arm, and `rm -f` a seeded path before the initial commit whenever the arm depends on it being added later.

### An arm staging by position is coupled to the file it slices

A fixture built by cutting a seeded file at a line number is coupled to that file's line order, and the coupling reports nothing when it breaks. `scripts/sandbox/claude/seed-sync.sh` truncated the installed root file to its first ten lines and rewrote one sentence inside it, both halves positional rather than keyed to content. `#1149` cut `tooling/claude/seeds/CLAUDE.md` from 87 lines across 10 sections to 29 across 3, after which the sentence the mutation targeted occurred zero times in the seed and one of the arm's three manual expectations named a voice bullet absent from the whole tooling tree. Two staged conditions therefore had not existed for months while every mechanical assertion stayed green, because those assert the proposal's path, slug, and markers rather than what was staged to produce it. The arm now cuts at the `## Commands` heading and mutates a sentence the seed still carries, both guarded by a `grep -q` check that fails loudly on a miss. Re-read an arm that slices a seeded file whenever that file is edited, and prefer staging keyed to a heading over staging keyed to a line count. Measured 2026-09-01, repaired 2026-09-03.

### A drifted root file's history check reads unattributable through a global install

A fixture staging drift against an installed `CLAUDE.md` cannot assume the toolkit's own commit history is reachable at check time. `seed-sync` reads and writes through the bare `canon` on PATH rather than through this checkout, and a globally installed package carries no version-control history of its own, so `historyUnavailable` reads true for any target this sandbox provisions. A `drifted` file therefore never reaches the history-attributed branch and always falls to the skill's appearance heuristic, which reads a bare wording change as Stale and a version carrying extra bullets, project-specific paths, or filled-in placeholders as Customized. Expect a fixture mutating one word inside an otherwise-original sentence to propose an Update, not to sit in the scope table alone as Customized. Measured 2026-09-03.

### A deletion branch is where a missing existence check surfaces

A helper that builds a work list from `git diff --name-only` or `git ls-files` treats every path as present, so a delete-only branch is where the missing existence check first surfaces. `inject_changed_skills` in `scripts/manage-sandbox.sh` unions the `claude/skills/**/SKILL.md` diff against `main` with untracked folders and copies each hit, and the diff lists a deleted skill exactly like a changed one, so removing one skill made every run print `cp: cannot stat`. Provisioning still completed, which is why the defect survived: it degrades to noise rather than a failure. Fix the guard in the same branch as the deletion, and treat a non-fatal error printed mid-run as a defect, since a helper that reports a failed copy and continues provisions a tree nobody verified.

### An arm scoring a judgment is nondeterministic on the axis it scores

The `claude:review-pr` `repeat-close-out` arm failed its `^## Review closed` pin on its first run and passed it on the second against an unchanged fixture. The pin cannot be loose, since that heading is one of five fixed strings the skill body mandates and the pin anchors to the first line, so no phrasing variance reaches it. What varies is upstream: the pass reads a real refactor commit and decides whether it raises a finding, and a pass that legitimately raises one posts `## Review` and reddens the pin correctly.

No fixture can close that. The arm seeds a commit chosen to raise nothing and an independent pass is free to disagree, which is the judgment the skill exists to make rather than a defect to provision away. Read a red pin here as the arm scoring a judgment, and re-run before editing either the pin or the skill.

The general shape is worth carrying past this arm. An assertion over a fixed string the body mandates is deterministic, and one that depends on a pass electing to emit that string is not, so an arm mixing the two reports a verdict whose stability its own count does not show.

### A pending verdict pins the format its fixture asserts

Defer a format change that would retarget an assertion belonging to a verification nobody has run yet. The `task-board` plan proposed turning `Plan:` into a markdown link, which retargets the anchored regex in the `claude/docs` `drift` fixture, and that arm's verdict was another task's open outcome, so a failing run afterward could be read as neither skill defect nor format change. Grep the fixtures for assertions on a format before editing it and check whether any owning task still carries an unchecked verification outcome.

### A scenario's own prose can outrun a chained skill's guard

A `log_info` line describing what a downstream skill in a chain does is a claim to check against that skill's body, not a specification to copy into an assertion. `claude/auto-ship.sh`'s happy-path arm stated that a run "captures session memory and runs Propose over the pen," and `memory-capture`'s own guard stops with "Nothing worth capturing" when a session produced no user corrections, confirmations, or disclosures, which is the ordinary shape of a headless single-pass run with no interaction. The line was corrected rather than transcribed into a `paths` assertion that would fail every correct run, and the receipt's presence moved to `manual` under `Judgment:`. The general form travels past this one arm: writing an `expect.toml` assertion for a chained skill carrying a conditional stop needs a read of that skill's guard, since a scenario's descriptive prose can describe the case where the condition fires without saying so.

### A negative content pattern matches on any line rather than on the whole file

`checkContent` compiles a `[[content]]` pattern with the `m` flag and calls `.test()` against the whole file once, so a pin meant to assert a substring is absent anywhere in the file, such as a negative lookahead anchored `^(?!.*foo).*$`, instead matches on the first line that lacks the substring and passes even when a different line in the same file carries it. There is no assertion primitive for content absence. The working substitute is a `manual` entry stating the limitation, relying on the corresponding positive-content pin over the one invocation a step takes to cover the same ground from the other direction.

### A fixture modeling a timed heuristic has to outrun the window it is staged against

A scenario staging a long-running process for an arm that judges it by waiting a fixed window and then checking whether the process is still alive races that window when the fixture sleeps the same duration. Two independently-scheduled sleeps of equal length finish in whichever order machine load happens to put them in, so the arm reads flaky on the one axis it exists to prove reliable. `claude:setup-smoke`'s `dev` and `preview` fixtures sleep three times the skill's five-second check window for this reason. Stage a timed fixture to outlast its check window by a wide margin rather than matching it.

### A refusal arm that stages nothing still owes a commit call the check

`stage_setup` runs after the seed-injection commit provisioning already made, so an arm that changes nothing on disk of its own hits its own commit call against an empty diff. That exits 1 under `set -e` and aborts the scenario before its `log_step`/`log_info` lines print, leaving the raw "nothing to commit" text as the only surfaced output rather than the framed instructions the arm was written to show. Skip the commit call entirely on an arm whose fixture is the absence of a file, rather than committing an empty change.

### A skill needing an explicit request cannot pass on a bare headless prompt

`scripts/sandbox/run.sh` always passes the skill invocation bare, per `internal-sandbox-check` Step 6, with no `Action:` line or other narrative reaching the model: `stage_setup`'s `log_info` block prints to the provisioning log a human reads, not to the session the runner spawns. A skill whose own Guards route on an explicit request, rather than inferring one from tree state alone, stops `❌ Ambiguous` on that bare prompt regardless of how unambiguous the staged board looks to a reader. `claude:task-board` is this shape on all three arms: confirmed for `archive` and for `decline`, both of which ask for clarification rather than act. Passing the full command as `run.sh`'s prompt argument instead, the way a human's interactive session would type it, is what exercises the arm. The `Action:` line a scenario prints should spell that full command rather than a bare invocation, so a reader copying it interactively gets the same result a headless caller supplying it explicitly does.
