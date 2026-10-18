---
name: pr-evidence
description: What posting a pull request's rendered-surface evidence is for, the gaps it closes, and what it refuses to do
---

# PR evidence requirement

## Gap

Without this skill, the evidence a pull request carries is one step inside `git-pr`. A session refreshing the screenshots on a new head either reruns a title and body it did not mean to touch, or borrows the step's reference by path, and each copy drifts.

A session judging from the diff whether an evidence image changed cannot see a regenerated image it did not author, so the image ships with no comment. A reviewer holding screenshots and a checklist has nothing to click into, and a slow deploy holds the ship chain while it waits for an address.

## Must

- The evidence verb runs on every pull request it is given and `no-evidence` is the skip, so an unseen image never ships with no comment
- It runs alone against an open pull request, resolving the number from the branch when none is passed, and edits the one marked comment in place, so a re-post never duplicates the thread
- A pull request changing a rendered surface gets a preview address when the project's deploy can mint one, and the wait is bounded so a timeout finishes without the link
- The branch's running local server is linked when this worktree serves one, and the link drops when the pull request closes
- The skill is invoked by `git-pr`, `git-followup`, or `git-ship`, and a catalog review drops it when none does

## Must not

- Dispatch a deploy whose command names no branch, since Cloudflare Pages publishes such a deploy to production
- Create a pull request, or post against a number it guessed
- Call a GraphQL-backed `gh` subcommand, since the cloud review leg runs this skill through `git-followup`
- Print a result line of its own, since `git-pr` closes its report with the lines this skill returns
- Run without a number when none was passed and no open pull request resolves for the branch, and instead ask for it

## Out of scope

- The title, body, labels, and pre-publish scan, which `git-pr` owns
- Writing the checklist, which `ui-checklist` owns, leaving this skill to consume the handoff file and remove it after posting
- Driving the checklist in the running app, which `review-ui` owns
