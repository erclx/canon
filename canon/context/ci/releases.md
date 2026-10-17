---
title: Releases
description: The release pull request, the publish job and its credential preflight, the newest-release check, manual dispatch, and the capture-frame refresh
---

# Releases

## Decisions

### The release pull request

`release-please.yml` runs on every push to `main` and keeps a release pull request open, rewriting it as commits land. Merging it cuts a tag and writes `CHANGELOG.md`, so a release is a merge rather than a hand-run command. `claude/skills/git-commit/references/versioning.md` specifies both surfaces.

Two files configure it.

- `release-please-config.json` holds the release type and the extra-files wiring
- `.release-please-manifest.json` holds the current version and is the file the tool rewrites, anchored at `0.1.0` to match `package.json`
- `bootstrap-sha` pins the starting commit, since without it a first run computes a version from every untagged commit and picks one nobody chose
- Tags read `v<major>.<minor>.<patch>` because `include-component-in-tag` is false, matching the versioning standard where the default would prefix the package name

### Plugin manifest version

The plugin manifest version is written through `extra-files` rather than by hand. `plugin.json` overrides the enclosing marketplace entry for name and version, and `claude plugin tag` refuses to tag when the two disagree, so a version the release tool does not own goes stale unwatched.

### Release job concurrency

The `release-please` job carries its own `concurrency` group scoped to that job, and a newer push queues behind a started instance rather than cancelling it. The group cancelled in-progress instances until run 36246158157.

- That run's job created the v5.0.0 GitHub release and was cancelled nine seconds later by a capture-refresh auto-merge run
- The action sets `release_created` and `tag_name` only after its label and comment calls, so the cancel landed before the outputs existed, publish skipped, and 5.0.0 never reached the registry
- Six of 223 release merges since the cancel was added had the job cancelled, and 5.0.0 was the one that landed in that gap
- Queuing costs a pending run about ten seconds, and GitHub still replaces a pending run with a newer one, so a burst computes against the newest commit

### Formatter exclusions

The tool writes four files and oxfmt disagrees with its serialization of two. The `ignorePatterns` in `.oxfmtrc.jsonc` carry `**/.claude-plugin/*.json` and `/CHANGELOG.md`, which leaves the generator as their only formatter.

- A pattern with an interior slash anchors to the config file's directory and one with none matches at any depth, so the manifest entry needs widening and the changelog entry needs pinning to the root
- `.release-please-manifest.json` and `package.json` need no entry, since `oxfmt --check` accepts what the tool writes and an ignore would hide real drift later
- Treat the four files as one unit, since covering one at a time misses that the others need the same fix

### The publish job

A `publish` job on the same workflow ships `@erclx/canon` to the registry. It gates on `release_created` rather than the push, so it fires once per release, and it checks out `tag_name` so the tarball matches the tag. The `NPM_TOKEN` secret is the one piece of the release path outside version control.

- It publishes with `--ignore-scripts`, because `npm publish` runs `prepare` before packing and `prepare` is `husky`, which a job that installs nothing cannot resolve
- It sits outside every `concurrency` group, since a push landing mid-`npm publish` must never cancel it and leave a tag and release with no package
- Sharing the `release-please` group would not queue it safely, since a newer run's pending job can take its place and GitHub cancels the pending job it replaces
- Keeping publish out of the group is not enough alone, because a cancel inside `release-please` after the release exists skips publish just as surely, which is why that group queues

### The npm version pin

`--ignore-scripts` is honored by npm 11 and ignored by npm 10, measured against a clean clone. Under `npm@10.9.9` `prepare` runs anyway, `husky` is absent, and publish exits 127. `npm@11.7.0` honors the flag.

- `NPM_CONFIG_IGNORE_SCRIPTS=true` and `npm@10 pack --ignore-scripts` fail the same way, so a two-step pack and publish is no route around it
- `node-version: 22` bundles npm 10, so the job installs `npm@11` in its own step before publishing
- The trade is a pin nothing reports as stale, taken over rewriting `prepare` to tolerate a missing husky, which would hide a broken hook install where hooks matter

### The credential preflight

A preflight step gates the release job on the registry credential before release-please runs, so a tag is never cut that cannot be published. It calls the registry's `whoami` endpoint with the token rather than testing the variable is non-empty, which catches an expired or revoked token as well as a missing one.

Every push to `main` fails while the secret is absent or stale, including pushes that would cut no release. That is the intended trade, since the alternative reports the fault after the tag and release exist, where the only repair is publishing the tag by hand.

### Release token

The release step authenticates with a `RELEASE_PLEASE_TOKEN` repository secret rather than the default `GITHUB_TOKEN`. Under the default, `app/github-actions` authors the release pull request and GitHub counts it as a first-time contributor, so `verify.yml` queued in `action_required` and reported no checks until a maintainer approved each release.

Automated release commits are attributed to a person in history rather than the bot, which is the trade. If a release pull request reports a bare "no checks" again, read it as pending approval and check which token the step passes.

### Manual dispatch

A `workflow_dispatch` input publishes a tag on its own. Supplying `tag` skips the release-please job and checks that ref out for publish, so a tag with nothing on the registry ships without a local publish. Leaving it empty runs the ordinary path.

- Both gates name `github.event_name` rather than testing the input alone, since on a push the `inputs` context is empty and a bare `inputs.tag == ''` holds only through null-to-empty coercion
- Naming the event writes the intent, which matters because the publish job cannot be exercised before it merges and a wrong reading would surface as releases quietly stopping
- The dispatch path skips the credential preflight, which is acceptable because the tag already exists and a bad token fails the publish step directly

### The publish check

The `publish-check` job reports the tag and registry disagreeing. It runs on every push, needs no other job, and reads the newest GitHub release. It never runs on a dispatch, so the recovery path stays open while the gap it repairs exists.

- It passes while the release is under 15 minutes old, since the publish job beside it may still be running
- Otherwise it fails with an `::error` naming the tag and the `gh workflow run release-please.yml -f tag=<tag>` repair, when npm does not serve that version
- It reads the package's whole version list, because npm answers a missing version with an E404 and nonzero exit that a single-version read cannot tell from an outage
- A release it cannot read or a registry it cannot reach fails the run rather than passing

It reads only the newest release, so a lost release followed by a successful one goes unreported, which is where 5.0.0 sits. That version stays a GitHub-only release by the operator's decision, since nobody could have installed it and 5.1.0 carries its change.

### The capture-frame refresh

`refresh-capture-frames.yml` installs `fonts-noto-mono` before the capture step, because the frames declare Noto Sans Mono and the capture guard refuses any render that falls back to another face. On Ubuntu 24.04 that package ships Noto Sans Mono and `fonts-noto-core` ships none of it.

Nothing in the gate sees the absence, since the workflow runs only after a merge, so a `Check Frame Font` step fails by family name ahead of the capture.

### Hooks in the refresh push

The commit-and-push step runs with `HUSKY: 0`, because `pre-push` runs `bun run check` and its format check shells out to `shfmt`, which the runner does not install, so the push is refused and no pull request opens.

- Installing the tool fixes one missing tool per failure, scoping edits `.husky/pre-push` for every other pusher, and `--no-verify` leaves `commit-msg` live
- The pull request the push opens runs every stage in `verify.yml` against the source, so the local gate is not the only check
- `readme-screenshot.yml` carries the same setting for a narrower reason, since a target's base `check` runs no shell tool and the push carries PNG bytes the hooks cannot read
- Nothing local reproduces a missing runner tool, so only a run on `main` proves the fix

### Scope of the refresh

`refresh-capture-frames.yml` also owns the home page baseline in `assets/evidence/home/`, through `scripts/core/capture-home.sh`, the script `pr-visual-checks.yml` runs. It rides the hero frames' branch and pull request, since one merge moves both sets and the `concurrency` group already serializes runs.

- Its path filter adds `web/**` and `src/audits/**`, the render inputs the hero frames do not share
- It adds `package.json`, whose version the page footer and nav print, and `governance/stacks/**`, which both renders count
- `assets/**` stays off because that folder holds this job's own outputs
- The pull request job only reports whether frames match and never commits back to a pull request branch
- The job runs only on `main`, since it force-pushes a branch from whatever ref it started on and a dispatch elsewhere would carry that ref's whole diff into the open refresh pull request

### Auto-merge and stale bases

The refresh pull request merges itself. The job queues `gh pr merge --auto --squash` on every run, so it lands once `🛡️ Static Checks` passes, the one check the main ruleset requires.

- A manual merge lost twice over: the review repeated what that check proves, and the pull request sat open long enough to race the next merge and leave branches comparing against stale frames
- The pull request stays, since a commit reaching `main` with none is still ruled out
- Auto-merge needs the repository's `allow_auto_merge` setting on, which the operator owns

A run renders from the commit that started it, so one started before a refresh merged would open a pull request reverting the newer frames. The push step commits the frames where they rendered, fetches `main`, rebuilds the branch on it, and carries across only the files that commit wrote or dropped.

Each file moves whole, so the carry cannot conflict, and a frame this job never renders, such as the social card, keeps what `main` merged mid-run. When `main` already holds the same bytes the run exits with nothing to push.

## Gotchas

### Font determinism across runners

The refresh runner installs `fonts-noto-mono` and the pull request runner does not. The page sets every `code`, `kbd`, `samp` and `pre` to `font-family: inherit` in `web/src/styles/global.css`, and the inherited face is Geist, embedded in `web/src/layouts/base.astro`, so the mono font reaches no text on the page.

What remains is glyph fallback, and byte-determinism was measured across two runs of one job rather than across the two runners.
