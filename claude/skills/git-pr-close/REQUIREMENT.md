---
name: git-pr-close
description: What closing a pull request unmerged is for, the gap it closes, and how it splits from merging and from the verb it calls
---

# Git PR close requirement

## Gap

Without this skill, a session asked to close a pull request improvises a bare close. Most hand-closed pull requests then carry no reason, so a reader who finds one later cannot tell a rejected idea from a superseded one or a pause. No `git-*` skill covered the act, so the request had nowhere to route.

## Must

- Every close goes through `canon pr close`, which refuses without a reason and posts it before the close
- The reason follows the shape `references/close.md` fixes, opening on what happened and ending on what replaces it or how to reopen
- A close of another branch's pull request names that branch through `--head`, so a wrong number refuses rather than closing someone else's work

## Must not

- Merge, mark ready, or reopen a pull request
- Guess a number from the newest pull request in view
- Close with no reason, or post the reason any way other than through the verb
- Exist only to be typed by name. It earns its place when a session routes "close this PR" or a superseded batch here unprompted.

## Out of scope

- Writing the gate on the reason, which the verb owns
- Merging, which the operator runs through `canon pr merge`
- Closing an issue, which `git-issue` covers
