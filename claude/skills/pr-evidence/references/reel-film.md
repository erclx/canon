---
title: Reel film
description: The filming steps and the still check of the reel pr-evidence posts, split from reel.md to keep it under the length ceiling
---

# Reel film

This file continues `reel.md`, which sends the reel step here for the film and the still check.

## Film the reel

Empty the takes folder before every film, refilms included. `canon take` never clears it, and the timing check below reads a beat folder a dropped or renamed beat left as a harness beat.

```bash
rm -rf .canon/tmp/pr/reel/<number>/<width>/takes
```

```bash
canon take <url> .canon/tmp/pr/reel/<number>/<width>/plan.json --out .canon/tmp/pr/reel/<number>/<width>/takes --reel .canon/tmp/pr/reel/<number>/<width>/reel.webp --viewport <width>x<height> --max-seconds 15 --json
```

Branch on the record's `reason`, never on the exit code.

| Record              | Route                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| No `reason`         | Continue to the stills                                                                                                  |
| `reel-failed`       | Skip as `reel-failed` with the record's `message`                                                                       |
| `target-offscreen`  | Add a setup step per the note below the table, then film once more. Skip as `target-offscreen` on a second refusal      |
| `target-covered`    | Clear the cover per the note below the table, then film once more. Skip as `target-covered` on a second refusal         |
| `over-cap`          | Drop `beat` and each beat after it, then film once more. Skip as `over-cap` if `beat` is first or it refuses again      |
| `target-missing`    | Fix the plan off the record's `still` and `beat`, then film once more. A second refusal is owed, per the section below  |
| `target-ambiguous`  | Narrow the target off the record's `still` to one element, then film once more. Skip as `target-ambiguous` on a second  |
| `clip-mismatch`     | Skip as `clip-mismatch` with the record's `beat` and `message`, never as `wrong-state`, since the clip came out cropped |
| `network-unmatched` | Fix the beat's pattern off the record's `message`, then film once more. Skip as `network-unmatched` on a second refusal |
| Any other value     | Skip under that `reason`, naming its `beat` when the record carries one                                                 |

The setup step for `target-offscreen` brings the target into the window. It is a scroll over an element already inside the window, such as a fixed header, with `dy` covering the distance, or a click on a link to the target.

The fix for `target-covered` depends on the cover the record's `message` names. A banner or a dialog takes a setup step that closes it. A layer built to take every press, such as a canvas board's, takes `"through": true` on the step instead.

### A skip for a state the fixture lacks

A skip whose cause is a state the drive fixture lacks, such as `target-missing` on a control only that state renders, is work the building session owes. So is a `target-missing` that survives the retry above, since the still showed a page the plan could not reach.

- Film a beat from a box carrying `(needs fixture)` only if the state answers, and otherwise skip it as owed
- Report the owed skip on the evidence comment's `--reel-skip` line and in the closing report. Name the state, selector, or setup step the beat needed, and the selector a `target-missing` beat tried.
- Never report it as a plain skip, since the next pull request meets the same fixture and skips again
- Name the project's seed as where the state goes when `canon/config/preview.json` declares a `seed` command, since a drive-only state laid there leaves the committed fixture alone
- Read `canon pr drive-copy --help` for what the seed runs and when, rather than restating it on the comment

## Check each still

Open each beat's `still.jpg`, the closing frame the record names in its `still` field, and confirm it shows the state the beat's box describes. This check replaces the operator's approval, so it runs on every reel.

- A still showing the wrong state skips the reel as `wrong-state`, naming the beat and what the still shows
- A record whose beats carry no `still` field comes from a `canon` predating the still, so skip as `no-still` rather than posting a reel nothing checked
- Read `fallback` on each beat. A beat filmed by screencast still joins the reel, since the reel shrinks every beat to one width.

A beat's still shows only its closing frame. To judge the reel's motion before pushing, write evenly spaced frames of the reel itself and open them, since no other verb reads a frame back out of the animation:

```bash
canon take stills .canon/tmp/pr/reel/<number>/<width>/reel.webp --out .canon/tmp/pr/reel/<number>/<width>/stills --sheet .canon/tmp/pr/reel/<number>/<width>/sheet.png
```

Open `sheet.png` for the four frames at once. Add `--overwrite` on a refilm, since a still already there is never replaced without it.

Then check the takes' timing before pushing, since a still shows the closing frame and none of the motion before it.

```bash
canon take check .canon/tmp/pr/reel/<number>/<width>/takes --json
```

- No `reason` means every beat passed, so continue to the push
- `reason: breach` means a beat broke a rule. Film the reel once more and check again, then skip as `timing` on a second breach, naming each beat's `dir` and `rule`.
- Any other `reason` skips under that `reason`, naming its `beat` when the record carries one
