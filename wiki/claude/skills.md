---
title: Claude Code skills
description: Orientation and toolkit lessons for skills and plugins
---

# Claude Code skills

A skill is a reusable instruction set in a `SKILL.md` file with YAML frontmatter, which Claude orchestrates with its tools rather than running fixed logic. A skill in `.claude/skills/` becomes a `/command`, and a plugin packages skills, hooks, agents, and MCP servers under a namespace. [Claude Code commands](commands.md) lists the built-ins. Source: [Extend Claude with skills](https://code.claude.com/docs/en/skills.md).

## A marketplace plugin loads from a cache

Marketplace plugins are cached under `~/.claude/plugins/cache/`, and a session loads the cached copy rather than the working tree. A session building a change to its own skills can hold the version from before the last update, and `--plugin-dir <worktree>/claude` loads the worktree's copy instead.
