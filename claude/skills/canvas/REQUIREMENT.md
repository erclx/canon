---
name: canvas
description: Scope boundary for driving the local design canvas, and the line between a drafted frame and the design it feeds
---

# Canvas requirement

## Gap

Without this skill, a session asked to draw on the canvas writes frames into a folder nothing is serving, so the operator sees nothing and the session reports the frames as drawn. When the server is running, the session trusts a passing capture as proof the canvas works. Captures go through the frame route, so a shell that answers its address with an empty page passes every capture while the operator looks at a blank tab.

It reads "this one" from the conversation rather than from the operator's selection, and when it does read the selection it acts on an element index recorded against an earlier version of the file, which lands the edit on a different element. It restyles through a class while the operator's inspector edit sits on the element as inline style, so the change never shows and the session reports it as made.

It writes frames from a linked worktree with the file tools, which refuse the main-root path and offer a worktree copy the canvas never serves. It captures after every edit, filling session scratch with images of drafts nobody picked.

When the operator picks a frame, the session leaves the decision on the canvas and cites the frame as the design, so the project's design document never learns it and a gitignored file becomes the only record.

## Must

- Start the canvas when it is not serving, before writing any frame
- Confirm the live shell loads at the address the server reported, rather than trusting a capture
- Read the address off the server's record rather than composing one
- Make pages and frames through the verbs, so a box and the operator's drags share one locked writer
- Name the main-root write route for a frame written from a linked worktree
- Read the operator's selection when they point at something, and treat a stale element pick as unknown
- Read a frame's inline styles before restyling it, and say which operator edits were kept and which dropped
- Capture once per finished frame or page rather than after every edit
- Carry a picked value into the project's design document, and leave a picked layout on the canvas for the plan that builds it

## Must not

- Present the canvas as the project's source of truth for design
- Promise the canvas survives a lost checkout
- Name any third-party design tool, or the canvas's predecessor surface
- Be invoked only by the author typing its name. A request to draw, select, or capture on the canvas should reach it by description, and a run where it never fires on such a request is a defect in the description

## Guards

- No `canon` on PATH, or an installed CLI with no canvas command, stop rather than writing files nothing serves
- A server that refuses to start, or a shell that answers blank, stop and report it rather than drawing into it

## Out of scope

- What the canvas verbs do internally, which is the CLI's own contract
- The content format a frame and a layout take, which the canvas standard fixes
- Drafting candidates for a taste decision and taking the pick, which `draft-and-pick` runs on its own render path
- Tracing reference images into design values or writing the design document from code, which no skill owns now
- Backing up the canvas folder off one disk
