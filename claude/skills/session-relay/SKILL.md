---
name: session-relay
description: Relays a message to another session, turning the sessionId the caller named into an address at the moment of sending and composing a copyable block where no send tool exists. Use when asked to "relay this", "message the controller", "send this over to the session that dispatched me", or "tell the other session", with or without a role, and when a session stuck on a question owes the session that dispatched it a message before it stops to ask. Do NOT use to decide what the message says, and do NOT use to assert what a session may write or is on the hook for, which is `role-worker` or `role-planner`.
metadata:
  family: parallel
---

# Session relay

This is the one place a session sends to another session. It holds the mechanical half of the send, being the sender's name, an address that reaches, and the route the text takes.

What the message says and who it goes to come from whatever dispatched this session, and from the calling role's own `## The channel` section where the session holds a role.

## Who reaches this

It fires for a session holding a role and for one holding none. A roleless session finds everything it owes stated here rather than in a ladder written for a role it lacks.

This body alone holds the send mechanics and the reason a block goes out before a prompt. A calling role or dispatch states only that the message is owed.

## Step 1: name the sender

Read this session's own name from `canon sessions list --self --json`. A message an operator relays by hand needs a sender as much as an addressee, and a message arriving through a tool is read against whoever sent it.

| The read returns                         | Name the sender as                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| A row                                    | Its `name`                                                                                  |
| `no-self-identity` or `no-self-row`      | The refusal and its reason, never a guess                                                   |
| An unknown option, from an older release | What the environment states, saying the roster did not answer so the name reads unconfirmed |

## Step 2: resolve the addressee

The caller names the addressee as a `sessionId` or a branch, never as a name. A name follows what a session is doing and goes stale inside a build, so resolve it at the moment of sending rather than at launch.

- From a `sessionId`: run `canon sessions list --json`, find the row carrying that id, and take the `name` on it
- From a branch: take the row whose `branch` matches. Nothing renames a session when it takes a role, so an id is the stronger key and a branch the fallback.

### Refuse another repository

Refuse a send to a row whose `repository` differs from the sender's own, unless the caller names the operator's ask. Read the sender's repository from the Step 1 row and report the refusal with both paths.

When Step 1 returned no row, the sender's repository is unread, so the comparison cannot run. Report it as unread and send only when the caller names the operator's ask.

### Check the name against the agent listing

A name is not unique, and the roster carries no field separating two live sessions holding one. Check the name against the agent listing before sending.

- One row under the name: send it bare
- More than one row: complete the address with the `[ref]` the listing prints beside each, since a bare name lands on whichever row resolves first, such as two sessions differing by a trailing ` (3)`

Never filter the roster by a name prefix. Every self-dispatched worker is named `worker-<project>-<slug>`, so a prefix scan returns a sibling or this session itself.

### When nothing resolves

Report a resolution that returns nothing rather than falling back to a guess. The roster and the send channel enumerate different populations, since a session driving through Remote Control writes no local process record.

Where the caller named nobody, the calling role's `## The channel` section carries the last rung, since a worker and a planner infer differently. Ask the operator where one is present, put the candidate rows through the structured question surface, and say the addressee was inferred.

## Step 3: send

- A message-sending tool exists: send through it, addressed to what Step 2 resolved. This is the ordinary route.
- No message-sending tool, or Step 2 found no row to address: compose the block below and close the turn with nothing after it, so the block is the whole of what an operator copies.

Send the message before the session becomes an interactive prompt, on both routes. A session waiting on input never reaches the tool round that drains an inbound message, so an answer relayed afterwards changes nothing.

Carry the message body verbatim from whatever names it. This skill composes and never drafts, so an announcement or a blocked question is exactly the text the calling bullet or the dispatch states, with its facts filled in.

## Header

```plaintext
Relay: from <sender> to <addressee>, <what the message is>
<message body>
```

States a default rather than a fixed vocabulary. A session may write the header in its own words, since it is read once and copied rather than parsed, as long as it names the same three parts.

## Output

The sent message, or the composed block and nothing beyond it. Report Step 1's refusal in place of a sender the roster cannot answer for, and report the halt or the inference in place of an addressee Step 2 cannot resolve.
