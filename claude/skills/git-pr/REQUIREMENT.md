---
name: git-pr
description: What pull request generation is for, the gaps it closes, and what it requires upstream of itself
---

# Git PR requirement

## Gap

Without this skill, a pull request body is written from memory of the branch rather than from its diff, so it describes the intent and omits what the work turned into. Testing boxes get ticked from intent, which records what was meant to run instead of what ran, and a reviewer trusts the list. A second push either errors on create or opens a duplicate pull request, and banned characters survive into a body the hook never sees.

Every pull request also lands unlabelled, so a merged list is a wall of titles with no way to filter it by surface. A reader looking for what changed in one domain reads all of them, and the conventional commit type in the title says what kind of change it is rather than where.

A lookup that resolves by head branch alone carries its own failure. A branch name reused after an earlier pull request merged resolves to the closed one, so the run rewrites a merged pull request's title and body and reports its URL as the one it opened. Both fields are recoverable only through the issue timeline and the edit history, and nothing reports that the write landed on the wrong object.

## Must

- Refuse a branch name that does not conform, since the name lands on the pull request permanently and renaming it afterward breaks the link
- Derive the title and body from the commits and the diff against main, with lockfiles excluded
- Run each check before writing its line, then state the result the run reported
- Leave a box unchecked only for a human-only case, naming which human and why on the same line
- Scan the title and body for banned characters and internal phase labels as an explicit step, on top of reading the prose standard
- Detect an open pull request and edit it in place, so a follow-up push keeps the body in sync instead of failing
- Scope that detection to an open pull request on the current head and the default base, so neither a reused branch name nor a second base resolves the wrong one
- Resolve the pull request once and reuse what that resolution returned, so the number recorded never depends on how a lookup ranks two pull requests sharing a head
- Label from the paths the branch changed, against a map the project declares, so the label set belongs to the project rather than to the skill
- Apply labels after the pull request exists, so a label the remote does not carry costs a warning rather than the pull request
- Report a refused label, since a warning nothing surfaces leaves the run indistinguishable from one that labelled
- Put a preview address on a pull request that changes a rendered surface when the project's deploy can mint one, since screenshots and a checklist leave a reviewer nothing to click into before merging
- Bound the wait on that preview and finish the chain without the link on a timeout, since a slow deploy must not hold the ship

## Must not

- Tick a testing box from intent or from a past session. The box records a run.
- Put a request for the reviewer in the Testing list, since a request is not a result
- Create a second pull request when one is open
- Edit a pull request that is not open, or record its number on a task
- Name a domain of any one project in the skill body or its references
- Create a label the map names and the remote lacks
- Dispatch a deploy whose command names no branch, since Cloudflare Pages publishes such a deploy to production
- Emit anything after the result line

## Guards

- Branch name does not conform: stop and route to the skill that renames
- No commits ahead of main: stop
- No label map in the project: label nothing and warn nothing, since an absent map is a decision rather than a gap

## Out of scope

- Naming the branch, which `git-branch` owns. This skill requires a conforming name and refuses without one rather than fixing it.
- Grouping the diff into commits, which `git-stage` owns
- Pushing a later edit onto an already-open pull request, which `git-followup` owns. The overlap is real and the split is by state: this skill brings a pull request into existence and keeps it accurate, that one carries a fix onto one already under review.
