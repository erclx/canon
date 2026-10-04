---
title: Drive each box
description: Step 5 of review-ui, which maps a checklist line to browser calls, reads each value off the page, and gives the box one of four verdicts with the evidence that verdict carries
---

# Drive each box

Step 5 of `review-ui`. The browser is open at the address Step 3 picked, under the session Step 4 named. Every call below goes through `${CLAUDE_SKILL_DIR}/scripts/pw.sh -s=<project>-<number>`, shortened here to `pw`.

## Reading a line

A box written to the drivable format reads:

```plaintext
- [ ] <route>[, <width>]: <verb> <target> → <expected result>[ (taste)][ (local only)]
```

- **Route.** A path goes through `pw goto <address><path>`. A control name, or "from the page the app opens on", is reached by clicking from the opened address.
- **Width.** `pw resize <width> 900` before acting. A box naming no width is driven at 1440.
- **Verb.** The action the driver performs: `click`, `fill`, `press`, `hover`, a scroll through `eval` of `scrollIntoView`, or a resize.
- **`(taste)`.** The result is a judgment of look or feel. Capture, never judge.
- **`(local only)`.** The state needs something a hosted preview cannot reach. On a hosted address the box is not driven, naming the marker as the reason.

A box written before that format may carry no route, no width, and a verb such as "read" or "look at". Drive it anyway: take the opened address as the route and 1440 as the width, turn the verb into the nearest action, and name each guess in the verdict's evidence.

## Finding the element

`open`, `goto`, and every action print a snapshot path under `.playwright-cli/`. Search that file for the target's role or text and take its ref, or click by a role locator such as `"getByRole('link', { name: 'Pricing' })"`. Never print a snapshot whole, since a full page costs tens of thousands of bytes the verdict never needs.

## Reading the result

- Text, presence, and attributes: `pw --raw eval "<expression>"`, quoting the value back.
- Computed style: `getComputedStyle(<element>).<property>`.
- Geometry and overflow: `getBoundingClientRect()`, and `scrollWidth` against `clientWidth` on `document.documentElement`.
- A frame: `pw screenshot --filename=frames/<box-number>.png`, then open it with the file-reading tool before saying what it shows.

## The four verdicts

Each box takes exactly one.

| Verdict             | When                                                    | Evidence it carries                                                                                                                                   |
| ------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| pass or fail, read  | The result is a fact the page reports                   | The value read, quoted, such as `scrollWidth 436 against clientWidth 320`                                                                             |
| pass or fail, frame | The result has a stated criterion only an image settles | The matching evidence stem or the pushed frame's link going to the Frames block, and what the frame shows, in words                                   |
| needs eyes          | The box ends in `(taste)`                               | The matching evidence stem or the pushed frame's link going to the Frames block, and what the frame showed, with nothing about whether it looks right |
| not driven          | The state could not be reached                          | The reason, such as an unreachable address, a `(local only)` box on a hosted preview, or a target the snapshot does not hold                          |

A frame verdict carries one image at most, and never one the worker's evidence already shows. When a state and stem in the evidence record match the box's route, width, and theme, the evidence names that stem and nothing is pushed. Otherwise the frame goes up through `canon pr frames` and the `link` the record returned, which names the frame's path on the frames branch, goes under the Frames block and never inside the table row. Either way the words stay, describing the value or region judged, such as the element, its position, and the colors or text read, so a reader whose image fails to load can still check it.

A push that refuses leaves the words alone, with the reason named. Never cite the local frame path. A path under `.canon/` is a board identifier the label scan rejects, and it resolves only on this machine.

A fail names what was expected beside what was read. A not driven never reads as a fail, since it says the pass could not look rather than that the page is wrong. Its reason says whether the cause sits on the page or off it, since only a cause on the page opens the heading Step 7 picks.
