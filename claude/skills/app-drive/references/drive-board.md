---
title: Drive board
description: How app-drive draws on its own board project, from the page order and the frame lift to the capture and the refusals that end the board
---

# Drive board

Read before the first frame `app-drive` draws on the board, once Step 1 started it. The drive's project stays apart from `design-pick`'s rounds, so this file covers the drive's own pages alone. The `drawing.md` and `board.md` it names sit in `${CLAUDE_SKILL_DIR}/../design-pick/references/`.

## Drawing on the board

The drive's project holds `00-current`, a page per topic, and `00-next`, as `drawing.md` states. A topic's section is the drive's `<surface>`, the name `evidence/<surface>/` takes. Read `frameboard list --root <board> --json` with no `--project`, which refuses before the project exists, and run `project add` when it lacks it.

- Add each page and frame by the name, place, and height `drawing.md` gives, and take theming and font from `design-pick`'s Step 2
- Lift the copy's rendered markup per `${CLAUDE_SKILL_DIR}/../design-pick/references/live-arms.md`, since the board cannot reach a stylesheet inside the copy
- Capture with `frameboard capture --page <page> --composite --theme <theme> --out <scratch>`, in the theme the board is judged in, and copy that image to `evidence/<surface>/<nn>-options.png`
- Hide an earlier finding's frames with `frameboard frame hide` for that capture, and clear them with `--off`
- Draw `00-next` once the operator's picks settle, and copy both whole-page captures into `evidence/baseline/`

Repair a `font-missing` capture as `design-pick`'s Step 3 does, and answer a refusal `board.md` reads as it states. Any other refusal ends the board as Step 1 does, so redraw in the copy and take the options shot there. On `browser-not-found`, name `bunx playwright install chromium` as the repair.
