---
title: Teach lesson
description: A single lesson's article view, with its chrome, panels, callouts, quiz, and footer references
---

# Teach lesson

One page per written lesson, at `<workspace>/lessons/NNNN-<slug>.html`. `rewriteLesson` in `src/teach/nav.ts:669-731` splices the header, the foot nav, and the embedded stylesheet into four marker comments on every `canon teach nav` run, leaving the `<h1>`, lede, body, and quiz hand-authored between them. Primary source for the body: `lessons/0001-scoping-before-solving.html`, the richest of the three fde lessons and the only one carrying `.road` and `.no`.

The chrome shown here comes from `nav.ts`'s current render functions rather than from that file. This workspace's lessons predate the marker-splice convention, and re-running `canon teach nav` for this plan refused to rewrite any of them, each reported `skipped` for a missing `canon:teach:style` marker. The authored body sits outside that gap and is read straight off disk.

## Article (≥1421px, outline rail visible)

```plaintext
┌──────────────────────────────────────────────┐  ┌───────────────┐
│  ← masthead, breadcrumb, jump menu, theme:    │  │ On this page  │← .outline, fixed to
│    see chrome.md                              │  │  First, a…    │  the viewport rather
├────────────────────────────────────────────── ┤  │  The round…   │  than the scroll
│ ▰▰▰(here)  ▰▰▰  ▰▰▰                             │  │  Why you…     │  position. Starts
├────────────────────────────────────────────── ┤  │  The procedure│  below the bar, sits
│                                                │  │  Worked example│ in the gutter right
│  Scoping before solving                       │← h1  Your week    │  of the measure, one
│  Lesson 1. What the forward-deployed design…  │← lede  Where the…  │  link per h2
│                                               │  │  The advantage│
│                                               │  │  Retrieval…   │
│                                               │  └───────────────┘
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

## Narrow (≤1420px, no outline rail)

The same single-column article. The outline rail is removed outright rather than resized or relocated, the one structural breakpoint on this surface. Nothing else in the layout changes below it, and the 640px rules under that only reflow spacing and turn the jump-menu dropdown into a full-width sheet.

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

- Outline heading: "On this page".
- `.assumes` panel labels: "Assumes:", "Covers:", "Sources:", each on its own line.
- Quiz section title: "Retrieval check", with the standing instruction "Answer before scrolling back. Getting one wrong and then reading why is worth more than a clean pass."
- Footer line, per lesson: "Lesson N of the `<workspace-slug>` workspace."
- Foot nav labels: "Previous" and "Next", each paired with the sibling lesson's own title.
- Last lesson's foot nav replaces the "Next" slot with "End of the lessons written so far".

## Behavior

- The outline lists every `<h2>` on the page, skipped outright under three headings. Clicking a link scrolls to that heading and marks it active.
- Scrolling the page also marks the nearest heading passed, against a line that starts near the top of the viewport and ramps down to the viewport's own bottom edge as the page runs out of scroll, so the last heading stays reachable even with little content trailing it.
- Clicking a quiz option locks that question: every option in it gets a state, right, wrong, or chosen, and the feedback panel opens beneath. A second click in the same question does nothing further. That is the button shape, which the three lessons this page is drawn from carry and which an injected script drives. A lesson written since carries radio options instead and behaves differently: only the first question is on screen, selecting an option opens that question's feedback and reveals the next one, and no script is in the loop.
- This workspace's quiz options carry no visible letter badge. The stylesheet reserves the space for one, keyed off an attribute the authored markup here does not set, so the badge area renders empty rather than missing.
- The foot nav is asymmetric at both ends: the first lesson gets no previous slot at all, not even a placeholder, and the last lesson swaps its next slot for the end-of-lessons message. A lesson in the middle gets a live link on both sides.
- A figure always breaks the measure out to the wider column. There is no narrower variant of one.
