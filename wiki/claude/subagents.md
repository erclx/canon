---
title: Claude Code subagents
description: Orientation and toolkit lessons for spawning a subagent from a skill
---

# Claude Code subagents

A subagent is a separate Claude session spawned from the main thread through the `Agent` tool. It runs in its own context, makes its own tool calls, and returns a single final message to the parent. It fits a task that needs independence, isolation, or parallel lenses that a same-session step cannot give. Source: [Create custom subagents](https://code.claude.com/docs/en/sub-agents.md), with the SDK side in [Subagents in the SDK](https://code.claude.com/docs/en/agent-sdk/subagents.md).

## Independence is the case for a cold one

An implementer's context biases a reviewer toward rationalizing the approach already on the page, so a review that must be independent starts from the diff and the standards in a cold subagent. A fork, which inherits the conversation, is for work that needs the reasoning built up so far.

The `auto-ship` chain weighed this spawn and declined it, so its review runs in the session that wrote the code. The reason was that the highest-value findings needed more than one pull request in view, which a reviewer holding a single diff cannot produce. The call is contested rather than settled.

## Blocking them

A deny rule on the `Agent` tool stops every spawn. [Permissions](permissions.md#blocking-subagents) carries the rule.

## Related

- [Claude Code skills](skills.md) for the source on skills, including running one in a forked subagent
- [Claude Code hooks](hooks.md) for the source on hook events, including those around a subagent
- [Claude Code agent view](agent-view.md) for the background session, which has a pane a subagent lacks
