---
title: Rendered-surface evidence
description: How git-pr finds the UI checklist and the local server, posts the evidence comparison or the checklist alone as the fallback for a git refusal, and adds the preview address, for a change that touches a rendered surface
---

# Rendered-surface evidence

The rendered-surface step of `git-pr`, reached after the final command printed the pull request number. The step runs on every pull request, with no test on the diff ahead of it. `no-evidence` is the silent branch, so a pull request that changes no rendered surface posts nothing.

## Contents

- [Find the UI checklist](#find-the-ui-checklist)
- [Find the local server](#find-the-local-server)
- [Post the evidence comparison](#post-the-evidence-comparison)
- [Post the UI checklist alone](#post-the-ui-checklist-alone)
- [Post the preview address](#post-the-preview-address)

## Find the UI checklist

`ui-checklist` writes a visual checklist to `.canon/tmp/handoff/ui-checklist/<slug>.md` at the main worktree root when a change needs visual verification, with `<slug>` derived per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. This skill is the file's sole consumer. Resolve the main root the way `session-worktree` does (`git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd`) and check for the file there. A missing file means no checklist was produced, and the two steps below each skip their checklist half.

When it exists, scan it against `${CLAUDE_SKILL_DIR}/../../standards/publish.md` before either step posts it, the same as the pull request body in the skill's pre-publish scan.

Where it lands is decided by the evidence step below rather than here, since a checklist reads next to the screenshots it annotates and posting it on its own is the fallback for a refused render.

## Find the local server

A reviewer on the operator's machine can open the branch's running dev server, which screenshots and a checklist cannot stand in for. Ask the verb for the server this worktree is running before the evidence step, so the first evidence comment already carries the link:

```bash
canon pr local --json
```

The verb reads the listening sockets on this machine, keeps those whose process runs inside this worktree, and reports the lowest port serving an HTML page. A server in another worktree or in the main checkout is never reported, since it shows a different branch. `canon docs pr-local` states the contract. Read `reason` on the record rather than the exit code.

- `ok`: hold the record's `url` for the evidence step below.
- `no-server` or `no-listener-reader`: hold the reason for the closing report, pass no link, and move on. Do not start a server here, since one started inside the ship chain has no owner to stop it.
- Anything else, including no record at all: move on silently. An installed binary older than the verb answers with an unknown-subcommand error, which is a skip rather than a stop.

Pass `--local` to the evidence step only on an `ok` here. The binary answering `ok` is the one carrying the flag, so a binary lacking the verb never meets a flag it would reject.

With a checklist, a diff carrying no evidence image still renders `ok`, and a local link rides in the same comment on the address line under `## Evidence`, above the checklist, so a reviewer gets both in one place. A local link with neither an evidence image nor a checklist still reports `no-evidence`, which keeps a branch that changed no rendered surface from getting a comment holding a link and nothing else.

A seeded workflow drops the whole address line once the pull request closes, hosted and local segments together and with no note in their place, so neither link outlives the branch it points at.

## Post the evidence comparison

Run the verb once against the number the skill's final command printed. Pass `--checklist` when the checklist step found a file, and `--local` when the step above returned `ok`. Leave each flag off otherwise:

```bash
canon pr evidence <number> --checklist <main-root>/.canon/tmp/handoff/ui-checklist/<slug>.md --local <url> --json
```

One call answers both questions because a checklist decides `no-evidence`. The verb renders `ok` on a diff carrying a checklist and no evidence image, with a marked body holding the checklist, so the checklist always lands in the one comment a later call finds and edits. Without a checklist, a diff carrying no evidence image reports `no-evidence`.

Pass `--checklist` only for a file that exists. The verb refuses as `unreadable-checklist` on a path it cannot read or one holding nothing, which is a caller bug rather than a transient failure, so stop and repair the path rather than posting a body with the checklist silently dropped.

Read `reason` on the record rather than the exit code.

- `no-evidence`: nothing changed under an `evidence/` segment and no checklist was passed, so no body was rendered. Say nothing about the evidence and move on.
- `ok`: write `body` to `.canon/tmp/pr/evidence/body-<number>.md` at the main worktree root (resolved the way `session-worktree` does), then post or update the comment:

```bash
gh api -X POST repos/{owner}/{repo}/issues/<number>/comments -F body=@<main-root>/.canon/tmp/pr/evidence/body-<number>.md --silent
```

Both posts in this file go through the REST issue-comments endpoint, since the `gh pr` subcommands run on GraphQL and a cloud session's GitHub proxy refuses it. `git-followup` mints a preview through this file, so a GraphQL post here would break the cloud review-address leg.

When the record carries a `commentId`, edit that comment in place instead of posting a second one, reading the body field from the tmp file with `@`, which needs the typed-field flag `-F` because the raw-string flag `-f` posts the path itself as the body:

```bash
gh api -X PATCH repos/{owner}/{repo}/issues/comments/<commentId> -F body=@<main-root>/.canon/tmp/pr/evidence/body-<number>.md
```

Delete the handoff file once that call reports success, per the cleanup below, since the checklist now lives on the pull request. Clean up the tmp body file the same way.

Any other `reason` is one of the mirrored git refusals (`gh-missing`, `gh-failed`, `no-base`, `unreadable-changes`, `would-empty`). Report it and move on without stopping the chain: a branch that carries no evidence images most of the time should not fail here on a transient git or `gh` read. Fall through to the checklist step, which posts the checklist alone rather than losing it to a transient read.

## Post the UI checklist alone

Run this step only as the fallback, when the evidence step above reported one of the git refusals and a checklist file exists, since every other branch with a checklist rendered `ok` and carried it. The comment this posts carries no marker, so a later `canon pr evidence` call reports no `checklist` for it. Post it as its own comment on `<number>`:

```bash
gh api -X POST repos/{owner}/{repo}/issues/<number>/comments -F body=@<main-root>/.canon/tmp/handoff/ui-checklist/<slug>.md --silent
```

Run the cleanup below only once the call that carried the checklist reports success, whichever of the two steps that was. On a failure, stop and leave the file in place: a retry needs the checklist to still be there, and deleting it on a failed post loses the only copy with nothing landed on the pull request.

The cleanup is a main-root delete, so it goes out as a plain `rm` and then a plain `rmdir`, the file and then the folder, routed the way `session-worktree` states:

```bash
rm <main-root>/.canon/tmp/handoff/ui-checklist/<slug>.md
```

```bash
rmdir <main-root>/.canon/tmp/handoff/ui-checklist 2>/dev/null || true
```

The `rmdir` is a no-op when another branch's pending checklist still sits in the folder, which keeps this step from deleting a handoff that is not its own.

Deleting the file is what makes the later re-render safe. `git-followup` re-runs `canon pr evidence` with no `--checklist`, and the verb carries the checklist forward out of the comment it is editing, so the boxes a reviewer already ticked survive the push.

## Post the preview address

Run this step when the evidence step above returned `ok`, a checklist was posted by the fallback, or `canon pr evidence <number> --check --json` lists `preview` in `owed`. The first two mean the pull request changes a rendered surface, and a reviewer holding a checklist with no screenshots needs the live page most. The third is how `git-ship` reaches this step alone when an earlier run's deploy timed out, so no evidence step ran in the current one. Otherwise skip it silently.

The evidence comment is already posted, so the reviewer has the screenshots while the deploy runs. Mint the preview against the same `<number>`:

```bash
canon pr preview <number> --json
```

The verb dispatches the project's Pages deploy on the pull request's branch and waits on the run for up to 15 minutes. It refuses before dispatching anything when the deploy command passes no `--branch`, since that deploy would publish the branch to production, and when the workflow's own push path filter matches no path the pull request changed, since a dispatch ignores that filter and the site it published would show none of the change. `canon docs pr-preview` states the contract. Read `reason` on the record rather than the exit code.

- `ok`: re-render the evidence body with the address on the line under `## Evidence`, then post or update it exactly as the evidence step does, through the same tmp file and the `commentId` the record carries:

```bash
canon pr evidence <number> --preview <url> --json
```

The hosted address opens the address line and a local link already on the comment follows it on the same line, carried forward with no flag.

- `no-deploy` or `unserved`: the project deploys nothing a dispatch can start, or nothing this branch changed is something its site builds from. Say nothing and move on.
- Any other `reason`, being `unfenced`, `no-alias`, `run-failed`, `timeout`, or a mirrored `gh` refusal: report it with the record's `message` and move on without stopping the chain. A missing link costs the reviewer a click, and a held ship costs the whole chain.
