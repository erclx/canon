# Requirements

A developer working with coding agents needs a local board where agents draw screens as plain HTML files and the developer reviews and tweaks them, with no hosted design tool or MCP server.

This record holds at most 600 words.

## Goals

### Files and folders

- An agent draws by writing an HTML file and running a few commands, each with machine-readable output and no prompts
- The files are the design. Frameboard keeps no private copy, and a hand edit changes only what it edited.
- Frames render as real web pages, so animation, video, and interaction work
- A board folder lives inside a repository or anywhere on disk, with or without git
- An empty folder starts with one command

### Projects and navigation

- A board folder holds several projects, each a set of pages holding frames and not a repository
- A home view lists every project as cards or rows, with a new project button. Moving between projects goes through it.
- A command palette jumps to any project, page, or frame and runs the board's actions

### Hand edits

- The developer adds, duplicates, renames, reorders, and deletes pages and frames, adds a frame at a phone, tablet, or desktop size, selects several frames, and undoes their own changes
- A developer selects a frame or element and adjusts what is quicker by hand, being frame position and size, and an element's name, opacity, radius, type, fill, stroke color, shadow, and text. Colors show their token names.

### Working with the agent

- The agent sees what the developer selected and works through notes pinned on frames. A note sent to a listening session reaches it at once, and the agent replies in the note.
- The board shows which frame an agent is editing, and a second session is told it is taken
- A frame breaking a content rule is reported to the agent that wrote it, at once, and on the board. A project can add rules of its own.
- An agent screenshots a frame or a whole page, in either theme

### Themes and tokens

- Every frame works in light and dark. One toggle switches the whole board, and a frame can be flipped alone.
- Frames share one look through design tokens, with a board-wide default and per-project overrides

## Non-goals

### Never

- Real-time collaboration, comments, teams, or sharing links
- A hosted service, an MCP server, or export
- Claude rules shipped with the tool

### Never by hand

- Drawing tools, vector editing, or image editing
- Layout editing, being flex, padding, element size, or position inside a frame
- Effects controls such as blending and filters
- Components, constraints, or a plugin system

### Deferred

- Motion review, being a scrubber, a screenshot at a chosen moment, a filmstrip, or a recording
- A custom color picker, scrubbing number fields, home view search and archive, and present mode
- A narrow-screen layout. Below about 1024px the board hides its UI and the canvas still pans and zooms.
- Opening one frame on a phone over the local network
- Skill and hook packaging for agents other than Claude Code
- Windows

## Constraints

- Runs on macOS and Linux
- A hand control earns its place only when the edit beats asking the agent, and nothing by hand reshapes layout.
- Human and agent edits never silently overwrite each other.
- Frameboard knows nothing about any one consumer. Another tool hands it a board folder and a token stylesheet.
