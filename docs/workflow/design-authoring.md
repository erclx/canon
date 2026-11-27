---
title: Design authoring
description: How a project drafts the design a UI plan cites, from a pick round on a Frameboard board at each device width to a graphical tool that owns the design
category: Workflow
---

# Design authoring

Most projects author design in the [visual design workflow](visual-design-workflow.md) loop and need nothing more. Start with `canon:design-pick`, which drafts candidates as frames on a [Frameboard](https://www.npmjs.com/package/frameboard) board and takes your pick, then record the pick with `canon:design-record`. `canon:design-identity` drafts a logo mark and social card the same way.

## What a round draws

A round draws every arm at a phone, a tablet, and a desktop width, read from the `Draw widths:` line in the `## Layout` section of `canon/DESIGN.md` and falling back to 390, 768, and 1280, the widths the screenshot harness commits. A drive with `canon:app-drive` draws on the board by the same convention.

A project declaring fewer classes under `[device-classes]` in `canon/config/app.toml`, such as desktop alone for a canvas tool, draws only those. Named scopes, matched by design group or changed path, let a desktop canvas and a responsive landing page share one record.

- A record still carrying the earlier `Device classes:` line fails the gate's Device classes stage until those classes move into `default` with a `why` and the line goes.
- A pick that scrolls sideways at any of those widths, or at 320, is held until it reflows.
- Before drafting, a round reuses the board's `references` page or runs `canon:design-gather` to fill one, with the sites you name or bare.
- That page holds section shots at each width, a filmed scroll, and a few hovers, each frame naming its source. Each arm names the frame it draws on and takes structure alone.

The round also asks for your taste at its start and keeps its work at its close, and an app pick can end in a prototype.

- Before the first look round, `canon:design-pick` asks once for taste words and images. Pasted images join the references page.
- The close keeps every round and the references page on the board and copies nothing out of it, so deleting a project deletes the rounds it held.

An app pick with several screens is offered a clickable prototype built to flows you confirm. It then owns behavior and copy, and each handover lists static frames it no longer matches.

## Where a round drafts

A pick drafts on `.canon/board/` at the main root, in a project its origin decides.

| The pick started from             | Project                                              |
| --------------------------------- | ---------------------------------------------------- |
| Your own ask                      | `pick-<nn>-<topic>`, in the `Picks` home folder      |
| A drive finding or an intake item | That drive's project, with the decision written back |
| A question in a groundwork track  | The track's `groundwork-<nn>` project                |

A standalone pick draws what won on `00-next`, and a second pick on the same topic adds pages to the same project. Name a project in the ask to place a round elsewhere, and name sites in a `canon:design-gather` ask to replace the default list it captures.

Use `canon:app-drive` when there is a built app to try and `canon:design-pick` when there is something to sketch. Answer an intake item `sketch` to leave it for a pick, which fills the slot once you make it.

## When a graphical tool fits

A graphical tool earns its place when design is the product, a designer owns it, and it changes more often than code. Then the tool is the source of truth, and `canon/DESIGN.md` carries a top note naming the upstream project.

- Figma with the official [Figma Dev Mode MCP](https://www.figma.com/blog/introducing-claude-code-to-figma/), for a team already on Figma. It syncs both ways and captures a running UI into editable frames.
- [Claude Design](../../wiki/claude/design.md) with its Claude Code handoff bundle, for a team without Figma. The handoff is one-way.

The visual design loop runs unchanged on either, with the tool's export standing in for the pick.

For the skills by moment, see the [skill map](skill-map.md).
