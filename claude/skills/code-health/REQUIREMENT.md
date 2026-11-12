---
name: code-health
description: What the code health check is for, the gap it closes, and why it reports five axes per file rather than one number
---

# Code health requirement

## Gap

Without this skill, nothing reads a whole source tree for rot. Write-time guidance shapes the code in front of a session and a review reads one diff, so a file that grows a little on every change passes both until it no longer fits in one read.

A session asked for code health counts lines and lists files by hand, picking its own thresholds. Its report mixes figures a verb could back with judgments nothing backs, and a verb that refused or an older binary missing a key reads as a clean tree.

## Must

- Report per file across file length, function length, comment blocks, inline code, and folder layout, marking each finding `measured` or `read`
- Take every figure and checkpoint from `canon code audit`, `canon comments scan`, and `canon census` records, so the body holds no number
- Report a refusal, an absent key, or a language no verb parses as an unread axis naming the cause
- Add a trend section from `canon history` that names a long file among the hotspots first, with no verdict
- Name `plan-intake` as the next step for findings the operator wants to act on

## Must not

- Repair a finding, write a file in the project, or open a pull request
- Emit a verdict or score across the axes or across the files
- Ask for a comment's deletion to move a file toward a figure, rather than a read of whether it belongs
- Invoke `plan-intake` itself, or run on any trigger but a request, since nothing else should invoke a report the operator asked for

## Out of scope

- Shaping code while it is written, which `code-craft` owns
- Reading one diff, which `review-craft` owns
- Markdown documents and markdown-led folders, which `document-health` owns
- Placing a folder split, which `codebase-layout` owns
- Gating file length in CI, which `canon gate run` owns
