---
name: markdown-propose
description: Why a markdown rewrite is proposed per file and answered before anything applies, rather than edited live or argued in chat
---

# Markdown propose requirement

## Gap

Rewriting a passage in a governing document today means editing it live or arguing in chat, and three surfaces sit near this moment without covering it. `standards-audit` maps changed markdown to the standards claiming it and reports violations, ending on its own description: `Do NOT fix violations. Reporting only.` `canon markdown audit` measures bans and structural checkpoints from package data.

`review-branch` reports findings on a diff someone already wrote. None of the three drafts a replacement, carries an answer slot, or waits.

A review delivered in chat gets applied from memory across files nobody reopened, and nothing records which changes the operator approved. A change nobody agreed to either lands unreviewed, because the session acting on a chat review cannot tell an approved line from an inferred one, or never gets written down at all, because a finding with no draft behind it hands the rewrite back to whoever reads it next.

A second failure compounds the first. A claim copied across several files is corrected in the one a session happened to open, and the copies elsewhere now read as freshly reviewed while still disagreeing, since nothing reconciles a restatement against the source it was drawn from.

## Must

- Take the concern and the surface as inputs and run one procedure against them, so a second concern reuses this skill rather than forking it
- Grep the named surface for the concern before proposing, so a defect's site count is measured rather than assumed
- Draft the replacement text, not only the finding
- Carry three labelled variants on a change whose replacement was invented, and one on a change that corrects text to a recorded fact
- Write one proposal file per source file under `.canon/proposals/<nn>-<slug>/` and stop, leaving `You:` empty on every change
- Apply only a change carrying an answer, one file at a time, and re-grep its anchor before applying it
- Report what each file leaves alone, so a proposal cannot be read as finding everything wanting

## Must not

- Edit a source file during the Propose phase
- Apply an unanswered change, or a subset of a file's answered changes while leaving the rest for later
- Fill a `You:` slot, or infer a disposition from an empty one
- Name a specific concern in this skill's own procedure. A concern belongs in the invocation, and hardcoding one narrows the skill to the day it was written.
- Assume the skill earns its place because the gap is real. Whether anything invokes it beyond the operator typing its name has no answer at creation time, and is a review criterion to read against a later usage census rather than a gate this file can pass on its own.

## Guards

- No concern named and none derivable: stop rather than inferring one
- No surface named and none derivable: stop rather than screening the whole tree
- The concern resolves to one file: stop and say a single-file change needs no proposal folder

## Out of scope

- Reporting a violation with no drafted replacement, which `standards-audit` and `canon markdown audit` already own
- Reviewing a diff someone already wrote, which `review-branch` owns
- Filing a raw brain dump as findings, which `plan-intake` owns
- Reviewing `.canon/memory/` and proposing promote-or-retire actions per entry, which `memory-review` owns on a different subject with a different answer contract
