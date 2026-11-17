---
description: The addressing and timing a session holding neither role-worker nor role-planner owes when it must message whoever dispatched it
---

# Channel standards

## A session holding neither role

- Resolve the addressee at send time through `canon sessions list --json`, keyed on the id or branch the dispatcher named at launch, never by name prefix. A name is derived from what a session turns out to be doing and goes stale before a build finishes.
- Send a block out as a message before it becomes an interactive prompt. A session already waiting on input never reaches the tool round that drains an inbound message, so an answer relayed afterwards arrives under the open question and changes nothing.
- Leave the message content, and which transition earns one, to whatever dispatched this session. Both are task-specific and already stated where they apply.
- A session holding `canon:role-worker` or `canon:role-planner` follows that body's own addressee ladder instead, stated in its own `## The channel` section. This rule states what neither role leaves stated elsewhere, not a replacement for either ladder.
- Report it rather than proceeding silently when neither skill resolves to check against. Both ship with the plugin and this rule ships with the CLI, so a project that installed governance alone does not have them.
