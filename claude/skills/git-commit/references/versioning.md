---
title: Versioning reference
description: Phase label vs semver discipline across tasks, PRs, reviews, issues, commits, and tags
---

# Versioning reference

Two namespaces, kept separate.

## Scope

Governs the two version namespaces, phase labels and semver tags, and which surfaces each may appear on. It is an attribute standard rather than a document-type one, so it applies wherever either namespace is written, and it carries no template because a label has no document to shape.

Does not govern:

- The format of a phase label, which is project-specific by the rule below
- Task filenames and folder layout: `tasks.md`
- Commit subject, branch name, and pull request title format: `commit.md`, `branch.md`, and `pr.md`

### Neighboring concerns

Text carrying a label still follows the standards for any text.

- Voice, rhythm, and sentence construction: the `write-human` skill
- Punctuation, formatting, and word choice: `markdown.md`
- How a quoted-alone version-shaped token or a record path is caught as a board reference: `publish.md`

## Phase labels

Internal coordination vocabulary used in the task board and chat.

- Format is project-specific
- Used to order work and disambiguate streams during planning
- Re-numbers freely as scope shifts, so a half-step such as `v1.5` between `v1` and `v2` is fine <!-- canon-allow-reference: illustrates the label format, not a real row -->
- Does not have to map to any external release

## Semver tags

External release identity used in git tags and release notes. Independent of phase labels.

- Format is semver: `v<major>.<minor>.<patch>`
- Tagged only when a real release is cut
- Does not have to map to phase labels. A single semver tag may cover work that carried several internal phase labels.

## Where each appears

| Surface                                               | Phase labels | Semver tags                         |
| ----------------------------------------------------- | ------------ | ----------------------------------- |
| `.canon/tasks/`                                       | yes          | no                                  |
| Chat with the operator                                | yes          | no                                  |
| Tracked prose (context entries)                       | conditional  | no                                  |
| Shipped prose (`claude/skills/`, `governance/rules/`) | no           | no                                  |
| PR titles                                             | no           | only when the PR cuts a release     |
| PR bodies                                             | no           | only when the PR cuts a release     |
| Review comments                                       | no           | only when referencing a release     |
| Issue titles and bodies                               | no           | only when referencing a release     |
| Commit messages                                       | no           | only when the commit cuts a release |
| Git tags                                              | no           | yes                                 |
| README and `CHANGELOG.md`                             | no           | yes                                 |

## Rules

- PR titles describe the user-observable change in conventional-commit form. Do not prefix or suffix with phase labels.
- Commit subjects do not embed phase labels.
- Git tags use semver only. Phase labels never become tags.
- A PR that cuts a release may reference its semver tag in the title or body. Phase labels still do not appear.

### Bodies and code spans

PR bodies, review comments, and issue text name the change itself, never the internal stream that scheduled it. Describe the work rather than the label it was planned under.

- `canon labels scan` masks a code span before checking for a bare token, so a label alone in its own span clears the phase-label check
- That span still resolves as a board reference under `publish.md`'s board-identifier check, run by the same scan, so it still fails every surface the table marks `no`
- Neither check reaches a version-shaped token folded into a longer quoted phrase, such as a fixture name or a file path
- The operator kept that carve-out, so write a live reference in plain text rather than folding it into a quoted phrase

### Phase labels in shipped files

A phase label in a context entry is permitted only when its substance is restated inline beside it, since a reader without the board has nothing to resolve a bare one against.

- A standard, a skill body, and a governance rule forbid a phase label outright, substance restated or not
- The line is ownership rather than reachability. A shipped file is read by a project that never edits it, so the label names a board that reader can never reach.
- A context entry stays permitted because it is this project's own tracked surface, never shipped
- The rule governs a reference to a real row, never a token shown to illustrate the label's format, which lets a standard defining the format still show one

## Pre-publish check

Text bound for a remote is checked for phase labels against the finished draft, before it is sent. A body, comment, or title reaches a reader who has no task board, so a label that survives to publication cannot be resolved by anyone downstream.

The surface publishing the text is the last gate on it. Where no automated check covers that surface, the author performs the check as an explicit step rather than relying on having read this file while drafting.

## Why

Phase labels keep planning conversations efficient. They make `git log`, PR titles, and the tag list unreadable when they leak in. A future reader cannot reconstruct what an internal label meant without the matching task file, which is gitignored.

Semver tags carry meaning independent of conversation state and survive in git history. Keeping the two namespaces apart preserves both.
