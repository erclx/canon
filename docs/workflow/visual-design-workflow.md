---
title: Visual design workflow
description: Tiered guide for design authoring with Claude Code
category: Workflow
---

# Visual design workflow

Three tiers run from prose-only design docs to a graphical source of truth, and tiers stack. [Claude Design](../../wiki/claude/design.md) is the ceiling tool for tiers 1 and 2.

## Tier 0: prose only

The default. `canon/DESIGN.md` holds visual intent as one Overview paragraph, at most three one-line rules a section, and a table naming each color and shape role, with a lead naming the stylesheet. Claude Code alone suffices, and [`test-craft`](../../claude/skills/test-craft/SKILL.md) says which layer a Playwright journey belongs at. The seed is `tooling/claude/seeds/canon/DESIGN.md`, and its column headers stay verbatim.

These skills cover the tier:

- `canon:ui-checklist`, `canon:ux-audit`, and `canon:ux-measure` review and measure a UI
- `canon:pick-by-eye` drafts candidates as frames on a [Frameboard](https://www.npmjs.com/package/frameboard) board and takes your pick
- `canon:design-record` lands a pick in `canon/design/` and carries its values into `canon/DESIGN.md`
- `canon:design-identity` drafts a logo mark and social card

Pick tier 0 when the UI is not the core product, decisions fit in sentences, and stakeholders review code.

## Tier 1: visual companion

Prose stays the source of truth, with a visual render as a feedback surface. Human edits to these derived artifacts are review annotations.

- Excalidraw canvas server plus the community [`yctimlin/mcp_excalidraw`](https://github.com/yctimlin/mcp_excalidraw) MCP, where the agent draws, reads back, and revises
- Playwright MCP ([`microsoft/playwright-mcp`](https://github.com/microsoft/playwright-mcp)) for browser checks off the accessibility tree
- Chrome DevTools MCP ([`ChromeDevTools/chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp)) for traces, network, DOM, and CSS
- Claude Design for codebase extraction or a polished handoff bundle
- A frontend design skill: [pbakaus/impeccable](https://github.com/pbakaus/impeccable), [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), or Anthropic's `frontend-design`

Impeccable keeps its own root `DESIGN.md` and `PRODUCT.md`, separate from `canon/DESIGN.md`. Use Excalidraw for agent-driven layout iteration, and Claude Design for one extraction pass or the final handoff. Most projects pick one.

Pick tier 1 when stakeholders want layouts before code and one contributor owns design and implementation.

## Tier 2: visual as source of truth

Design happens in a graphical tool, and implementation follows it. `canon/DESIGN.md` becomes generated, with a top note naming the upstream Claude Design project ID or Figma file URL.

- Figma desktop with the official [Figma Dev Mode MCP](https://www.figma.com/blog/introducing-claude-code-to-figma/) for teams with a designer already on Figma. It syncs both ways and captures a running UI into editable frames.
- Claude Design with its Claude Code handoff bundle for teams without Figma. The handoff is one-way.
- The Playwright and Chrome DevTools MCPs from tier 1

Pick tier 2 when the UI is the product, a designer owns it, and design changes more often than code.

## Decision guide

Count yes answers to four questions. Zero or one is tier 0, two or three is tier 1, and four is tier 2.

- Is the UI the product rather than a thin interface over a backend?
- Do non-engineers review visual proposals before code exists?
- Is there a dedicated designer, or will there be one?
- Does design iterate independently of code?
