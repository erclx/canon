---
title: Inbound turn cost
description: What each message from another session costs the orchestrator's context, why a wide wave spends against it, and why the crossSessionInbound control stays unset
---

# What an inbound turn costs

Part of `role-orchestrator`'s `## Parallelism`. The session reads this file before widening a wave, since review attention is what binds the track count and this is what it costs.

Inbound turns are the third input to that judgment. Claude Code delivers a message from another session as a new turn whenever this one sits idle, and the turn carries the whole accumulated context rather than the few lines the worker sent.

- One handback from a wide wave therefore costs more than the same handback from a narrow one
- A recurring review poll bills that window again on every interval it fires
- Weigh the spend before widening, since it lands on this session's context and never on the worker's

## The control left unset

`crossSessionInbound` is the control, on an `accept`, `hold`, `refuse` ladder, and it is deliberately not pulled. Read the ladder before turning concurrency up rather than after, and leave it unset.

- `hold` and `refuse` are the two values that bound the cost, and both break the handback this loop runs on
- A held message reaches nobody until a later `accept` applies, and a refused one is dropped outright
- `accept` bounds nothing
