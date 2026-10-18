---
name: canvas-board
description: Scope boundary for driving the local design canvas, and the line between a drafted frame and the design it feeds
---

# Canvas board requirement

## Gap

Without this skill, a session asked to draw on the canvas writes frames nothing is serving and reports them drawn. It trusts a passing capture, though a blank shell passes every capture while the operator sees an empty tab. From a linked worktree it writes a copy the canvas never serves, and it captures after every edit.

It reads "this one" from the conversation rather than the operator's selection, or acts on a stale element pick and edits the wrong element. It restyles through a class while the operator's inspector edit sits inline, so the change never shows. A picked frame stays on the canvas as the only record, and the design document never learns it.

## Must

- The canvas is serving and its live shell loads at the address the server reported before any frame is written, and a refusal or a blank shell is reported rather than drawn into
- Pages and frames go through the verbs, so the session and the operator's drags share one writer, and a frame from a linked worktree takes the main-root route
- The operator's selection decides what "this one" means, and a stale element pick reads as unknown
- A frame's inline styles are read before a restyle, the run names which operator edits it kept and dropped, and capture runs once per finished frame or page
- A picked value lands in the project's stylesheet and its intent in the design document, while a picked layout stays on the canvas for the plan that builds it

## Must not

- Present the canvas as the project's source of truth for design, or promise it survives a lost checkout
- Write frames when `canon` or its canvas command is missing
- Name any third-party design tool, or the canvas's predecessor surface
- Be reached only by the author typing its name, since a request to draw, select, or capture on the canvas should reach it by description

## Out of scope

- Drafting candidates for a taste decision and taking the pick, which `pick-by-eye` owns
- What the canvas verbs do internally, which the CLI's own contract owns
- The content format a frame and a layout take, which the canvas standard owns
- Tracing reference images into design values, writing the design document from code, and backing up the canvas folder, which no skill owns
