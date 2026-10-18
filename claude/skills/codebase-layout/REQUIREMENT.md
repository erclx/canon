---
name: codebase-layout
description: Why the session writing a new path into a plan needs placement guidance at that moment, and where that guidance stops short of test layers and module interfaces
---

# Codebase layout requirement

## Gap

The session that decides where a new file goes has nothing about layout in front of it. The planner writes each new path into the plan and the worker copies it, so a new path copies the flat folder beside it and a source folder grows flat until a split touches dozens of files.

Sharpening the rules does not reach the decision. An always-loaded line competes with everything else a session holds, and a path-scoped rule fires on a read of an existing file rather than on a path written into a plan. Each flat file also lands for a reason that sounds fine, such as the neighbors already being flat.

## Must

- Load whenever a plan names a path that does not exist yet, and on a direct question about placement
- Keep to the project's existing layout strategy, naming it before placing a file, and propose a strategy change as its own decision
- Split a folder when a second role enters it, with a file count only as a prompt to look, and colocate with the one consumer until a second promotes the file
- Give every new path a one-clause placement reason, and name a file for what it covers rather than repeating its folder
- Hold the stack-neutral core in the body, with category specifics in a reference, then close with excuses, red flags, and a checklist

## Must not

- Name a framework or runner in the body, or carry a hard file-count threshold
- Mandate one layout across projects over the project's own strategy
- Restate the layer rule that `test-craft` owns, or the pointer the routing rule carries

## Out of scope

- Which layer a test belongs at, which `test-craft` owns
- What crosses a module boundary, which `api-design` owns
- Interface depth and seams inside a module, which `code-craft` owns
- Per-language placement conventions, which the language testing rules own
