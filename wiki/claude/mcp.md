---
title: Claude Code MCP
description: Orientation to connecting MCP servers to Claude Code, with the source for configuration and authentication
---

# Claude Code MCP

MCP (Model Context Protocol) connects external tools and data sources to Claude Code. Each server exposes tools, prompts, and resources that appear alongside the built-in tools in a session. Servers register with `claude mcp add`, live at local, project, or user scope, and take permission rules in the `mcp__<server>__<tool>` form. Source: [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp.md).
