---
title: Drive each box
description: The access join Step 3 of review-ui makes, then Step 5, which maps a checklist line to browser calls, reads each value off the page, and gives the box one of four verdicts with the evidence that verdict carries
---

# Drive each box

Step 5 of `review-ui`. The browser is open at the address Step 3 picked, under the session Step 4 named. Every call below goes through `canon browser -s=<project>-<number>`, shortened here to `pw`.

## The access join

Step 3 reads this section once a rung answers. Read `access` from `canon/config/app-drive.toml` at the main worktree root, since a page needing a write link, a signed-in route, or a demo token shows its start state only behind it. An absent file or key opens the rung as it stands.

- Join a value starting with `/` to the rung, and take a full address as it stands. Step 4 opens the joined address alone.
- Every later route joins to the bare rung, never the joined address, since an `access` holding a query would swallow the path
- Test the rung bare in Step 3, so the `curl` spends no single-use link before the drive
- Take no `access` value from the launch brief, since the config is the one source
- Never print the joined address in a post, a frame, or a message, since `access` may carry a token. Name the rung and say the config's `access` was joined.

## Reading a line

A box written to the drivable format reads:

```plaintext
- [ ] <route>[, <width>]: <verb> <target> → <expected result>[ (taste)][ (local only)][ (needs fixture)]
```

- **Route.** A path goes through `pw goto <rung><path>`, the rung before the access join. A control name, or "from the page the app opens on", is reached by clicking from the opened address.
- **Width.** `pw resize <width> 900` before acting. A box naming no width is driven at 1440.
- **Verb.** The action the driver performs: `click`, `fill`, `press`, `hover`, a scroll through `eval` of `scrollIntoView`, or a resize.
- **`(taste)`.** The result is a judgment of look or feel. Capture, never judge.
- **`(local only)`.** The state needs something a hosted preview cannot reach. On a hosted address the box is not driven, naming the marker as the reason.
- **`(needs fixture)`.** The drive fixture lacks the state. Drive the box if the state now answers, and otherwise it is not driven for a cause on the branch, as the verdicts below state.

A box written before that format may carry no route, no width, and a verb such as "read" or "look at". Drive it anyway: take the opened address as the route and 1440 as the width, turn the verb into the nearest action, and name each guess in the verdict's evidence.

## Finding the element

`open`, `goto`, and every action print a snapshot path under `.playwright-cli/`. Search that file for the target's role or text and take its ref, or click by a role locator such as `"getByRole('link', { name: 'Pricing' })"`. Never print a snapshot whole, since a full page costs tens of thousands of bytes the verdict never needs.

## Reading the result

- Text, presence, and attributes: `pw --raw eval "<expression>"`, quoting the value back.
- Computed style: `getComputedStyle(<element>).<property>`.
- Geometry and overflow: `getBoundingClientRect()`, and `scrollWidth` against `clientWidth` on `document.documentElement`.
- A frame: `pw screenshot --filename=frames/<box-number>.png`, then open it with the file-reading tool before saying what it shows.

### Taste frames

A taste box takes the shot twice, once per theme, naming the theme in the file as `frames/<box-number>-<theme>.png`.

- Reach each theme through the page's own control when the box names one, and through `pw set-color-scheme <dark|light>` otherwise
- Read the page's background before the shot to confirm the theme changed
- A page painting the same under both has no second theme, so the box is not driven, with the reason naming that
- `pw clear-color-scheme` restores the default

## The four verdicts

Each box takes exactly one, keyed here by the state it answers.

- **pass or fail, read.** The result is a fact the page reports.
  - The evidence is the value read, quoted, such as `scrollWidth 436 against clientWidth 320`.
- **pass or fail, frame.** The result has a stated criterion only an image settles.
  - The evidence is the matching evidence stem or the pushed frame's link, inline under the failed box's heading, and what the frame shows, in words.
- **needs eyes.** The box's trailing markers hold `(taste)`, in any order.
  - The evidence is the dark and the light shot as a pair, each the matching evidence stem or a pushed frame's link, and what the frames showed, with nothing about whether it looks right.
- **not driven.** The state could not be reached.
  - The evidence is the reason, such as an unreachable address, a `(local only)` box on a hosted preview, or a target the snapshot does not hold.

A fail names what was expected beside what was read. A not driven never reads as a fail, since it says the pass could not look rather than that the page is wrong. Its reason says whether the cause sits on the page or off it, since only a cause on the page opens the heading Step 7 picks.

### A state the fixture lacks

A box the pass could not drive because the drive fixture holds no such state is a cause on the branch, never a skip. The building session owes the state, and no other session can add it.

- Name the cause as a missing fixture state, with the state to add and the selector or setup step the box needs
- Count it as not driven, and never as a fail, since the page may be right
- An address that did not answer stays a cause off the branch, and a `(local only)` box on a hosted address does too
- A state no fixture file can hold is the exit, such as one a project with no `canon/config/app-drive.toml` cannot reach inline. Name it a cause off the branch, so the review stays closed.

### A refused address

A permission rule or a classifier that denies the call opening or driving an address leaves the box not driven, for a cause off the branch. Name the refusal as the host worded it and the call it denied.

- Never retry through another route, being a second address, a different browser call, or a direct fetch, since the refusal is a decision about this pass rather than a fault to work around
- A refused opening call drives no box, so the pass posts open with the refusal as its cause line, per `${CLAUDE_SKILL_DIR}/references/post.md`
- Name the address by its rung and never print the joined `access`, which may carry a token

### Which image a verdict carries

A pass or fail resting on a frame carries one image at most, and never one the worker's evidence already shows. A needs-eyes box carries the pair, dark and light, since a taste call is made by comparing them.

- Match each theme separately. An evidence stem matching the box's route, width, and theme is named and nothing is pushed for it.
- A view with the dark shot in evidence therefore pushes the light one alone
- Otherwise push the frame through `canon pr frames` with `--theme`, and put the returned `link` in the box's own section, never inside a folded block

### The words beside an image

Either way the words stay, describing the value or region judged, such as the element, its position, and the colors or text read, so a reader whose image fails to load can still check it.

- A push that refuses leaves the words alone, with the reason named
- Never cite the local frame path, since a path under `.canon/` is a board identifier the label scan rejects and resolves only on this machine
