---
title: Pages
description: The teach root, contents, lesson, and reference pages, their regions, states, and behavior, and the captures that show them
---

# Pages

`overview.md` carries the workspace, the splice, and the verbs. This entry carries what each page kind shows and does.

Four page kinds share one chrome, which `chrome.md` carries. The captures sit flat under `examples/teach/evidence/`, one image per page rather than a folder per state, as `root-listing.png`, `root-listing-light.png`, `workspace-index.png`, `lesson.png`, and `reference.png`. Page copy that ships in `src/teach/nav.ts` or in a workspace's own files is not restated here.

## Root

`renderRootPage` regenerates `.canon/teach/index.html` wholesale on every `nav` run, from `listWorkspaces` in `src/teach/workspace.ts` scanning the folder on disk.

- The sidebar lists the workspaces rather than lessons, folds no outline under any of them, and arrives shut, since the roster already lists what the panel would
- The roster is one row per workspace in folder order, divided by rules, with a two-digit ordinal on the left, the title over its lesson, reference page, and term counts in the middle, and a state word on the right
- The state word is `Stub` for a workspace with no `MISSION.md`, `Open` for one with a mission and no lesson, and `Live` for one with a lesson
- A row links to the workspace's contents page, except a Stub row, which is dimmed and points nowhere
- No folder gives the heading with no rows. A row carries no status dot or accent, no lesson list, and no create or delete control, since `canon teach open` does that from the terminal
- The root's own breadcrumb segment is the current page and still opens a jump menu onto the same roster

## Contents

`renderContentsPage` rewrites `<workspace>/index.html` wholesale from `MISSION.md`, the written lessons, the reference pages, and `GLOSSARY.md`.

- The sidebar lists the workspace's lessons with none marked and arrives shut, since the Lessons section lists the same set with a lede each
- Sections run in order: the heading over the mission's description, a numbered success criteria list, one row per written lesson, one row per reference page with an `R` ordinal, then the glossary
- Every section but the glossary is conditional. No success line, no lesson, or no reference page drops the whole heading and body rather than rendering an empty one, and the lede drops when the mission has no description
- The glossary always renders down to zero terms. Its filter narrows the list live over both a term and its definition, and clearing it, or the clear button shown once nothing matches, restores the list and returns focus to the input
- A reference row opens the page's rendered `.html` sibling, never its markdown
- A lesson row carries no state mark, since a lesson not yet written does not appear. No quiz score, no per-lesson progress, and no edit control, since a hand edit is lost on the next run

## Lesson

`rewriteLesson` splices the chrome into the four markers on every run and leaves the heading, lede, body, and quiz authored between them. A lesson is the only page whose sidebar opens on arrival above 1100px, with the one being read marked and its `h2` outline folded under it.

- The article's authored blocks are an assumes panel under the lede, steps, a callout, a table that scrolls sideways with every column but the first right-aligned, a figure, a road of numbered rows with a duration each, a quiz, a teach-back prompt over a disclosure, and numbered references
- A figure always breaks out of the measure to the wider column and has no narrower variant
- A quiz takes one of two shapes and a lesson carries one. Radio options show only the first question, and picking one opens its feedback and reveals the next with no script. Button options lock a question on the first click through an injected script, marking each option right, wrong, or chosen, and a second click does nothing
- An option shows the letter its markup names in a badge on its left, and the badge area stays empty on an option naming none. A reload returns every question to unanswered, since nothing saves a score or an answer
- The outline marks the nearest heading passed, against a line that starts near the top of the viewport and ramps to its bottom edge as the page runs out of scroll, so the last heading stays reachable. Nothing is marked until a heading has passed that line
- The sidebar resizes by dragging its right edge between 208 and 296 pixels from a 256 default. A chosen width is restored before first paint so it never animates in. Arrow keys on the grip step 8 pixels or 32 with Shift, and Home returns to the default. A stored open or shut preference beats the per-page default
- A filter appears above the list once the workspace holds more than eight lessons
- At 1100 pixels and below the sidebar is a layer rather than a column. It slides in from the left edge at `min(21rem, 86vw)` over a scrim and carries its own close control, since it covers the control that opened it. The 640 pixel rules only reflow spacing and turn the jump menu into a full-width sheet
- The overlay takes focus on open, holds Tab and Shift+Tab inside, and returns focus to the opener on Escape, the scrim, or the close control. A shut panel is hidden and so leaves the tab order
- The foot nav is asymmetric. The first lesson has no previous slot, and the last swaps its next slot for the end-of-lessons message
- No comments, highlights, or notes, and the renderer generates no lesson content, since everything between the markers is authored

## Reference

`renderReferencePage` rewrites `reference/<slug>.html` wholesale beside its markdown, dropping the frontmatter and rendering the body with raw HTML escaped inside `<main class="ref">`. Its sidebar opens on arrival as on a lesson, since the page lists no lessons of its own.

- A relative link to another reference page's markdown opens its `.html` sibling, and a link to the glossary opens it on the contents page. A link to any other markdown file stays as written and opens as plain text
- Raw HTML in the markdown, such as a `<kbd>` or a `<details>`, shows as escaped text
- The breadcrumb's last crumb and the document title read the frontmatter `title`, falling back to the filename in sentence case, and the renderer adds an H1 only where the body has none
- The page carries no foot nav, glossary filter, or lesson listing, since it sits outside the lesson sequence

## Capture drift

The root capture trails the fixture, whose Fixture row reads one reference page where the image reads none, and only Live and Stub rows appear since no committed fixture reaches Open. The contents capture shows no Reference pages section, which `examples/teach/00-fixture/index.html` renders. A regenerated capture clears both.

