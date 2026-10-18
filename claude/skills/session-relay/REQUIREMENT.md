---
name: session-relay
description: Why sending to another session is one skill any session reaches, why it resolves the address and names the sender, and why the message body and the addressee stay with the caller
---

# Session relay requirement

## Gap

Without this skill, every session that owes another a message resolves the addressee itself, so one protocol lives in each role body and in whatever a roleless session improvises, and a fix reaching one copy misses the rest. A skill matched only by request never fires, so firing rests on the pointer in each role's channel section.

A relayed message goes out with no sender, so an operator carrying it cannot say whose turn produced it. A name prefix can resolve to the wrong session, and the send to it still reports success, so the message is lost with nothing flagging it. Nothing else tells a roleless session why a block goes out before a prompt.

## Must

- Any session sending to another reaches the skill, with or without a role and with or without a message-sending tool
- The sender's name comes from `canon sessions list --self --json`, degrading to a name from the environment when the installed CLI lacks `--self`
- The addressee resolves from a `sessionId` or a branch at the moment of sending, never by name prefix, and is checked against the agent listing with its `[ref]` added under more than one row
- The send goes through a message-sending tool where one exists, and a copyable block opening on a sender, addressee, and purpose header is composed where none does or the listing has no row
- The body carries the message verbatim from its caller, and states why a block goes out before a prompt as the one surface holding that reason

## Must not

- Draft a message body of its own
- Decide who the message goes to, or guess an addressee when the resolution returns no row
- Restate the last-rung inference the role bodies each carry

## Out of scope

- Which messages are owed and when, which the calling role or the dispatch owns
- The last-rung inference for a worker, which `role-worker` owns because a worker holds a feature branch
- The last-rung inference for a planner, which `role-planner` owns because a planner holds none
