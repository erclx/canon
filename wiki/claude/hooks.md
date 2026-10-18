---
title: Claude Code hooks
description: Orientation and toolkit lessons for event hooks
---

# Claude Code hooks

Hooks are handlers that run in response to Claude Code events. The harness executes them, not Claude, so they enforce what a prompt can only request: blocking an action, formatting a file, injecting context. They are configured under the `hooks` key in `settings.json`.

Source: [Hooks reference](https://code.claude.com/docs/en/hooks.md), with the setup walkthrough in the [hooks guide](https://code.claude.com/docs/en/hooks-guide.md). See [Claude Code subagents](subagents.md) for when a skill should spawn one. Checked against the hooks reference on 2026-10-18.

## Notes

- Guard interactive-only output in a shell profile with `if [[ $- == *i* ]]`, since a stray `echo` in `~/.zshrc` corrupts the hook's JSON.
- A stalled hook does not block, since the call continues through the normal permission flow. A hook is never the only gate on a hard deny, which belongs to the permission system.
