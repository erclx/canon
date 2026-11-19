---
title: Dispatch queue
description: The hand-launch prompts queue behind canon dispatch prompts, the one file the verb writes, and what the orchestrator watch reads from it
---

# Dispatch queue

## Overview

Owns the queue of prompts an operator launches by hand, which the orchestrator fills before a wave and clears once each session is up. The board, the plans, and the background dispatch sit in `canon/context/workflow/orchestration.md`.

## Layout

### `src/dispatch/`

Owns the hand-launch queue behind `canon dispatch prompts add`, `rm`, and `list`, one markdown file at `.canon/dispatch/prompts.md` that the verb alone writes and the operator pastes from.

- The parse refuses `malformed` on any line out of the fixed order rather than rewriting it, since a guessed hand edit could launch the wrong row
- A worker row's branch is derived from the plan path in its command through `branchOfPlan`, so the watch and the dispatch branch check read one string
- Every `add` reads `checkClaim` on each worker branch, refusing a claimed new row and dropping a claimed queued one, while an unreadable claim keeps its row
- The merge-order line survives only while two queued worker plans share a declared path, read through `readDeclarations`
