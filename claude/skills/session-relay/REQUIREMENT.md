---
name: session-relay
description: Why a standalone skill with no firing condition never fired, why the first inline draft repeated the same protocol in two bodies, and why the missing sender identity sat unaddressed through both attempts
---

# Session relay requirement

## Gap

Without this skill, `role-worker` and `role-planner` state three and two messages respectively that a session owes its controller, and both assume a tool to send them through. A session holding none has no route to compose or hand off what it owes, and neither body says what to do about that.

A standalone skill was proposed for the gap and declined the same day. It fired on no condition of its own, since nothing routes a session to a skill matching no request and reaching for no artifact, so a skill built to close the gap never closed it.

The first draft of this plan closed the gap with a paragraph drafted inline, once inside `role-worker` and once inside `role-planner`. The operator overrode that call: two bodies carrying identical protocol text is the shared-surface case `.claude/ARCHITECTURE.md` already decided against duplicating, since a later fix reaching one copy and not the other diverges silently.

Neither attempt named who the relay is from. A message an operator relays by hand needs a sender as much as an addressee, and the standalone draft and the inline draft both composed a body and an addressee with no line stating whose turn produced it.

## Must

- Fire from inside `role-worker` or `role-planner`'s own `## The channel` section, at the point that section finds no message-sending tool
- Refuse a caller holding neither role, checked ahead of the tool-availability guard
- Read the sender's own name off `canon sessions list --self --json` before composing anything, and degrade to naming itself from the environment when the installed CLI answers `--self` with an unknown option rather than a refusal carrying a reason
- Resolve the addressee by running the calling role's own ladder rather than a second one
- Carry the message body the calling role's bullet already names, verbatim
- Open the composed text with a header naming the sender, the addressee, and what the message is
- State the header as a default a session may write around, rather than a fixed vocabulary

## Must not

- Restate the addressee ladder `role-worker` or `role-planner` already states
- Draft a message body of its own. The text it composes belongs to the calling role's bullet.
- Fire when a message-sending tool exists

## Guards

- The calling session holds neither role: refuse, and state the addressing and timing it owes instead, since the plugin skill it would otherwise defer to reaches a target the moment it merges while a governance rule reaches one only through a separate install. Checked first, since the tool guard read alone let the incident behind this row stop at "you have a tool" without ever learning steps 2 and 3 were unreachable regardless.
- A message-sending tool is available: refuse, name it, and send through it instead

## Out of scope

- The addressee resolution ladder itself, which stays in `role-worker` and `role-planner`
- The content of each owed message, which stays in the calling role's own bullet
- Inbound reach: a controller relaying back to a worker or planner holding no tool. The gap this closes is the outbound leg alone, since a controller can already reach either side directly.
