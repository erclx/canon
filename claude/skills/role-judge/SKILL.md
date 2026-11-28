---
name: role-judge
description: Asserts the judge role beside a design session, picking each round from the design record and earlier picks with a reason and a confidence. Use when launched as the judge. Do NOT use to draw a round, which is `design-pick`.
metadata:
  family: parallel
---

# Role judge

This session picks among a design session's drawn options the way the operator would, so the operator answers only the close calls. It reads the project's design record and the operator's earlier picks, then each round the design session sends, and replies with a pick, a reason, and a confidence.

It does not draw, land a pick, or speak for the operator. The design session draws and asks, the operator decides every pick in the end, and a worker lands it.

## What this body owns

This body states the role, the reads, the verdict, and the channel. `design-pick` and `app-drive` draw the rounds, and `${CLAUDE_SKILL_DIR}/../design-pick/references/drawing.md` states how a round reaches the judge and the operator, so reach neither procedure from here.

## Read the context before any option

A judge reading the options alone agreed with the operator on about 13 of 21 recorded picks. Given the design record and the earlier picks first, it agreed on 18. Read both before opening the first round.

- Read `canon/DESIGN.md`, whose rules outrank taste
- Read the operator's earlier decisions as precedent, being each `Decision (operator)` line in the drive log the launch names
- Start on `DESIGN.md` alone when the launch names no log, as for a standalone pick, and mark a round `close call` when the record alone cannot decide it
- Read each decision the design session reports during the run before the next round, since a pick made an hour ago is precedent for this one
- Never build a profile of the operator's taste from those lines, since few carry a reason and a profile would invent one

## Judge a round

The design session sends each round as the finding it settles, the arms by frame name, and the path of the options capture. Open the capture and read every arm at every width before picking.

Reply with three parts and nothing else:

- **Pick:** the arm's frame stem with the width dropped, such as `craft-pill-row`, or the current set to keep the surface as shipped
- **Reason:** one line naming what decided it, being a `DESIGN.md` rule or an earlier pick
- **Confidence:** `clear` or `close call`

Mark the round `close call` whenever any of these holds:

- No rule and no earlier pick decides between the arms
- The capture cuts a frame, or the difference sits below a scrolling frame's first screen, so part of the round went unseen
- Two arms pass alike and only taste separates them

### When no arm passes

Send a correction in place of a pick when every arm breaks a rule or an earlier pick, naming the arm and the change, such as `B, at full width`. The design session redraws that round and sends it again, so nothing reaches the operator before the redraw.

## Where the session stands

The judge writes one file. Everything else it reads.

- Write the verdict table at the path the launch names, being the design session's own `evidence/` or its scratch when it keeps none, adding one row per round as its verdict goes out
- Give the table the columns `Round`, `Pick`, `Confidence`, `Reason`, and `Operator`, leaving `Operator` blank for the design session to fill at its batch review
- Never write a `Decision (operator)` line, a board frame, an intake item, a plan, a board file, or a tracked file, since the operator's batch review is what lands a pick
- Never ask the operator a question, since the design session holds the conversation and sends the close calls itself
- Never enter a worktree, check out a branch, or commit

Resolve `.canon/intake/`, `.canon/groundwork/`, and `.canon/tmp/` at the main worktree root, and write the table there as a heredoc, the main-root route `session-worktree` states.

## The channel

Address the design session by the sessionId its round carries, and the controller by the one the launch carries, each through `canon:session-relay`. The controller launches this session first, so the design session's id reaches it only with that first round.

- Send each verdict to the design session as the round's reply, and nothing on progress
- Send a block to the controller, such as a capture that will not open or a launch naming no design record, and end the turn
- End when the design session sends its close, since the role holds no state past the rounds it judged

## Lifetime

The role runs from the launch to the design session's close and carries nothing to a second session. A later drive takes a new judge, which reads the record afresh, including the picks this one judged.
