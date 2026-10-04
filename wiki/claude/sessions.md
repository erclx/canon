---
title: Claude Code sessions
description: Orientation and toolkit lessons for finding and messaging a peer session
---

# Claude Code sessions

A Claude Code session can discover the other sessions it can reach and message one of them. `ListAgents` returns the roster, `SendMessage` addresses a row on it, and a message is plain text, never the sender's conversation. That is what lets one session hand work to another a person already started. Source: [Message your other Claude Code sessions](https://code.claude.com/docs/en/cross-session-messaging.md).

## A row names a session and not its branch

A listing shows each local session's working directory unless Remote Control is connected, but a row names no branch. A consumer that has to reach the session holding a particular branch must map directory to branch itself, and the shortcut it is tempted to take instead is ordering rows by start time and matching them against the order the worktrees were created. That fails when two sessions start inside the same minute. An earlier measurement against five worktrees found the ordering held and read that as settled, which is the case it did not cover.

The record each session writes for itself carries the working directory, so an exact match on one file resolves a name to a branch where the ordering only guesses. The file layout is an implementation detail rather than a published interface, so a consumer depending on it states what it relies on and reports when the read is unavailable.

A branch name identifies a branch inside one repository rather than across a machine, so a consumer matching on one scopes the match. `canon sessions list --branch` is one consumer's answer of this shape.

## Unresolved is not absent

A consumer that has built the read marks a row it could not settle rather than dropping it. A session holding no branch and a session the read never reached are different answers. Liveness carries the same obligation, since the registry is not pruned and a process identifier can be reused, so a record outliving its session reads as live to anything that only probes the identifier.

## Resolve the name at the moment of sending

A name identifies a live session rather than a role, so a name recorded earlier in the same session can fail as unreachable within the hour. Resolve a target from a fresh listing when sending. Where the mapping from a name to the work that session holds is inferred, open the message by stating what the sender believes the reader is working on and ask to be corrected, so a wrong guess becomes a reply and not a session acting on someone else's instructions.

## Related

- [Claude Code subagents](subagents.md) for the spawned-session channel, which starts cold and ends when the parent collects its result
- [Claude Code and git worktrees](worktrees.md) for the isolated parallel sessions this messaging addresses
- [Claude Code agent view](agent-view.md) for managing background sessions
