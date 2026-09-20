---
title: Teach lesson
description: A single lesson's article view, with its chrome, panels, callouts, quiz, and footer references
---

# Teach lesson

One page per written lesson, at `<workspace>/lessons/NNNN-<slug>.html`. `rewriteLesson` in `src/teach/nav.ts:1081-1159` splices the header, the foot nav, and the embedded stylesheet into four marker comments on every `canon teach nav` run, leaving the `<h1>`, lede, body, and quiz hand-authored between them. Primary source for the body: `lessons/0001-scoping-before-solving.html`, the richest of the three fde lessons and the only one carrying `.road` and `.no`.

The chrome shown here comes from `nav.ts`'s current render functions rather than from that file. This workspace's lessons predate the marker-splice convention, and re-running `canon teach nav` for this plan refused to rewrite any of them, each reported `skipped` for a missing `canon:teach:style` marker. The authored body sits outside that gap and is read straight off disk.

## Article (above 1100px, sidebar beside the lesson)

```plaintext
┌────────────────┬─────────────────────────────────────────────────┐
│  Fixture    ⌄   │  ☰  Workspaces ⌄ / Fixture ⌄ / Lesson 1 of 3  ☀/☾ │← see chrome.md
│                │▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
├────────────────┼─────────────────────────────────────────────────┤
│  3 lessons     │                                                 │
│                │                                                 │
│  01 Scoping…   │← .sb-on, the lesson being read                   │
│     First, a…  │← .sb-out, the outline folded under it, one row   │
│     The round… │  per h2. Every other lesson shows its title      │
│     Why you…   │  alone.                                         │
│     The rest…  │                                                 │
│  02 Sizing…    │                                                 │
│  03 The enter… │                                                 │
│                │                                                 │
├────────────────┤                                                 │
│  8 terms · 1 … │← .sb-foot                                       │
└────────────────┴─────────────────────────────────────────────────┘
   .sb              .pane
```

The pane's own content, which is every teach page's article column and is what the rest of this wireframe draws:

```plaintext
┌──────────────────────────────────────────────┐
│                                                │
│  Scoping before solving                       │← h1
│  Lesson 1. What the forward-deployed design…  │← lede
│                                                │
│  Assumes: you have shipped real systems…      │← .assumes panel,
│  Covers: the shape of the round…              │  one line per field,
│                                               │  small-caps label
│  Sources: an FDE interview guide, cited at    │
│  the foot…                                    │
│                                                │
│  First, a correction to your floor            │← h2, body prose
│  You called yourself a complete beginner…     │  follows as plain <p>
│                                                │  blocks, one per beat
│  The round is not the one you're preparing…   │← h2
│  …                                             │
│         ╔═══════════════════════════════╗     │
│         ║   hand-drawn SVG figure        ║     │← figure, always breaks
│         ╚═══════════════════════════════╝     │  the measure out to
│         Five to eight stages over three to…   │  --wide: 64rem, centred,
│                                                │  its own hand-lettered
│                                                │  caption below it
│  ┃ The one sentence to memorize                │← .hard callout: a
│  ┃ The guide names round 5 the single…         │  tinted panel with a
│                                                │  hand-lettered label
│  The procedure                                │← h2
│  1  Clarify before solving                     │← .steps: a plain <ol>,
│     Ask what you were not told…                │  no styling beyond the
│     "Before I design anything, can I…"          │  browser's own numbers
│  2  Name stakeholders and the success metric    │
│     …                                          │
│                                                │
│  ┃ Where difficulty helps here                  │← second .hard callout
│                                                │
│  Worked example                                │← h2
│  The failing answer starts here: "So I'd…"      │
│  ┌────────────────────────────────────────┐    │
│  │ "A few things before I design.           │    │← pre/code block,
│  │  Who is searching, clinicians at the…    │    │  monospace, scrolls
│  └────────────────────────────────────────┘    │  on overflow
│  …                                             │
│                                                │
│  Your week                                     │← h2
│  1  The scoping procedure           2 days      │← .road: numbered rows,
│     Drilled out loud against cold prompts…      │  a duration on the
│  2  Sizing out loud                half day      │  right edge of each
│  3  The enterprise deployment skeleton  1 day    │
│  …                                             │
│                                                │
│  Explicitly not this week. Consensus proto…     │← .no: a plain block,
│  Every one of those is standard system-…        │  bold lead phrase, no
│                                                │  border or tint of its own
│  Where the sources disagree, and what to do…    │← h2
│  …                                             │
│  Three things only the video says               │← h3, nested under h2
│  …                                             │
│                                                │
│  The advantage you're not using                 │← h2
│  …                                             │
│                                                │
│  Retrieval check                                │← h2, opens .quiz
│  Answer before scrolling back…                  │
│  1. What is named as the most common…           │← .q, one per question
│  [ ] Spending too long on scoping and never…    │← .opt, four per question
│  [ ] Proposing a solution before the problem…   │
│  [ ] Choosing a database that cannot scale…     │
│  [ ] Failing to name the consistency model…     │
│  …                                             │
│                                                │
│                       Sizing out loud →         │← foot nav: empty on the
│                                                │  left, lesson 1 has no
│                                                │  previous slot at all
│  Lesson 1 of the fde-system-design workspace.   │← footer
│  1. Exponent. Forward Deployed Engineer…        │← ol.refs, one per
│  2. Exponent. Forward Deployed Engineer…        │  citation, numbered
│  3. Tech With Tim. How to Become a…             │
│                                                │
└──────────────────────────────────────────────┘
```

## Narrow (1100px and below, sidebar over the lesson)

```plaintext
┌─────────────────────────────┐
│  Fixture   ⌄             ×  │← .sb, fixed and full height, over a
│                             │  .sb-scrim covering the lesson. The
│  3 lessons                  │  × is .sb-close, which the panel
│                             │  carries because it covers the ☰ that
│  01 Scoping…                │  opened it.
│     First, a…               │
│  02 Sizing…                 │
│  03 The enter…              │
└─────────────────────────────┘
```

The panel arrives shut and slides in from the left edge, at `min(21rem, 86vw)`. It overlays the lesson rather than squeezing it, so the reading measure keeps its width. The sidebar was hidden outright here in an earlier round, which left the `☰` painted exactly where it could not act and deleted the filter and the folded outline, neither of which the breadcrumb menu carries.

Nothing else in the layout changes below this width. The 640px rules under it only reflow spacing and turn the jump-menu dropdown into a full-width sheet.

## Table block (from the sibling workspace, no fde lesson uses it)

```plaintext
┌────────────────────────────────────────────────────────────────┐
│ Configuration    p@1   p@5   p@10  recall@10   p50 ms   p95 ms  │← .scroll wrapper,
│ filter-only      .020  .020  .020  .150        0.0      0.0    │  scrolls sideways on
│ bm25-only        .680  .224  .124  .920        0.2      1.2    │  overflow rather than
│ dense-only       .780  .240  .132  .965        6.4      7.8    │← .mark row, tinted to
│ hybrid           .720  .240  .128  .950        6.2      15.2   │  call out one result
└────────────────────────────────────────────────────────────────┘
```

Every column but the first is right-aligned.

## Copy

- Sidebar meta line: "N lessons", above the list. The foot reads "N terms · N sessions", and drops either half the workspace does not have.
- Filter placeholder and label: "Filter lessons".
- Empty list: "No lessons yet."
- `.assumes` panel labels: "Assumes:", "Covers:", "Sources:", each on its own line.
- Quiz section title: "Retrieval check", with the standing instruction "Answer before scrolling back. Getting one wrong and then reading why is worth more than a clean pass."
- Footer line, per lesson: "Lesson N of the `<workspace-slug>` workspace."
- Foot nav labels: "Previous" and "Next", each paired with the sibling lesson's own title.
- Last lesson's foot nav replaces the "Next" slot with "End of the lessons written so far".

## Behavior

- The folded outline lists every `<h2>` on the page, under the lesson being read and under no other. Clicking a link scrolls to that heading.
- Scrolling the page marks the nearest heading passed, against a line that starts near the top of the viewport and ramps down to its bottom edge as the page runs out of scroll. That ramp is what keeps the last heading reachable with little content trailing it.
- Nothing is marked until a heading has passed that line, so the first section is not reported as current while the title is still on screen.
- The sidebar opens by default on a lesson and stays shut on a page that lists the lessons itself, with a stored preference beating both. A lesson-count threshold on its own was built and reverted, since it hides the panel where it is the only cross-lesson navigation there is.
- The panel resizes by dragging its right edge, between 208 and 296 pixels, defaulting to 256. The ceiling was cut twice from 448, since past 296 the panel takes width the reading measure needs.
- A chosen width is written to the root element and restored before first paint, so it never animates in. Arrow keys on the grip step it by 8 pixels, or 32 with Shift, and Home returns it to the default.
- A filter appears above the list once the workspace holds more than eight lessons, and hides every row whose text does not match.
- Below 1100px the panel takes focus when it opens and returns it to the `☰` when it closes. Escape, the scrim, and the panel's own close control each shut it. A shut panel is hidden rather than only transformed off screen, so it leaves the tab order with it.
- Clicking a quiz option locks that question: every option in it gets a state, right, wrong, or chosen, and the feedback panel opens beneath. A second click in the same question does nothing further. An injected script drives this button shape, which the three lessons this page is drawn from carry. A lesson using radio options instead, where only the first question is on screen, selecting an option opens that question's feedback and reveals the next one, and no script is in the loop, is a different quiz shape outside this wireframe's surface.
- This workspace's quiz options carry no visible letter badge. The stylesheet reserves the space for one, keyed off an attribute the authored markup here does not set, so the badge area renders empty rather than missing.
- The foot nav is asymmetric at both ends: the first lesson gets no previous slot at all, not even a placeholder, and the last lesson swaps its next slot for the end-of-lessons message. A lesson in the middle gets a live link on both sides.
- A figure always breaks the measure out to the wider column. There is no narrower variant of one.
