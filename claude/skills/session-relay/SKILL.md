---
name: session-relay
description: Relays a message to another session, turning the sessionId the caller named into an address at the moment of sending and composing a copyable block where no send tool exists. Use when asked to "relay this", "message the controller", "send this over to the session that dispatched me", or "tell the other session", with or without a role, and when a session stuck on a question owes the session that dispatched it a message before it stops to ask. Do NOT use to decide what the message says, and do NOT use to assert what a session may write or is on the hook for, which is `role-worker` or `role-planner`.
---

# Session relay

This is the one place a session sends to another session. It holds the
mechanical half of the send: naming the sender, turning a `sessionId` or a
branch into an address that reaches, and putting the text through whichever
route exists. It holds none of the other half. What the message says and who it
goes to come from whatever dispatched this session, and from the calling role's
own `## The channel` section where the session holds a role.

It fires for a session holding a role and for one holding none. A roleless
session reaches this body directly and finds everything it owes stated here,
rather than reading a ladder written for a role it does not have. This body
alone holds the send mechanics and the reason a block goes out before a prompt.
A calling role or dispatch states only that the message is owed.

## Step 1: name the sender

Read this session's own name from `canon sessions list --self --json`. A
message an operator relays by hand needs a sender as much as an addressee, and
a message arriving through a tool is read against whoever sent it.

A refusal carrying `no-self-identity` or `no-self-row` means the roster holds
nothing to name the sender with. Report the refusal and its reason in place of a
name rather than guessing one.

Where the installed CLI answers `--self` with an unknown option, that flag is
newer than the release this session holds, so there is no refusal and no reason
to report. Name the sender from what the environment states instead, and say the
roster did not answer, so the reader knows the name was not confirmed against
it.

## Step 2: resolve the addressee

The caller names the addressee as a `sessionId` or as a branch, never as a name.
A name is derived from what a session turns out to be doing and goes stale
inside the window a build or a plan takes, so resolve it at the moment of
sending rather than at launch.

- From a `sessionId`: run `canon sessions list --json`, find the row carrying that id, and take the `name` on it.
- From a branch: run the same read and take the row whose `branch` matches. Nothing renames a session when it takes a role, which is why an id is the stronger key and a branch is the fallback rather than the default.

Then check that name against the agent listing before sending it. A name is not
unique, and the roster carries no field separating two live sessions holding
one, so the resolution can end on a string that reaches the wrong session.

- One row under the name: send it bare.
- More than one row: complete the address with the `[ref]` that listing prints beside each row, rather than sending to the name alone, which lands on whichever row the channel resolves first. Two sessions differing only by a trailing ` (3)` is the shape this meets in practice.

Never filter that roster by a name prefix. Every self-dispatched worker is named
`worker-<project>-<slug>`, so a prefix scan returns a sibling or this session
itself, which is the defect that sent messages owed to a controller somewhere
else.

Report a resolution that returns nothing rather than falling back to a guess.
The roster and the send channel enumerate different populations in both
directions, measured at one moment: a live background session sat on the roster
that the agent listing did not carry, and nine sessions were addressable there
with no roster row at all. Those nine were driving through Remote Control, which
writes no local process record.

Where the caller named nobody at all, the calling role's own `## The channel`
section carries the last rung, since a worker and a planner infer differently
and a roleless caller has no ladder to defer to. Ask the operator where one is
present, put the candidate rows through the structured question surface so they
pick a row rather than recall a name, and say the addressee was inferred
wherever an inference decided it.

## Step 3: send

- A message-sending tool exists: send through it, addressed to what Step 2 resolved. This is the ordinary route.
- No message-sending tool, or Step 2 found no row to address: compose the block below and close the turn with nothing after it, so the block is the whole of what an operator copies.

Send the block out as a message before it becomes an interactive prompt. A
session already waiting on input never reaches the tool round that drains an
inbound message, so an answer relayed afterwards arrives under the open question
and changes nothing. This holds on both routes.

Carry the message body verbatim from whatever names it. This skill composes and
never drafts, so a pull request announcement, an address-review announcement, or
a blocked question is exactly the text the calling bullet or the dispatch
states, with its own facts filled in.

## Header

```plaintext
Relay: from <sender> to <addressee>, <what the message is>
<message body>
```

States a default rather than a fixed vocabulary. A session may write the header
in its own words, since it exists to be read once and copied rather than parsed
by anything downstream. Name the same three parts however phrased.

## Output

The sent message, or the composed block and nothing beyond it. Report Step 1's
refusal in place of a sender the roster cannot answer for, and report the halt
or the inference in place of an addressee Step 2 cannot resolve.
