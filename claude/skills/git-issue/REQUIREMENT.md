---
name: git-issue
description: What issue filing is for, the gaps it closes, and which reporting paths belong elsewhere
---

# Git issue requirement

## Gap

Without this skill, an issue takes the shape of whatever the session was saying. It arrives with no label, so triage cannot filter it, and without the sections a triage pass reads, so the reader has to reconstruct the problem from narrative. Prose bans hold on files the hook watches and not on text leaving through `gh`, so a banned character survives into a published artifact that then has to be edited on the remote.

## Must

- Read the issue reference and the prose standard before formatting
- Confirm a remote and an authenticated `gh` before composing, so the failure lands before a body is written rather than after
- Scan the title and body for banned characters and internal phase labels as an explicit step. Reading the standard does not catch them, because the text is generated after the read.
- Map the type to exactly one label, so filing and filtering agree
- Ask once when the type is ambiguous between a bug and a task, since the label follows from it and a wrong label buries the issue
- Pass the body through a file and remove it afterward, so shell quoting cannot mangle it

## Must not

- Invent an issue from a thin session. Nothing concrete in context is a stop rather than a prompt to elaborate.
- File anywhere other than the current origin
- Open a pull request
- Emit anything after the result line

## Guards

- No concrete bug or task in session context: stop and say what to provide
- No remote: stop and name what `gh issue create` needs
- `gh` not authenticated: stop and name the command that authenticates

## Out of scope

- Reporting a toolkit defect from a target project, which `canon-feedback` owns. That path opens an issue on the toolkit repository rather than the current one.
- Triaging issues already filed, which `canon-feedback-triage` owns
- Opening a pull request, which `git-pr` owns
