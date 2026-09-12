---
name: session-relay
description: Composes the relay a worker or planner owes its controller when the session holds no message-sending tool, carrying the sender's own name, the addressee the calling role's own ladder resolves, and the message body that role already names, opened with a header naming all three so an operator can copy the block whole. Fires only from inside `role-worker` or `role-planner`'s own `## The channel` section, at the point that section finds no tool to send through. Do NOT invoke it when a message-sending tool exists, which is the ordinary channel, and do NOT invoke it to resolve an addressee for anything other than a channel obligation those two roles already state.
---

# Session relay

`role-worker` and `role-planner` each owe their controller a set of messages, and each assumes a message-sending tool exists to carry them. A session holding none has nothing to send through, and the paragraph stating what to do about that used to sit inline in both bodies, repeating the same protocol twice. This skill is that paragraph, and both role bodies point to it instead of each carrying their own copy.

Read the calling body's `## The channel` section for the message owed and the ladder that resolves its addressee. This skill does not restate either.

## Guards

- Refuse to fire when the calling session holds neither `role-worker` nor `role-planner`. Say so, and state what it owes instead: resolve the addressee at send time through `canon sessions list --json`, never by name prefix, and send a block out as a message before it becomes an interactive prompt, leaving the message content to whatever dispatched it. Checked first, since a caller that never held either role never had a ladder here to run, and the tool guard below reads as the whole reason only once this one has cleared.
- Refuse to fire when a message-sending tool is available. Say so, name the tool, and send through it. This skill exists for the gap, never as an alternative to the ordinary channel.

## Steps

1. Read this session's own name from `canon sessions list --self --json`. A refusal here, `no-self-identity` or `no-self-row`, means the roster carries nothing to name the sender with. Report the refusal and its reason in place of a name rather than guessing one.
2. Resolve the addressee. Run the calling role's own `## The channel` ladder to the letter rather than a second one here, and take its outcome, whatever it is, as this skill's addressee.
3. Carry the message body the calling role's bullet already names, verbatim. This skill composes and never drafts, so the pull request announcement, the address-review announcement, or the blocked question is exactly the text that bullet states, with its own facts filled in.
4. Open the composed text with a header naming the sender, the addressee, and what the message is. Close the turn with nothing after it, so the block above is the whole of what an operator copies.

Where the installed CLI answers `--self` with an unknown option, that flag is newer than the release this session holds, so step 1 meets no refusal with a reason to report. Name the sender from what the environment states instead, and say the roster did not answer, so the reader knows the name was not confirmed against it.

## Header

```plaintext
Relay: from <sender> to <addressee>, <what the message is>
<message body>
```

States a default rather than a fixed vocabulary. A session may write the header in its own words, since it exists to be read once and copied rather than parsed by anything downstream. Name the same three parts however phrased.

## Output

Nothing beyond the composed block. Report the Guards refusal instead when the roster cannot answer for the sender, and report the calling body's own halt or inference when its ladder cannot resolve the addressee.
