---
name: git-pr
description: What pull request generation is for, the gaps it closes, and what it requires upstream of itself
---

# Git PR requirement

## Gap

Without this skill, a pull request body is written from memory rather than the diff, so it describes the intent and omits what the work became. Testing boxes get ticked from intent, a second push errors or opens a duplicate, and banned characters survive into a body the hook never sees.

Every pull request lands unlabelled, so a merged list cannot be filtered by surface. A lookup by head branch alone resolves a reused name to the merged pull request, then rewrites its title and body and reports nothing wrong. A pull request changing a rendered surface reaches review with no screenshots.

## Must

- The title and body come from the commits and the diff against main with lockfiles excluded, scanned for banned characters and phase labels, and every ticked box records a check this run executed
- A follow-up run edits the one open pull request on the current head and default base, resolved once, and every write first proves that pull request's head and open state
- Labels come from the paths the branch changed against a map the project declares, applied after the pull request exists, with a refused label reported
- The run closes by invoking `pr-evidence` with the number it resolved, and prints the head branch beside that number

## Must not

- Run on a non-conforming branch name or with no commits ahead of main
- Tick a testing box from intent, or put a request for the reviewer in the Testing list
- Create a second pull request, or edit one that is not open
- Name a domain of any one project in the body or its references, or create a label the remote lacks
- Emit anything after the result line

## Out of scope

- Naming the branch, which `git-branch` owns
- Grouping the diff into commits, which `git-stage` owns
- Pushing a later edit onto a pull request already under review, which `git-followup` owns
