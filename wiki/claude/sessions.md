---
title: Claude Code sessions
description: Peer session discovery, addressing by name and ref, what a cross-session message carries, and why a session map goes stale
---

# Claude Code sessions

A Claude Code session can discover other sessions it can reach and send one of them a message. `ListAgents` returns the roster and `SendMessage` addresses a row on it. The pair is what lets one session hand work to another that a person already started, without anyone carrying the instruction between them.

Source: Anthropic, which owns both tools and the discovery behavior behind them.

## What the listing reports

`ListAgents` covers the in-process subagents this session spawned alongside the other Claude Code sessions it can reach, and labels each row by kind. Every row leads with a name and a short bracketed ref, then reports the state and how long the session has been running. The name is the address, and no separate address syntax exists.

Discovery is filesystem visibility rather than a heartbeat. Each session registers itself in files on disk and binds an inbox socket, and the listing reads those files, so a row appearing means a session left a record rather than that it answered a probe.

## Resolving a name to a branch

The listing carries a name and no working directory, so it cannot say which repository, worktree, or branch a session is working in. A consumer that has to reach the session holding a particular branch recovers that mapping from somewhere other than the listing.

Ordering the rows by start time and matching them against the order the worktrees were created is the inference this invites, and it fails whenever two sessions start close enough together for the reader to be unsure which came first. An earlier measurement against five worktrees found the ordering held and read that as settled. It did not cover two sessions started inside the same minute, which is the case that breaks it.

The record each session writes for itself carries more than the listing renders, including the working directory. Reading those records resolves a name to a branch by an exact match on one file rather than by a guess across two orderings, which is what a consumer should prefer over the ordering. The file layout is an implementation detail rather than a published interface, so a consumer depending on it states what it is relying on and reports when the read is unavailable rather than falling back silently.

A consumer that has built the read marks a row it could not settle rather than dropping it. A session holding no branch and a session the read never reached are different answers, and rendering both as an absence hides the second behind the first. Liveness carries the same obligation, since the registry is not pruned and a process identifier can be reused, so a record outliving its session reads as live to anything that only probes the identifier.

A branch name identifies a branch inside one repository rather than across a machine, so a consumer matching on one scopes the match or reaches a session working elsewhere. `canon sessions list --branch` is one consumer's answer of this shape, and any consumer can build its own.

## Addressing a session

Send the bare name. Append the bracketed ref only when the bare name cannot resolve on its own, which happens when the listing shows two rows carrying it or when an error asks for the disambiguation. An error of that kind names the candidates to retry with, so the ref never has to be guessed.

A ref read from anywhere but a current listing or a current error will not resolve. Where one name reaches both an in-process agent and a peer session, the bare name takes the in-process one.

## What a message carries

A message carries plain text and nothing else. A slash command written inside one arrives at the reader as text rather than running, so a message asking for a skill names the skill for the reader to run rather than embedding the invocation.

The channel confers no authority. A message cannot approve a permission prompt, change configuration, or act on the receiving session's behalf. Permission boundaries are per-session, so asking a peer to run what the sending session was denied routes around a decision a person made. Blocked work goes back to that person instead.

## Delivery and timing

A listed peer processes what it is sent. Messages enqueue and drain at the receiver's next tool round, so a session reported busy still receives one, and arrival mid-task costs the work already running nothing observable. Delivery between sessions on one machine never leaves the machine, and a message held or refused reports back to the sender.

An incoming message arrives wrapped in a `cross-session-message` element carrying a `from` attribute. Replying means copying that attribute into the recipient field.

## Names rotate

A name identifies a live session rather than a role, and the roster turns over as sessions end and start. A name recorded earlier in the same session can fail as unreachable within the hour.

Resolve a target from a fresh listing at the moment of sending, never from a map written down earlier. Where the mapping from a name to the work that session holds is inferred rather than confirmed, open the message by stating what the sender believes the reader is working on and ask to be corrected. One sentence turns a wrong guess into a reply instead of a session acting on someone else's instructions.

## Related

- [Claude Code subagents](subagents.md) for the spawned-session channel, which starts cold and ends when the parent collects its result
- [Claude Code and git worktrees](worktrees.md#background-sessions) for the isolated parallel sessions this messaging addresses
