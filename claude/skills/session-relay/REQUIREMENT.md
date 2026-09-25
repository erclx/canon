---
name: session-relay
description: Why a standalone skill with no firing condition never fired, why the first inline draft repeated the same protocol in two bodies, why the missing sender identity sat unaddressed through both attempts, and why the two guards that scoped it to a session holding a role and no send tool came off
---

# Session relay requirement

## Gap

Without this skill, every session that owes another session a message resolves
the addressee itself. `role-worker` and `role-planner` each state the messages
owed and each carried the resolution inline, and a session holding neither role
carried it nowhere, so the mechanical half of the send existed in two copies
plus however many a roleless caller improvised.

A standalone skill was proposed for the gap and declined the same day. It fired
on no condition of its own, since nothing routes a session to a skill matching
no request and reaching for no artifact, so a skill built to close the gap never
closed it. That history is why the pointer inside each role's
`## The channel` section still matters: it is a section both bodies read at
session start rather than one reached by request match alone, and it is what
makes the firing survive.

The first draft of this plan closed the gap with a paragraph drafted inline,
once inside `role-worker` and once inside `role-planner`. The operator overrode
that call: two bodies carrying identical protocol text is the shared-surface
case `canon/ARCHITECTURE.md` already decided against duplicating, since a later
fix reaching one copy and not the other diverges silently.

Neither attempt named who the relay is from. A message an operator relays by
hand needs a sender as much as an addressee, and the standalone draft and the
inline draft both composed a body and an addressee with no line stating whose
turn produced it.

Scoping the skill to a session holding a role and no send tool left two holes
rather than one. A session holding neither role had no `## The channel` section
to carry the pointer and was refused outright on arrival. A session that held a
role and a send tool was refused too, which left the resolution ladder
duplicated in both role bodies for the ordinary case. Both guards came off
together, since the mechanics are the same whichever route carries the text.

No governance rule carries the addressing or the reason for the order, so this
body is the only surface stating either for a session holding neither role. A
project that installs governance without the plugin therefore gets no surface
telling a roleless session to send before it prompts, a cost the operator
accepted over a rule loading into every session of every governed target.

## Must

- Fire for any session sending to another session, with or without a role and with or without a message-sending tool
- Read the sender's own name off `canon sessions list --self --json` before composing anything, and degrade to naming itself from the environment when the installed CLI answers `--self` with an unknown option rather than a refusal carrying a reason
- Resolve the addressee from a `sessionId` or a branch at the moment of sending, never by a name prefix
- Check the resolved name against the agent listing, sending it bare under a single row and completing it with the `[ref]` under more than one
- Send through a message-sending tool where one exists, and compose the copyable block where none does or where the listing carries no row to address
- State why a block goes out before a prompt as the only surface carrying that reason, since no rule carries it and a caller restating the reason drifts from this body with nothing comparing them, while each caller still states that the message is owed
- Carry the message body verbatim from whatever names it
- Open the composed text with a header naming the sender, the addressee, and what the message is
- State the header as a default a session may write around, rather than a fixed vocabulary

## Must not

- Draft a message body of its own. The text it composes belongs to the calling role's bullet or to the dispatch.
- Decide who the message goes to. The caller names an id or a branch and this body turns it into an address.
- Restate the last-rung inference `role-worker` and `role-planner` each carry, which differs between them

## Guards

- The roster cannot name the sender: report the refusal and its reason in place of a name
- The resolution returns no row: report it rather than guessing, since the roster and the send channel enumerate different populations in both directions
- The caller named no addressee at all: defer to the calling role's own last rung, and ask the operator where one is present

## Out of scope

- Which messages are owed and when, which stays in the calling role's own bullet or in the dispatch
- The last-rung inference, which stays in `role-worker` and `role-planner` because a worker holds a feature branch and a planner does not, so the two discriminate differently
- Inbound reach as a distinct case. A relay in either direction is one session sending to another, which is what this body now covers.
