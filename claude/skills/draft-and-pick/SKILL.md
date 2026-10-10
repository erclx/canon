---
name: draft-and-pick
description: Drafts several candidates for a decision judged by looking, lays them out side by side as frames on one canvas page, hands the operator the address, takes the pick through the structured question surface, and loops on the pick until they stop. Use when asked to "draft some options", "show me a few versions", "try a few variations", "mock up alternatives", "give me candidates for X", or when a choice is taste rather than correctness. Do NOT use when the request already names the answer and asks for it to be built, which is `plan-feature`. Do NOT use to read source for roughness, which is `ux-audit`, to measure what a running interface costs to paint, which is `ux-measure`, to write what to look at on a change already made, which is `ui-checklist`, or to script a recording, which is `draft-screencast`.
metadata:
  family: decide
---

# Draft and pick

Some decisions are settled by looking rather than by reasoning, and no draft is wrong until one is picked. Every step here puts several candidates in front of the operator and keeps the real surface untouched until they have chosen.

The candidates live on the local design canvas, the surface `canon:canvas` drives. Every verb below is `canon canvas`, and `canon standards canvas` fixes the content format a frame takes. Read that standard before writing the first frame.

## Guards

- If the request names one answer and asks for it to be built, stop: `❌ This names one answer, so there is nothing to pick between. Use /canon:plan-feature.`
- If the decision has no visible form, stop: `❌ Nothing to look at. Drafting candidates needs a decision a render can show.`
- Draft no candidate for a decision the operator has not asked to make. A run offering options everywhere spends their attention rather than saving it.

## Step 1: name the decision and the arms

1. State the decision in one sentence, naming what changes between arms and what stays fixed.
2. Emit the design read in the run's own output, in the form `design-taste` fixes. The layer comes from that skill's ordered catalog rather than from a word invented here, and the arms differ at it rather than somewhere cheaper to change. A run emitting no read has not decided what it is drafting, and a missing line is visible where an unstated layer is not.
3. Derive a kebab slug from that sentence. The first round's canvas page takes `<slug>` as its name, and Step 5 names each later round `<slug>-2`, `<slug>-3`, and so on. Inside a live `plan-groundwork` track, the run's renders land in the track's own `evidence/<slug>/renders/`, since a candidate render is evidence the track's decision file cites rather than spike input. Everywhere else they land in session scratch.
4. Write one arm per candidate, each carrying an id, a label, and what the arm costs. An arm with no stated cost is not an option.
5. Make the current state arm `0`, so the baseline is a candidate rather than an absence. A decision with nothing shipped yet says so and starts at arm `1`.
6. Stop at three to five arms. Two is a comparison the operator can hold in prose, and past five the pick stops being a look and becomes a sort.

## Step 2: draft the arms as frames on one canvas page

Every arm of a round sits as one frame on one canvas page, side by side. The comparison the operator judges is that page, never a set of separate images handed over to compare from memory.

1. Start the canvas the way `canon:canvas` Step 1 states, unless this run already has: read `canon canvas list --json`, start `canon canvas serve --json` in the background unless the operator named an address that already answers, and fetch the `url` the record carries to check the shell's body holds a `<script` tag. Note whether this run started the server, since Step 6 stops only a server this run started. A refused serve or a blank shell stops the run, reported with its `reason`. A run with no canvas cannot draft, and no file stands in for one.
2. Add the round's page with `canon canvas page add <page> --json` and record its name on the run's own list of pages it added. A name `canvas list` already shows belongs to somebody else, so take the next free suffix rather than writing into it.
3. Add each arm as a frame with `canon canvas frame add <page> arm-<id> --width <px> --height <px> --json`. Name every frame `arm-<id>`, since Step 6's archive keeps those names and its readers key on them. Set the width the arm is judged at. A frame renders at its own layout width on the canvas and in a capture alike, so a decision about layout reads off the frame itself and needs no device toolbar.
4. Write each arm's whole document to the `path` the add verb reported. From a linked worktree, take the heredoc route `canon:canvas` Step 3 gives for a main-root write.
5. Lay the frames out in one row, in arm order, with `canon canvas frame move <page> arm-<id> --x <px> --y <px> --json`.

### What every frame carries

- Label each arm inside its frame with its id and its cost. The composite capture draws no captions, so the label is how the render carries what the question will ask about.
- Theme every arm off the `data-theme` attribute the canvas sets on each frame's root, so the canvas theme toggle sets the whole set at once. A set spanning both themes cannot be compared, since the operator has to hold one arm in memory while reading the next.
- Give no arm a script that stores a theme and reapplies it on load. That script overwrites the toggle, shows one frame in the other theme, and passes a fresh browser profile because the stored value is not there yet.
- Take the live-app branch instead when the surface under decision is a running app: lift the rendered markup and link a copy of the built stylesheet rather than inlining, per `${CLAUDE_SKILL_DIR}/references/live-arms.md`.
- On the default path, inline every style, script, and asset the frame needs. A frame resolves nothing outside its own page folder, so one reaching for a build step or a network font renders without it and the arms differ by something nobody chose.
- On the default path, name a real font first in the stack, one the machine has or the frame embeds, such as the project's own family from its design tokens. A generic keyword such as `system-ui` or `sans-serif` is refused, since it resolves to a different font on each machine. The capture refuses a frame that would rewrap against a substitute rather than shipping a false comparison, so a frame naming no font at all is refused on whatever the default resolves to.

### What varies

- Vary one property across the arms. A page whose arms differ in three ways answers no question, since the pick cannot say which difference decided it.
- Grey-box the arms when the declared layer sits below typography, per `design-taste`. A set judged at composition that carries a finished palette is not grey-boxed, and the higher layers are what the operator will look at instead of the question. Say the set is grey-boxed when handing it over.
- Vary the property the decision is about, which the rule above is satisfiable without. Holding composition fixed and varying color obeys it exactly and produces five skins of one design, because a set differing in the layer a reader notices least answers nothing. A palette is chosen to serve a composition, so it cannot be picked ahead of one.

## Step 3: render and hand off

Render the page and look at what came back before handing anything over:

```bash
canon canvas capture <page> --composite --json
```

- Point `--out` at `evidence/<slug>/renders/<page>.png` inside a live track, and leave it at its session-scratch default everywhere else. A pick taken from an image the track does not hold is a judgment nobody but this session can check, and the archive in Step 6 covers the final round alone.
- Read the PNG's `path` off the record. The composite shows every frame in its default theme, so look at the other theme on the live canvas where the arms carry two.
- `canon canvas capture` needs a browser binary the toolkit does not install. When it refuses for that reason, report the refusal and name `bunx playwright install chromium` as the repair, stop the canvas server if this run started it, then stop rather than describing an arm nobody has seen.
- A capture refusing on a font names the family it read off the frame's text. Take the repair `canon:canvas` Step 6 gives and capture again.
- Hand over the address rather than a description. Emit the canvas link first on its own line, naming the page, then the PNG path on its own line. A still answers how a thing looks and answers none of a hover response, a scroll-linked position, or a pace, which the live frame does.
- Never report a visual result you have not looked at. A claim about appearance with no render behind it is a guess.
- Look to judge rather than to confirm. Reading the image back to check it rendered satisfies the rule above and still hands over weak work, so name the weakest thing on the page in a sentence. Where that sentence would embarrass the work, fix it and hand over the second version. Say the remaining weakness out loud either way, so the operator is not hunting for what you already know.

## Step 4: take the pick

Put the choice to the operator through the structured question surface, since a call the operator's preference decides always routes through it rather than through prose.

- Emit the link in the response text ahead of the question call, and name it again in the question's own text, since some surfaces render the question card alone. A question that goes out with no address is one the operator cannot answer by looking.
- One option per arm, labeled with the arm's id and carrying its cost as the description.
- Rank the recommendation first and mark it `(Recommended)`.
- Author the real arms only. The surface appends its own escapes for a free-text answer and for reopening the question, so writing either as an option ships a duplicate the tool rejects.
- Take no pick on the operator's behalf when two arms are both defensible and the difference is taste. That call is theirs, and a silent one is the failure this skill exists to prevent.
- Read `canon canvas selection --json` when the answer points at the canvas rather than naming an arm, such as "the selected one". Resolve it against the record's `page` as well as its `frame`, since every round names its arms `arm-<id>` from the same ids. A selected frame on the current round's page is the pick. One on an earlier round's page picks that round's arm, which is a revert, so name the round back to the operator before acting on it. A fresh element inside a picked frame is a correction Step 5 carries by its `index`.
- Treat `selection: null`, a frame on a page this run did not add, or an element carrying `stale: true` as no answer, and ask again rather than guessing.

## Step 5: loop on the pick

1. Add each iteration as its own page, recorded on the run's list, rather than narrowing the previous page in place. A page overwritten is one a later pass cannot open, and the losing round is what stops a correction re-proposing something already rejected. The canvas page list reaches every round from one address.
2. Write fresh arms off the pick and return to Step 2 where the correction opens a new question. Revise the one arm's frame where it does not.
3. Re-render, hand off again, and take the next answer.
4. Repeat until the operator says it is right. The loop stops on their word and on nothing else, so a run stopping because the arms stopped differing has stopped early.
5. Hold the real surface untouched across every iteration. Nothing outside the run's own canvas pages changes until the pick is final.

## Step 6: close

1. Apply the winning arm to the real surface, in one change.
2. Close out whatever document stated the decision as open, in the same change, naming the arm that won and the ones that stayed defensible. A pick that changes a surface and records nothing about why leaves the next reader to re-derive it from a diff. Skip this where nothing stated the decision.
3. Capture the final round's frames into the archive with `canon canvas capture <page> --out <archive-dir> --json`. Each frame lands as `arm-<id>.png`, which keeps every arm past the pick, the losing ones included, as a durable revert record.
4. Resolve `<archive-dir>` as `.canon/picks/<slug>/` against the main worktree root, since shared session scratch resolves there rather than against a linked worktree this run happens to be building in.
5. Delete every page folder on the run's list from under the `content` folder `canon canvas list --json` reports, now that every arm sits at the durable path. Touch no page the run did not add, whatever its name. A variant left on the canvas is a second design nobody maintains.
6. Stop the canvas server if this run started it, and leave one the operator started running.
7. Leave the renders in place inside a live track's `evidence/<slug>/renders/`, since `plan-groundwork`'s write scope treats evidence as durable rather than as scratch a session may delete.
8. Report each page still standing when its delete is refused, naming the path for the operator to remove, rather than closing on a report the tree contradicts. The pick is applied either way, so the run has done its work and the page is what outlives it.
9. Report every surface that changed, each on its own line, name the arm that won by its id and its cost, and report the archive path.

## Reading a measurement

A capture proves appearance and a measurement proves a relationship, so reach for the second whenever the claim is about a number, such as a contrast ratio, a column width, or a tap target. `canon drive` runs the probes and ships the failure modes each one carries.

Three rules no probe reaches:

- Composite alpha before reading a color. A `color-mix` toward transparent resolves to channels plus an alpha, and reading those channels as opaque reports a color nobody sees.
- Sample inside the shape. A patch taken at the corner of a bounding box misses a round control and reads the page behind it, which is how a ground repair measured as no change at all.
- Ask whether a reader would see the thing, not only whether it has the right shape. A panel reported a healthy 1517 by 639 for as long as it sat 1868px above the viewport, and every check that read its size passed.

`canon drive` reports findings and never gates, by its own help text. Read its record as evidence handed to the operator rather than as a filter over the arms, since a run dropping an arm on a probe reading has made a claim the probe catalog has not earned.

## What this delegates

Cite these rather than restating them. A step reimplemented here rots against the skill that owns it.

- `plan-feature` plans the work once the pick is made, and declares the pull request boundary that plan carries
- `design-taste` carries the layer catalog, the ordering, grey-boxing, and the defaults an arm should reach past
- `write-human` carries the voice for any copy an arm puts in front of a reader
- `git-stage`, `git-pr`, and `git-followup` carry the commits and the pull request
- `review-pr` and `review-address` run the review pass
- `canon:canvas` carries the canvas start-and-check sequence, the main-root write route for a frame, and the selection and capture refusals
