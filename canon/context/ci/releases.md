---
title: Releases
description: The release pull request, the publish job and its credential preflight, the check that the newest release reached npm, manual dispatch, and the capture-frame refresh that runs after a merge
---

# Releases

## The release pull request

`release-please.yml` runs on every push to `main` and keeps a release pull request open, rewriting it as commits land. Merging that pull request is what cuts a tag and writes `CHANGELOG.md`, so a release is a merge rather than a hand-run command. `standards/versioning.md` specifies both surfaces.

The `release-please` job carries its own `concurrency` group, scoped to that job rather than to the workflow, and a newer push queues behind a started instance rather than cancelling it. The group cancelled in-progress instances until run 36246158157, whose job created the v5.0.0 GitHub release and was then cancelled by the run a capture-refresh auto-merge started nine seconds after it. The action sets `release_created` and `tag_name` only after its label and comment calls, so the cancel landed in the second between the release existing and the outputs being written, publish skipped, and 5.0.0 never reached the registry. Six of the 223 release merges since the cancel was added had the job cancelled, and 5.0.0 was the one where it landed inside that gap.

Queuing costs a pending run the ten seconds or so the one ahead of it takes. GitHub still replaces a pending run with a newer one, so a burst of pushes computes against the newest commit rather than against each in turn, which was what the cancel had been added for.

Two files configure it. `release-please-config.json` holds the release type and the extra-files wiring, and `.release-please-manifest.json` holds the current version and is the file the tool rewrites. Tags read `v<major>.<minor>.<patch>` because `include-component-in-tag` is false, which matches what the versioning standard specifies. The default would prefix the package name.

The plugin manifest version is written through `extra-files` rather than by hand. `plugin.json` overrides the enclosing marketplace entry for both name and version, and `claude plugin tag` refuses to tag when the two disagree, so a version the release tool does not own risks going stale with nobody watching.

`bootstrap-sha` pins the starting commit to the head this work branched from, and the manifest anchors at `0.1.0` to match what `package.json` claims. Without both, a first run computes a version from every untagged commit and picks one nobody chose.

The tool writes four files, and prettier disagrees with its serialization of two. `.prettierignore` carries `**/.claude-plugin/*.json` and `/CHANGELOG.md`, which leaves the generator as their only formatter. Both prefixes are deliberate: a pattern with an interior slash anchors to the ignore file's directory and one with none matches at any depth, so the manifest entry needs widening and the changelog entry needs pinning to the root.

`.release-please-manifest.json` and `package.json` need no entry, since `prettier --check` already accepts what the tool writes for both, and an ignore over a file the formatter already agrees with would hide real drift later. Treat the four files as one unit, since covering only one at a time misses that the others need the same fix.

## The publish job

A `publish` job on the same workflow ships the package to the registry as `@erclx/canon`. It is gated on the `release_created` output rather than on the push, so it fires once per release rather than on every commit that lands on `main`, and it checks out `tag_name` so the tarball matches the tag rather than whatever `main` moved to afterward. It publishes with `--ignore-scripts`, because `npm publish` runs `prepare` before packing and `prepare` is `husky`, which a job that installs nothing cannot resolve. The registry credential is an `NPM_TOKEN` repository secret, the one piece of the release path that is not in version control.

This job sits outside every `concurrency` group. A push landing while it is mid-`npm publish` must never cancel it, since a cancelled publish leaves a tag and a GitHub release with no package behind them. Sharing the `release-please` group would not queue it safely either, since a newer run's pending job can take its place in the queue and GitHub cancels the pending job it replaces. Keeping publish out of the group is not enough on its own, because a cancel inside `release-please` after the release exists and before its outputs are set skips publish just as surely, which is why that group queues.

`--ignore-scripts` is honored by npm 11 and ignored by npm 10, measured against a clean clone. Under `npm@10.9.9` the flag does nothing and `prepare` runs anyway, which is `husky`, absent in a job that installs nothing, so publish exits 127. `npm@11.7.0` honors it.

The env form `NPM_CONFIG_IGNORE_SCRIPTS=true` fails the same way, and so does `npm@10 pack --ignore-scripts`, so the flag is ignored for the whole pack lifecycle rather than for publish alone and a two-step pack and publish is not a route around it. `node-version: 22` resolves a runtime that bundles npm 10, so the job installs `npm@11` in its own step before publishing. The trade is a pin that nothing reports as stale, taken over rewriting `prepare` to tolerate a missing husky, which would hide a broken hook install on the machine where hooks matter.

A preflight step gates the release job on that credential before release-please runs, so a tag is never cut that cannot be published. It calls the registry's `whoami` endpoint with the token rather than testing the variable is non-empty, which is what catches an expired or revoked token as well as a missing one. The cost is that every push to `main` fails while the secret is absent or stale, including pushes that would cut no release. That is the intended trade, since the alternative reports the same fault after the tag and the GitHub release already exist, where the only repair is publishing the tag by hand.

## Authentication and manual dispatch

The release step authenticates with a `RELEASE_PLEASE_TOKEN` repository secret rather than the default `GITHUB_TOKEN`. Under the default token the release pull request is authored by `app/github-actions`, which GitHub counts as a first-time contributor, so `verify.yml` queued in `action_required` and reported no checks until a maintainer approved the run on every release. A pull request authored by the token owner runs its checks unattended.

The cost is that automated release commits are attributed to a person in the history rather than to the bot, which is the trade rather than a side effect worth hiding. If a release pull request ever reports a bare "no checks" again, read it as pending approval rather than as a branch nothing gates, and check which token the step is passing.

A `workflow_dispatch` input publishes a tag on its own. Supplying `tag` skips the release-please job entirely and checks that ref out for publish, so a tag that exists with nothing on the registry can be shipped without a local publish. Leaving it empty runs the ordinary path.

Both gates name the event rather than testing the input alone. On a push the `inputs` context is empty, so a bare `inputs.tag == ''` holds only because GitHub casts a null and an empty string to the same number before comparing. That is correct today, and it is the whole release path resting on a coercion rule nothing in the repository states.

Naming `github.event_name` writes the intent instead, which matters more here than elsewhere because the publish job cannot be exercised before it merges, so a wrong reading would surface as releases quietly stopping rather than as a failing check.

The dispatch path also skips the credential preflight, which sits in the skipped job, and that is acceptable because the tag already exists by then, so the ordering the preflight protects no longer applies and a bad token fails the publish step directly. This is the recovery path for the tag and the registry disagreeing, not a guard against them disagreeing.

The `publish-check` job is what reports the disagreement. It runs on every push, needs no other job, and reads the newest GitHub release. It passes while that release is under 15 minutes old, since the publish job beside it may still be running, and otherwise fails with an `::error` naming the tag and the `gh workflow run release-please.yml -f tag=<tag>` command that repairs it when npm does not serve that version. It reads the package's whole version list rather than the one version, because npm answers a missing version with an E404 and a nonzero exit, which a single-version read cannot tell from an outage. A release it cannot read, or a registry it cannot reach, fails the run rather than passing. It never runs on a dispatch, so the recovery path stays open while the gap it repairs exists.

It reads only the newest release, so a lost release followed by a successful one goes unreported, which is where 5.0.0 sits. That version stays a GitHub-only release by the operator's decision, since nobody could have installed it and 5.1.0 carries its change.

## The capture-frame refresh

`refresh-capture-frames.yml` installs `fonts-noto-mono` before the capture step, because the frames declare Noto Sans Mono and the capture guard refuses any render that falls back to another face. Nothing in the gate sees the absence, since the workflow runs only after a merge, so a `Check Frame Font` step fails by family name ahead of the capture. On Ubuntu 24.04 that package ships Noto Sans Mono and `fonts-noto-core` ships none of it.

The commit-and-push step runs with `HUSKY: 0`, because `pre-push` runs `bun run check` and its format step shells out to `shfmt`, which the runner does not install, so without it the push is refused and no pull request opens. Installing the tool, scoping the hook, and `--no-verify` were the alternatives. Installing fixes one missing tool per failure, scoping edits `.husky/pre-push` for every other pusher, and `--no-verify` leaves `commit-msg` live. The pull request the push opens runs every stage in `verify.yml` against the source, so the local gate is not the only check. The `readme-screenshot.yml` config carries the same setting for the same reason, and the CI workflow rule states it. Nothing local reproduces a missing runner tool, so only a run on `main` proves the fix.

`refresh-capture-frames.yml` also owns the home page baseline in `assets/evidence/home/`, through `scripts/core/capture-home.sh`, the same script `pr-visual-checks.yml` runs. It rides the branch and pull request of the hero frames, since one merge moves both sets and the `concurrency` group already serializes runs. A second job would need its own merge order against the first.

Its path filter adds `web/**` and `src/audits/**`, the two render inputs the hero frames do not share, plus `package.json`, whose version the page footer and nav print, and `governance/stacks/**`, which both renders count. `assets/**` stays off, because that folder holds this job's own outputs. The pull request job only reports whether its frames match rather than committing back to a pull request branch.

The refresh pull request merges itself. The job queues `gh pr merge --auto --squash` on every run, so it lands once `🛡️ Static Checks` passes, which is the one check the main ruleset requires. A person merging it by hand was the alternative, and it lost twice over: the review repeated what that check proves, and the pull request sat open long enough for the next merge to race it and for open branches to compare against stale frames. The pull request stays, since a commit reaching `main` with none is still ruled out. Auto-merge needs the repository's `allow_auto_merge` setting on, which the operator owns rather than the workflow.

Auto-merge shortens the window without closing it, because a run renders from the commit that started it. A run started before a refresh merged would otherwise push from the older base and open a pull request reverting the newer frames. The push step therefore commits the frames where they rendered, fetches `main`, rebuilds the branch on it, and carries across only the files that commit wrote or dropped. Each one moves whole, so the carry cannot conflict, and a frame this job never renders, such as the social card, keeps whatever `main` merged mid-run rather than reverting to the run's starting copy. When `main` already holds the same bytes, the run exits with nothing to push.

The job runs only on `main`, since it checks out a branch from whatever ref it started on and force-pushes it, so a dispatch elsewhere would carry that ref's whole diff into the open refresh pull request.

One risk stays unmeasured. The refresh runner installs `fonts-noto-mono` and the pull request runner does not. The page sets every `code`, `kbd`, `samp` and `pre` to `font-family: inherit` in `web/src/styles/global.css`, and the face they inherit is Geist, embedded in `web/src/layouts/base.astro`, so that font reaches no text on the page. What remains is glyph fallback, and byte-determinism was measured across two runs of one job rather than across the two runners.
