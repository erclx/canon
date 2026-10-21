---
name: pick-by-eye
description: Drafts several candidates for a decision judged by looking, lays them out side by side as frames on one canvas page, hands the operator the address, takes the pick through the structured question surface, and loops on the pick until they stop. Use when asked to "draft some options", "show me a few versions", "try a few variations", "mock up alternatives", "give me candidates for X", or when a choice is taste rather than correctness. Do NOT use when the request already names the answer and asks for it to be built, which is `plan-feature`. Do NOT use to read source for roughness, which is `ux-audit`, to measure what a running interface costs to paint, which is `ux-measure`, or to write what to look at on a change already made, which is `ui-checklist`.
metadata:
  family: decide
---

# Pick by eye

Some decisions are settled by looking rather than by reasoning, and no draft is wrong until one is picked. Every step here puts several candidates in front of the operator and keeps the real surface untouched until they have chosen.

The candidates live on the local design canvas, the surface `canon:canvas-board` drives. Every verb below is `canon canvas`, and `${CLAUDE_SKILL_DIR}/../canvas-board/references/canvas.md` fixes the content format a frame takes. Read that reference before writing the first frame.

## Guards

- If the request names one answer and asks for it to be built, stop: `❌ This names one answer, so there is nothing to pick between. Use /canon:plan-feature.`
- If the decision has no visible form, stop: `❌ Nothing to look at. Drafting candidates needs a decision a render can show.`
- Draft no candidate for a decision the operator has not asked to make, since options everywhere spend their attention rather than saving it

## Step 1: name the decision and the arms

1. State the decision in one sentence, naming what changes between arms and what stays fixed.
2. Emit the design read in the run's output, in the form `design-taste` fixes, taking the layer from its ordered catalog. The arms differ at that layer, and a missing read is visible.
3. Derive a kebab slug from that sentence. The first round's page is `<slug>`, and Step 5 names later rounds `<slug>-2`, `<slug>-3`, and so on.
4. Write one arm per candidate, each carrying an id, a label, and what the arm costs. An arm with no stated cost is not an option.
5. Make the current state arm `0`, so the baseline is a candidate rather than an absence. A decision with nothing shipped yet says so and starts at arm `1`.
6. Stop at three to five arms. Two is a comparison the operator can hold in prose, and past five the pick stops being a look and becomes a sort.

Inside a live `plan-groundwork` track, renders land in the track's own `evidence/<slug>/renders/`, since a candidate render is evidence its decision file cites. Everywhere else they land in session scratch.

## Step 2: draft the arms as frames on one canvas page

Every arm of a round sits as one frame on one canvas page, side by side. The operator judges that page, never a set of separate images compared from memory.

1. Start the canvas the way `canon:canvas-board` Step 1 states, unless this run already has. Note whether this run started the server, since Step 6 stops only a server this run started.
2. Add the round's page with `canon canvas page add <page> --json` and record it on the run's list of pages. A name `canvas list` already shows is somebody else's, so take the next free suffix.
3. Add each arm with `canon canvas frame add <page> arm-<id> --width <px> --height <px> --json`. Step 6's archive keys on the `arm-<id>` names.
4. Write each arm's whole document to the `path` the add verb reported. From a linked worktree, take the heredoc route `canon:canvas-board` Step 3 gives for a main-root write.
5. Lay the frames out in one row, in arm order, with `canon canvas frame move <page> arm-<id> --x <px> --y <px> --json`.

The `canvas-board` start reads `canon canvas list --json`, serves with `canon canvas serve --json` in the background unless the operator named an address that answers, and checks the shell's body holds a `<script` tag. A refused serve or a blank shell stops the run with its `reason`, and no file stands in for a canvas.

Set each frame's width to the one the arm is judged at. A frame renders at its own layout width on the canvas and in a capture alike, so a layout decision needs no device toolbar.

### What every frame carries

Each frame carries its own label and follows the canvas theme, so the set reads as one comparison.

- Label each arm inside its frame with its id and its cost, since the composite capture draws no captions
- Theme every arm off the `data-theme` attribute the canvas sets on each frame's root, so the theme toggle sets the whole set at once. A set spanning both themes cannot be compared.
- Give no arm a script that stores a theme and reapplies it on load. It overwrites the toggle, and a fresh browser profile hides the fault.

### Default path and live app

A running app under decision takes the live-app branch, and every other decision takes the default path.

- Live app: lift the rendered markup and link a copy of the built stylesheet rather than inlining, per `${CLAUDE_SKILL_DIR}/references/live-arms.md`
- Default path: inline every style, script, and asset. A frame resolves nothing outside its own page folder, so a build step or network font silently drops out.
- Default path: name a real font first in the stack, one the machine has or the frame embeds, such as the project's own family. A generic keyword such as `system-ui` resolves differently per machine.

The capture refuses a frame that would rewrap against a substitute font rather than ship a false comparison. A frame naming no font is refused on whatever the default resolves to.

### What varies

Vary one property across the arms, since a pick cannot say which of three differences decided it.

- Vary the property the decision is about. Holding composition fixed and varying color produces five skins of one design, and a palette cannot be picked ahead of the composition it serves.
- Grey-box the arms when the declared layer sits below typography, per `design-taste`, and say the set is grey-boxed when handing it over
- Do not grey-box a set judged at composition that carries a finished palette, since the operator looks at the higher layers instead of the question

## Step 3: render and hand off

Render the page and look at what came back before handing anything over:

```bash
canon canvas capture <page> --composite --json
```

- Point `--out` at `evidence/<slug>/renders/<page>.png` inside a live track, and leave the scratch default elsewhere. Step 6 archives the picked round alone.
- Read the PNG's `path` off the record. The composite shows each frame in its default theme, so check the other theme on the live canvas.
- A capture refusing on a font names the family it read. Take the repair `canon:canvas-board` Step 6 gives and capture again.

When `canon canvas capture` refuses for a missing browser binary, report it and name `bunx playwright install chromium` as the repair. Stop the canvas server if this run started it, then stop rather than describe an arm nobody has seen.

### Handing over

Hand over the address rather than a description. Emit the canvas link first on its own line, naming the page, then the PNG path on its own line.

- A still answers how a thing looks and none of a hover, a scroll-linked position, or a pace, which the live frame does
- Never report a visual result you have not looked at, since a claim about appearance with no render behind it is a guess
- Look to judge rather than to confirm. Name the weakest thing on the page in a sentence, fix it where that sentence would embarrass the work, and say what remains.

## Step 4: take the pick

Put the choice to the operator through the structured question surface, since a call the operator's preference decides always routes through it rather than through prose.

- Emit the link ahead of the question call and again in the question's text, since some surfaces render the card alone
- One option per arm, labeled with the arm's id and carrying its cost as the description
- Rank the recommendation first and mark it `(Recommended)`
- Author the real arms only. The surface appends its own free-text and reopen escapes, and a duplicate is rejected.

### Taking the answer

Take no pick on the operator's behalf when two arms are both defensible and the difference is taste. That call is theirs, and a silent one is the failure this skill exists to prevent.

Read `canon canvas selection --json` when the answer points at the canvas, such as "the selected one". Resolve it against the record's `page` as well as its `frame`, since every round reuses the `arm-<id>` names.

| Selection                                                        | Reading                                        |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| A frame on the current round's page                              | The pick                                       |
| A frame on an earlier round's page                               | A revert, so name the round back before acting |
| A fresh element inside a picked frame                            | A correction Step 5 carries by its `index`     |
| `selection: null`, a page this run did not add, or `stale: true` | No answer, so ask again rather than guess      |

## Step 5: loop on the pick

1. Add each iteration as its own page, recorded on the run's list. An overwritten page cannot be reopened, and the losing round stops a correction re-proposing a rejected arm.
2. Write fresh arms off the pick and return to Step 2 where the correction opens a new question. Revise the one arm's frame where it does not.
3. Re-render, hand off again, and take the next answer.
4. Repeat until the operator says it is right. A run stopping because the arms stopped differing has stopped early.
5. Hold the real surface untouched across every iteration. Nothing outside the run's own canvas pages changes until the pick is final.

## Step 6: close

1. Apply the winning arm to the real surface, in one change.
2. Close out any document stating the decision as open, in the same change, naming the winner and the arms that stayed defensible. Skip this where nothing stated the decision.
3. Hand the winning frame to `canon:design-record` by its page and frame, which lands it in the project's design record. Report it rather than proceeding silently when that skill does not resolve.
4. Capture the picked round's frames with `canon canvas capture <page> --out <archive-dir> --json`. Each lands as `arm-<id>.png`, keeping the losing arms as a revert record.
5. Resolve `<archive-dir>` as `.canon/picks/<slug>/` against the main worktree root, since shared session scratch resolves there rather than in a linked worktree.
6. Delete every page folder on the run's list from under the `content` folder `canon canvas list --json` reports. Touch no page the run did not add, whatever its name.
7. Stop the canvas server if this run started it, and leave one the operator started running.
8. Leave the renders in a live track's `evidence/<slug>/renders/`, since `plan-groundwork` treats evidence as durable.
9. Report each page whose delete is refused, naming the path for the operator to remove. The pick is applied either way.
10. Report every surface that changed, each on its own line, name the winning arm by its id and its cost, and report the archive path.

The picked round is the final one unless Step 4 resolved a revert. Archiving any other page lets item 6 delete the winning arm with nothing kept, and a variant left on the canvas is a second design nobody maintains.

## Reading a measurement

A capture proves appearance and a measurement proves a relationship, so reach for the second whenever the claim is a number, such as a contrast ratio, a column width, or a tap target. `canon drive` runs the probes and ships the failure modes each one carries.

- Composite alpha before reading a color. A `color-mix` toward transparent resolves to channels plus an alpha, and reading them as opaque reports a color nobody sees.
- Sample inside the shape. A patch at a bounding box corner misses a round control and reads the page behind it.
- Ask whether a reader would see the thing. A panel sized a healthy 1517 by 639 passed every size check while sitting 1868px above the viewport.

`canon drive` reports findings and never gates. Read its record as evidence for the operator rather than as a filter over the arms, since the probe catalog has not earned the right to drop one.

## What this delegates

Cite these rather than restating them. A step reimplemented here rots against the skill that owns it.

- `plan-feature` plans the work once the pick is made, and declares the pull request boundary that plan carries
- `design-record` lands the winning frame in the reference folder and its values in the design document, and runs before item 6 deletes the page its sync reads
- `design-taste` carries the layer catalog, the ordering, grey-boxing, and the defaults an arm should reach past
- `write-human` carries the voice for any copy an arm puts in front of a reader

### Git and review

Commits, review, and the canvas mechanics each have an owner.

- `git-stage`, `git-pr`, and `git-followup` carry the commits and the pull request
- `review-pr` and `review-address` run the review pass
- `canon:canvas-board` carries the canvas start-and-check sequence, the main-root write route for a frame, and the selection and capture refusals
