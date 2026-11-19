---
title: Design reference folder
description: Shape and content rules for canon/design, the tracked folder of accepted design frames a build matches
---

# Design reference folder

Applies to `canon/design/`. Each file is an accepted design a build matches, kept as a picture for a reader and as frame HTML for exact values. The folder holds what was picked, never a draft.

## Scope

Governs the folder's groups, the file names inside them, the support folder, the group files beside them, and the generated index at `canon/design/index.md`.

Does not govern:

- The design document at `canon/DESIGN.md`, which `design.md` beside this file governs
- When a pick lands and how a build is held to a reference, which the design-reference governance rule states
- The content format a frame is drawn in, which Frameboard owns and `frameboard docs --json` prints

## What a working folder looks like

A folder works when a builder opening it finds the reference for the surface they are changing without asking anyone:

- Does the group a surface sits in match where a user meets it in the app?
- Does each reference carry both themes, as a picture and as frame HTML?
- Does each group's file say which code it governs?

## Groups

Group by app part, being the places a user sees, such as `home`, `inspector`, or `menus`. A component folder splits one screen across many folders, and a concern folder mixes surfaces a builder edits apart.

- Give each app part one plain kebab-case folder directly under `canon/design/`
- Put the inputs every app part draws on, such as tokens, colors, and the logo, under `foundations/`, so they read apart from places in the app
- Gather a surface shown on several app parts, such as a toast, under the part a user meets it in first
- A group may split into one subfolder per section when its code splits the same way, as `home/sidebar/`. A flat group stays conforming, and a section folder takes no further level.
- Name a file inside a section folder without repeating the section, as `home/sidebar/desktop-dark.png` rather than `home/sidebar/sidebar-dark.png`

## Files

Each reference is one name in two themes, with a PNG and its frame HTML per theme.

- Name each file `<name>-dark` or `<name>-light`, as in `grid-dark.png` beside `grid-dark.html`
- Keep one HTML file without a theme suffix only for a frame that switches theme itself, beside both PNGs
- Put what every frame HTML loads, being its stylesheet, script, fonts, and vendored files, under `assets/<project>/`, one folder per board project
- Keep every such file there, since the sync writes each frame's assets links to that folder, one `../` per level the frame sits below `canon/design/`, and reports a file no mapping writes as stray

## The index

The index tells a reader which code each group governs, the link a file listing lacks. It splits in two, so a branch landing a reference in an existing group edits no line another branch edits.

- Give each group one file beside its folder, as `canon/design/home.md` beside `canon/design/home/`, holding what the user sees, the code the group governs, and the states its frames show
- Keep every index file out of the group folders, since the sync reports a file no mapping writes inside them as stray
- Generate `canon/design/index.md` from the group files with `canon indexes regen canon/design`, and never edit its list by hand
- List no files, since the tree and the sync's own check already answer what exists
- Keep the sync's canvas mapping out of the index, in a file the sync owns beside it

The generator reads each group file's `title` and `description` into one line of the top-level list. A support folder such as `assets/` takes no group file and stays off the list.

Two branches each adding a new group still meet on the generated list, since both insert a line there. The second to merge reruns `canon indexes regen canon/design` after its rebase rather than resolving the lines by hand.

### The group file

The frontmatter `description` says what the user sees, so the generated list carries it. The body holds an H1 and two lists under `## Code` and `## States`.

A group split into section folders keeps one file for the whole group, since a file per section would sit inside the group folder. Its body gives each section an H3 named by the section path, opening with a sentence on what the user sees there, then the section's code and states.

### Sizing the state list

The States list names the kinds of state the frames show, such as themes, widths, and the empty and error states, rather than one entry per frame. A list that grows with every frame has stopped naming kinds.

A group whose list keeps growing splits instead, into one section folder per part of its code as `## Groups` allows, and each section takes its own H3 in the group file. Where the code does not split, the group names broader kinds of state.

### An index in the older shape

An index carrying one hand-kept table of groups predates this standard. It stays valid, and `canon markdown audit` still reports a table cell in it past 120 characters. A project moves to group files when a landing next touches its index, writing one file per row and dropping `auto: false` from the top-level index so the generator writes it.

### Templates

The top-level index carries frontmatter alone, and the generator writes the body from its `title` and `subtitle`.

```markdown
---
title: Design references
description: The accepted design frames a build matches, grouped by app part
subtitle: Each group holds accepted frames a build matches, light and dark. Each line links the group file naming the code it governs.
---
```

A group file, `foundations` included, takes this shape.

```markdown
---
title: Inspector
description: <the surface the user sees>
---

# Inspector

## Code

- `<path in source>`

## States

- <kinds of state>
```

A split group gives each section its own H3 in place of the two lists.

```markdown
---
title: Home
description: <the surface the user sees>
---

# Home

## Sections

### `home/sidebar`

<what the user sees in this section>

- Code: `<section path>`
- States: <kinds of state>
```

## Lifetime

The design-reference governance rule states how long a reference stays, when it is redrawn, and when it goes with its surface.
