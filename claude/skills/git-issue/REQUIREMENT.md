---
name: git-issue
description: What issue filing is for, the gaps it closes, and which reporting paths belong elsewhere
---

# Git issue requirement

## Gap

Without this skill, an issue takes the shape of whatever the session was saying. It arrives with no label, so triage cannot filter it, and without the sections a triage pass reads, so the reader reconstructs the problem from narrative.

Prose bans hold on files the hook watches and not on text leaving through `gh`, so a banned character survives into a published issue that then has to be edited on the remote. A missing remote or an unauthenticated `gh` surfaces only after the body is written.

## Must

- The title and body follow the issue reference and are scanned for banned characters and phase labels before filing
- Each issue carries exactly one label mapped from its type, asked once when the type is ambiguous between a bug and a task
- A remote and an authenticated `gh` are confirmed before any body is composed
- The body passes through a file that is removed afterward

## Must not

- Invent an issue from a thin session
- File anywhere other than the current origin
- Open a pull request
- Emit anything after the result line

## Out of scope

- Reporting a toolkit defect from a target project, which `canon-feedback` owns
- Triaging issues already filed, which `canon-feedback-triage` owns
- Opening a pull request, which `git-pr` owns
