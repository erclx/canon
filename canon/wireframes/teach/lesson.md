---
title: Teach lesson
description: A single lesson's article view, with its chrome, panels, callouts, quiz, and footer references
---

# Teach lesson

One page per written lesson, at `<workspace>/lessons/NNNN-<slug>.html`. `rewriteLesson` in `src/teach/nav.ts` splices the header, the foot nav, and the embedded stylesheet into four marker comments on every `canon teach nav` run, leaving the `<h1>`, lede, body, and quiz hand-authored between them and wrapping them in `<main>` when the lesson holds none. Source: `examples/teach/00-fixture/lessons/0001-alpha-element.html`, the committed fixture the capture below is taken from, with `0002-beta-element.html` carrying the figure and the road it lacks.

## Regions

- Sidebar (`.sb`): as `chrome.md` draws it, open beside the pane on arrival above 1100px. It holds the meta line, every lesson in order with the one being read marked, the outline of that lesson folded under it, and a foot line
- Masthead: as `chrome.md` draws it, with `Lesson N of M` as the last crumb
- Article: the pane's reading column, holding the regions below in the order a lesson authors them
- Heading: the lesson title over its lede
- Assumes panel (`.assumes`): a tinted panel under the lede, one line per field
- Body: `h2` sections of prose, lists, and the blocks the next five bullets name, in whatever order the lesson places them
- Steps (`.steps`): a numbered list of moves, each a bold lead over a sentence and a line the learner could say (`.say`)
- Callout (`.hard`): a tinted panel with a hand-lettered label over one sentence
- Table (`.scroll`): a wrapper scrolling sideways on overflow, every column but the first right-aligned, with one row able to carry a tint (`.mark`)
- Figure: a hand-drawn SVG with its hand-lettered caption under it, breaking out of the measure to the wider column
- Road (`.road`): numbered rows, each a title with a duration on its right edge over a line of detail
- Quiz (`.quiz`): under the body, one question at a time, each a stem over four lettered options and a feedback panel
- Teach-back (`.teach-back`): after the quiz, a prompt over a disclosure holding what a complete answer covers
- References (`ol.refs`): the numbered citations the body points at
- Foot nav: at the bottom of the article's measure, the previous lesson on the left and the next on the right

## States

| State      | Reached when                                        | Shows                                                    | Evidence                             |
| ---------- | --------------------------------------------------- | -------------------------------------------------------- | ------------------------------------ |
| reading    | A lesson page loads above 1100px                    | The sidebar beside the article, the first question alone | `examples/teach/evidence/lesson.png` |
| narrow     | The window is 1100px or narrower                    | The article at its full measure with the sidebar shut    | not captured                         |
| panel-over | The visitor opens the sidebar at 1100px or narrower | The sidebar over the article behind a scrim              | not captured                         |
| answered   | The visitor picks an option                         | That question's feedback and the next question under it  | not captured                         |

The capture is a flat file rather than a per-state folder, per `chrome.md` `## States`.

### Panel over

```plaintext
┌─────────────────────────────┐
│  Fixture   ⌄             ×  │← .sb, fixed and full height, over a
│                             │  .sb-scrim covering the lesson. The
│  3 lessons                  │  × is .sb-close, which the panel
│                             │  carries because it covers the ☰ that
│  01 Alpha element           │  opened it.
│     A section heading       │
│  02 Beta element            │
│  03 Gamma element           │
└─────────────────────────────┘
```

The panel arrives shut and slides in from the left edge, at `min(21rem, 86vw)`. It overlays the lesson rather than squeezing it, so the reading measure keeps its width. The 640px rules under this width only reflow spacing and turn the jump-menu dropdown into a full-width sheet.

## Copy

- Sidebar meta line: "N lessons", above the list. The foot reads "N terms · N sessions", and drops either half the workspace does not have
- Filter placeholder and label: "Filter lessons"
- Empty list: "No lessons yet."
- Assumes panel labels: "Assumes:", "Covers:", "Sources:", each on its own line
- Foot nav labels: "Previous" and "Next", each paired with the sibling lesson's own title
- Last lesson's foot nav: "End of the lessons written so far" in place of the Next slot
- Title, lede, body, quiz, and references: authored per lesson, cited at the lesson file itself and not duplicated here

## Behavior

- The folded outline lists every `<h2>` on the page, under the lesson being read and under no other. Clicking a link scrolls to that heading.
- Scrolling marks the nearest heading passed, against a line that starts near the top of the viewport and ramps down to its bottom edge as the page runs out of scroll, which keeps the last heading reachable with little content trailing it.
- Nothing is marked until a heading has passed that line, so the first section is not reported as current while the title is still on screen.
- The sidebar opens by default on a lesson and stays shut on a page that lists the lessons itself, with a stored preference beating both.
- The panel resizes by dragging its right edge, between 208 and 296 pixels, defaulting to 256. A chosen width is restored before first paint, so it never animates in. Arrow keys on the grip step it by 8 pixels, or 32 with Shift, and Home returns it to the default.
- A filter appears above the list once the workspace holds more than eight lessons, and hides every row whose text does not match.
- Below 1100px the panel takes focus when it opens and returns it to the `☰` on every route out. Escape, the scrim, and the panel's own close control each shut it.
- While the panel is open below 1100px, Tab and Shift+Tab stay inside it and wrap at either end, since the scrim marks the lesson unavailable. Above 1100px nothing is contained, since the sidebar is a column rather than a layer.
- A shut panel is hidden rather than only moved off screen, so it leaves the tab order.
- A quiz takes one of two shapes, and a lesson carries one or the other. With radio options, as the fixture has, only the first question shows, and picking an option opens its feedback and reveals the next one with no script in the loop.
- With button options, an injected script locks a question on the first click, marking every option right, wrong, or chosen and opening the feedback. A second click does nothing.
- Each option shows the letter its markup names in a badge on its left, and the badge area stays empty on an option naming none.
- The foot nav is asymmetric at both ends: the first lesson gets no previous slot at all, and the last swaps its next slot for the end-of-lessons message.
- A figure always breaks the measure out to the wider column. There is no narrower variant of one.

## Not on this surface

- No quiz score or saved answers. A reload returns every question to unanswered
- No comments, highlights, or notes on the article
- No lesson content generated by the renderer. Everything between the markers is authored
