---
name: pr-evidence
description: What posting a pull request's rendered-surface evidence is for, the gaps it closes, and what it refuses to do
---

# PR evidence requirement

## Gap

Without this skill, the evidence a pull request carries is one step inside `git-pr`. A session refreshing the screenshots on a new head either reruns a title and body it did not mean to touch, or borrows the step's reference by path. Two skills borrowed it that way, and each copy drifted.

A session judging from the diff whether an evidence image changed cannot see a regenerated image it did not author, so the image ships with no comment. A reviewer holding screenshots and a checklist has nothing to click into, and a slow deploy holds the ship chain while it waits for an address.

## Must

- Run the evidence verb on every pull request it is given and let `no-evidence` be the skip, since asking a session to look lets an unseen image ship with no comment
- Run alone against an open pull request, resolving the number from the branch when none is passed, so a later head gets evidence without a body rewrite
- Edit the one marked comment in place on a later run, so a re-post never duplicates the thread or drops a carried checklist
- Put a preview address on a pull request changing a rendered surface when the project's deploy can mint one, since a reviewer needs a page to click into
- Bound the wait on that preview and finish without the link on a timeout, since a slow deploy must not hold the ship
- Link the branch's running local server when this worktree serves one, since a reviewer on the operator's machine can drive the branch
- Drop that link when the pull request closes, since a link outliving its branch points at whatever runs there next

## Must not

- Dispatch a deploy whose command names no branch, since Cloudflare Pages publishes such a deploy to production
- Create a pull request, or post against a number it guessed, since a write to a wrong number lands on another branch's thread
- Call a GraphQL-backed `gh` subcommand, since the cloud review-address leg runs this skill through `git-followup`
- Print a result line of its own, since `git-pr` prints one and its report ends with the lines this skill returns
- Exist only for the author to type its name. `git-pr`, `git-followup`, and `git-ship` each invoke it, and a review of the catalog drops it when none does.

## Guards

- Stop and ask for the number when none was passed and no open pull request resolves for the branch

## Out of scope

- The title, body, labels, and pre-publish scan, which `git-pr` owns
- Writing the checklist, which `ui-checklist` owns. This skill only consumes the handoff file and removes it after posting.
- Driving the checklist in the running app, which `review-ui` owns
