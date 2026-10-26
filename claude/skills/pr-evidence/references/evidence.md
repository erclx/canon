---
title: Rendered-surface evidence
description: How pr-evidence finds the UI checklist and the local server, films a reel of the checklist's interactions, posts the evidence comparison or the checklist alone as the fallback for a git refusal, and adds the preview address, for a change that touches a rendered surface
---

# Rendered-surface evidence

The procedure of `pr-evidence`, run in order against one pull request number. It runs on every pull request with no test on the diff ahead of it, since `no-evidence` is the silent branch for one that changes no rendered surface.

## Contents

- [Find the UI checklist](#find-the-ui-checklist)
- [Find the local server](#find-the-local-server)
- [Film the reel](#film-the-reel)
- [Post the evidence comparison](#post-the-evidence-comparison)
- [Post the UI checklist alone](#post-the-ui-checklist-alone)
- [Post the preview address](#post-the-preview-address)

## Find the UI checklist

`ui-checklist` writes a visual checklist to `.canon/tmp/handoff/ui-checklist/<slug>.md` at the main worktree root when a change needs visual verification, with `<slug>` derived per `${CLAUDE_SKILL_DIR}/../git-branch/references/slug.md`. This skill is the file's sole consumer.

- Resolve the main root the way `session-worktree` does, `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-` falling back to `pwd`
- A missing file means no checklist was produced, and the two steps below each skip their checklist half
- Scan an existing file against `${CLAUDE_SKILL_DIR}/../git-pr/references/publish.md` before either step posts it, the same as the body
- The evidence step decides where it lands, since a checklist reads next to its screenshots and posting it alone is the fallback for a refused render

## Find the local server

A reviewer on the operator's machine can open the branch's running dev server, which screenshots and a checklist cannot stand in for. Ask the verb before the evidence step, so the first evidence comment already carries the link:

```bash
canon pr local --json
```

The verb reports the lowest port serving an HTML page whose process runs inside this worktree, never one in another worktree or the main checkout, which shows a different branch. `canon pr local --help` states the contract. Read `reason` on the record rather than the exit code.

- `ok`: hold the record's `url` for the evidence step below.
- `no-server`, `no-listener-reader`, `unhealthy`, or `invalid-config`: hold the reason and the record's `message` for the closing report, and pass no link.
- `unhealthy` means a page answered but a health path declared in `canon/config/local.toml` failed. `invalid-config` means that file cannot be read, so nothing was checked.
- Never start a server here, since the ship chain cannot own one. A worker starts one under `role-worker`.
- Anything else, including no record or an older binary's unknown-subcommand error: move on silently, as a skip rather than a stop.

### Where the link lands

Pass `--local` to the evidence step only on an `ok`. The binary answering `ok` is the one carrying the flag, so a binary lacking the verb never meets a flag it would reject.

- With a checklist, a diff carrying no evidence image still renders `ok`, and the link rides on the address line under `## Evidence`, above the checklist
- A link with neither an evidence image nor a checklist still reports `no-evidence`, so a branch changing no rendered surface gets no comment holding a link alone
- A seeded workflow drops the whole address line once the pull request closes, hosted and local together, so neither link outlives its branch

## Film the reel

A screenshot cannot show an interaction move, so a pull request whose checklist asks a reviewer to click, fill, or scroll gets one short looping reel of it in the evidence comment. Run this step only on an `ok` from the local step, since the reel films the running server and this skill never starts one.

Read what the comment already carries first, since a later head reaches this step with the handoff file deleted:

```bash
canon pr evidence <number> --check --json
```

- Take the checklist from the handoff file when one exists, and from the record's `checklist` field otherwise
- Skip filming when the record's `reel.head` is a prefix of the `tip` that `canon pr head <number> --json` reports, since the posted reel already shows this head
- With no checklist from either source, skip silently, since nothing names an interaction to film

Invoke `canon:ui-record` in pull request mode, passing the number, the local `url`, and the checklist. It films, checks each beat's closing still, pushes the reel to `canon/frames`, and hands back a `link` or a skip reason.

Report it rather than proceeding silently when `canon:ui-record` does not resolve, and post the evidence without a reel.

- Hold a `link` for the evidence step, which embeds it under the addresses
- Hold a skip's reason and message for the closing report. A skip never stops the chain, and a reel already on the comment carries forward under the older head it names.

## Post the evidence comparison

Run the verb once against the pull request number. Pass `--checklist` when the checklist step found a file, `--local` when the local step returned `ok`, and `--reel` when the reel step returned a link, and leave each flag off otherwise:

```bash
canon pr evidence <number> --checklist <main-root>/.canon/tmp/handoff/ui-checklist/<slug>.md --local <url> --reel <link> --json
```

One call answers both questions because a checklist decides `no-evidence`. A diff carrying a checklist and no evidence image renders `ok` with the checklist in a marked body, so the checklist lands in the one comment a later call finds and edits.

- Pass `--checklist` only for a file that exists
- The verb refuses as `unreadable-checklist` on a path it cannot read or one holding nothing, a caller bug rather than a transient failure
- Stop and repair the path on that refusal rather than posting a body with the checklist silently dropped

### Reading the record

Read `reason` on the record rather than the exit code.

- `no-evidence`: nothing changed under an `evidence/` segment and no checklist was passed. Say nothing about the evidence and move on.
- `ok`: write `body` to `.canon/tmp/pr/evidence/body-<number>.md` at the main worktree root, then post or update the comment:

```bash
gh api -X POST repos/{owner}/{repo}/issues/<number>/comments -F body=@<main-root>/.canon/tmp/pr/evidence/body-<number>.md --silent
```

Both posts in this file use the REST issue-comments endpoint, since the `gh pr` subcommands run on GraphQL and a cloud session's GitHub proxy refuses it. `git-followup` runs this skill, so a GraphQL post here would break the cloud review-address leg.

When the record carries a `commentId`, edit that comment in place instead of posting a second. The body reads from the tmp file with `@`, which needs `-F`, since `-f` posts the path itself as the body:

```bash
gh api -X PATCH repos/{owner}/{repo}/issues/comments/<commentId> -F body=@<main-root>/.canon/tmp/pr/evidence/body-<number>.md
```

Delete the handoff file and the tmp body once that call reports success, per the cleanup below, since the checklist now lives on the pull request.

### Git refusals

Any other `reason` is a mirrored git refusal, being `gh-missing`, `gh-failed`, `no-base`, `unreadable-changes`, or `would-empty`. Report it and move on without stopping the chain, since a branch that rarely carries evidence images should not fail on a transient read.

Fall through to the checklist step, which posts the checklist alone rather than losing it.

## Post the UI checklist alone

Run this step only as the fallback, when the evidence step reported a git refusal and a checklist file exists, since every other branch with a checklist rendered `ok` and carried it. The comment carries no marker, so a later `canon pr evidence` call reports no `checklist` for it.

```bash
gh api -X POST repos/{owner}/{repo}/issues/<number>/comments -F body=@<main-root>/.canon/tmp/handoff/ui-checklist/<slug>.md --silent
```

### Cleanup

Run the cleanup only once the call that carried the checklist reports success, whichever step that was. On a failure, stop and leave the file, since a retry needs it and deleting it loses the only copy.

The cleanup is a main-root delete, so it goes out as a plain `rm` and then a plain `rmdir`, routed the way `session-worktree` states:

```bash
rm <main-root>/.canon/tmp/handoff/ui-checklist/<slug>.md
```

```bash
rmdir <main-root>/.canon/tmp/handoff/ui-checklist 2>/dev/null || true
```

- The `rmdir` is a no-op while another branch's pending checklist sits in the folder, so this step never deletes a handoff not its own
- `git-followup` re-runs `canon pr evidence` with no `--checklist`, and the verb carries the checklist forward out of the comment it edits
- A tick survives a render at the head its stamp names and is cleared by one at a newer head, so the next UI pass earns it again

## Post the preview address

Run this step when the evidence step returned `ok`, the fallback posted a checklist, or `canon pr evidence <number> --check --json` lists `preview` in `owed`. Otherwise skip it silently.

- The first two mean the pull request changes a rendered surface, and a reviewer holding a checklist with no screenshots needs the live page most
- The third is how `git-ship` reaches this step alone when an earlier run's deploy timed out
- An evidence record carrying a `commentId` takes the third alone, since a preview already on the comment counts as settled whatever head built it, so a later push does not re-mint one
- The evidence comment is already posted, so the reviewer has the screenshots while the deploy runs

```bash
canon pr preview <number> --json
```

### What the verb refuses

The verb dispatches the project's Pages deploy on the pull request's branch and waits on the run for up to 15 minutes. `canon pr preview --help` states the contract. It refuses before dispatching anything in two cases.

- The deploy command passes no `--branch`, since that deploy would publish the branch to production
- The workflow's push path filter matches no changed path, since a dispatch ignores that filter and the site would show none of the change

### Reading the preview record

Read `reason` on the record rather than the exit code.

- `ok`: re-render the evidence body with the address under `## Evidence`, then post or update it as the evidence step does, through the same tmp file and the record's `commentId`:

```bash
canon pr evidence <number> --preview <url> --json
```

The hosted address opens the address line, and a local link already on the comment follows it, carried forward with no flag.

- `no-deploy` or `unserved`: the project deploys nothing a dispatch can start, or its site builds from nothing this branch changed. Say nothing and move on.
- `unfenced`, `no-alias`, `run-failed`, `timeout`, or a mirrored `gh` refusal: report the record's `message` and move on without stopping the chain
- A missing link costs the reviewer a click, and a held ship costs the whole chain
