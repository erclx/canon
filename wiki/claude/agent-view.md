---
title: Claude Code agent view
description: Orientation and toolkit lessons for the terminal view that manages background sessions
---

# Claude Code agent view

Agent view is the terminal surface that lists and manages background Claude Code sessions, opened with `claude agents` or reached from a session sent to the background. Each row is a full independent session with its own conversation, transcript, and quota, dispatched with `claude --bg "<task>"` or by sending the current one to the background with `/bg`. Source: [Agent view](https://code.claude.com/docs/en/agent-view.md).

## It manages background sessions only

A subagent spawned through the `Agent` tool has no row. It runs inside its parent's context, shows up only in the parent's transcript, and shares the parent's quota. Trading a background session for an `Agent` tool call does not gain a pane. It loses the one background dispatch already has, in exchange for an independence a subagent does not carry. See [Claude Code subagents](subagents.md) for the channel a subagent has instead.

## Respawn before rebuilding

A stopped worker is not a session to relaunch from scratch. `claude respawn <id>` picks its conversation back up, which is the verb to reach for before rebuilding a worker's context by hand.

## The cost of a wave

Each background session also makes a small per-turn request on a Haiku-class model to write its row summary. A wave of dispatched work multiplies that draw by however many sessions are live, on top of their own quota use.

## Related

- [Claude Code subagents](subagents.md) for the in-process channel this view does not cover
- [Claude Code and git worktrees](worktrees.md) for how a background session's working directory relates to a worktree
- [Claude Code sessions](sessions.md) for discovering and messaging a peer session from inside another one
