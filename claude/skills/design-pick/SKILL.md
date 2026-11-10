---
name: design-pick
description: Drafts several candidates for a decision judged by looking, lays them out side by side as frames on one Frameboard page, hands the operator the address, takes the pick through the structured question surface, and loops on the pick until they stop. Use when asked to "draft some options", "show me a few versions", "try a few variations", "mock up alternatives", "give me candidates for X", or when a choice is taste rather than correctness. Do NOT use when the request already names the answer and asks for it to be built, which is `plan-feature`. Do NOT use to read source for roughness, which is `ui-audit`, to measure what a running interface costs to paint, which is `ui-measure`, or to write what to look at on a change already made, which is `ui-checklist`.
metadata:
  family: decide
---

# Design pick

Some decisions are settled by looking rather than by reasoning, and no draft is wrong until one is picked. Every step here puts several candidates in front of the operator and keeps the real surface untouched until they have chosen.

The candidates live on the Frameboard board the project names, in a project of their own so rounds never mix with the operator's frames. Read `${CLAUDE_SKILL_DIR}/references/board.md` before the first `frameboard` verb, for how `<board>` and `<project>` resolve, the flags every verb carries, and how a selection resolves.

## Guards

- If the request names one answer and asks for it to be built, stop: `❌ This names one answer, so there is nothing to pick between. Use /canon:plan-feature.`
- If the decision has no visible form, stop: `❌ Nothing to look at. Drafting candidates needs a decision a render can show.`
- Draft no candidate for a decision the operator has not asked to make, since options everywhere spend their attention rather than saving it
- If neither `frameboard` nor `bunx` is on PATH, stop: `❌ Frameboard not found. Install frameboard or bun and re-run.`

## Step 1: name the decision and the arms

1. State the decision in one sentence, naming what changes between arms and what stays fixed.
2. Emit the design read in the run's output, in the form `design-taste` fixes, taking the layer from its ordered catalog. The arms differ at that layer, and a missing read is visible.
3. Derive a kebab slug from that sentence. The first round's page is `<slug>`, and Step 5 names later rounds `<slug>-2`, `<slug>-3`, and so on.
4. Write one arm per candidate, each carrying an id, a label, what the arm costs, and the reference it draws on. An arm with no stated cost is not an option.
5. Make the current state arm `0`, so the baseline is a candidate rather than an absence. A decision with nothing shipped yet says so and starts at arm `1`.
6. Stop at three to five arms. Two is a comparison the operator can hold in prose, and past five the pick stops being a look and becomes a sort.

Inside a live `plan-groundwork` track, renders land in the track's own `evidence/<slug>/renders/`, since a candidate render is evidence its decision file cites. Everywhere else they land in session scratch.

### Gather references before drafting

A round drafted with nothing real in front of it comes back generic, so gather references before Step 2 as `references/board.md` states.

- Name in each arm's reference field the frame it draws on and what it takes, or `none`
- Take structure alone, as the `design-references` skill draws that line, and never a product's text, accounts, logo, or numbers

## Step 2: draft the arms as frames on one page

Every arm of a round sits as one frame on one board page, side by side. The operator judges that page, never a set of separate images compared from memory.

1. Start the board the way `references/board.md` states, unless this run already has. Note whether this run started the server, read off `reused`, since Step 6 ends only a server this run started.
2. Read `frameboard list --root <board> --json` with no `--project`, so it lists every project. Run `frameboard project add <project> --root <board> --json` when it lists no `<project>`.
3. Add the round's page with `frameboard page add <page>` and record its `ref` on the run's list of pages. A `name-taken` refusal means the name is somebody else's, so take the next free suffix.
4. Add each arm once per round width with `frameboard frame add <page>/arm-<id>-<px>`, sized and placed as `references/board.md` lays out a round. Step 6's archive keys on those names.
5. Write each frame's whole document to the `path` the add verb reported. From a linked worktree, take the heredoc route `session-worktree` gives for a main-root write.

A frame renders at its own layout width on the board and in a capture alike, so a layout decision needs no device toolbar. Read `${CLAUDE_SKILL_DIR}/references/widths.md` before the first add, for the phone, tablet, and desktop widths the round draws and the form a tablet frame takes.

### What every frame carries

Each frame carries its own label and follows the board theme, so the set reads as one comparison.

- Label each arm inside its frame with its id, its cost, and its reference, since the composite capture draws no captions
- Theme every arm off the `data-theme` attribute the board sets on each frame's root, so the theme toggle sets the whole set at once. A set spanning both themes cannot be compared.
- Give no arm a script that stores a theme and reapplies it on load. It overwrites the toggle, and a fresh browser profile hides the fault.
- Write each frame's headings, labels, and captions by `${CLAUDE_SKILL_DIR}/../ui-craft/references/copy.md`, since a candidate's copy is often the first draft of the shipped page's

### Default path and live app

A running app under decision takes the live-app branch, and every other decision takes the default path.

- Live app: lift the rendered markup and link a copy of the built stylesheet rather than inlining, per `${CLAUDE_SKILL_DIR}/references/live-arms.md`
- Default path: inline every style, script, and asset. A frame resolves nothing outside its page folder and its project's `assets/`, so a build step or network font silently drops out.
- Default path: name a real font first in the stack, one the board serves, the machine has, or the frame embeds. A generic keyword such as `system-ui` resolves differently per machine.

The capture refuses a frame that would rewrap against a substitute font rather than ship a false comparison. A frame naming no font is refused on whatever the default resolves to.

### What varies

Vary one property across the arms, since a pick cannot say which of three differences decided it.

- Vary the property the decision is about. Holding composition fixed and varying color produces five skins of one design, and a palette cannot be picked ahead of the composition it serves.
- Grey-box the arms when the declared layer sits below typography, per `design-taste`, and say the set is grey-boxed when handing it over
- Do not grey-box a set judged at composition that carries a finished palette, since the operator looks at the higher layers instead of the question

## Step 3: render and hand off

Render the page and look at what came back before handing anything over:

```bash
frameboard capture --page <page> --composite --root <board> --project <project> --json
```

- Point `--out` at `evidence/<slug>/renders/` inside a live track, and leave the board's default elsewhere. Step 6 archives the picked round alone.
- Read each image's `path` off the record's `images`. The composite lands once per theme, so look at both.
- A `font-missing` refusal names the family it read. Set that text's `font-family` to a named family the board serves or the machine has, never a generic keyword, and capture again.

When the capture refuses with `browser-not-found`, report it and name `bunx playwright install chromium` as the repair. End the serve command if this run started it, then stop rather than describe an arm nobody has seen.

### Handing over

Hand over the address rather than a description. Emit the board link first on its own line, naming the page, then each PNG path on its own line.

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

- Read the selection when the answer points at the board, such as "the selected one", which `references/board.md` maps to a pick, a revert, a correction, or no answer
- Hold a pick while any of its frames scrolls sideways, measured before Step 6 as `${CLAUDE_SKILL_DIR}/references/widths.md` states, and carry it into Step 5 naming each width that failed

## Step 5: loop on the pick

1. Add each iteration as its own page, recorded on the run's list. An overwritten page cannot be reopened, and the losing round stops a correction re-proposing a rejected arm.
2. Write fresh arms off the pick and return to Step 2 where the correction opens a new question. Revise the one arm's frame where it does not.
3. Re-render, hand off again, and take the next answer.
4. Repeat until the operator says it is right. A run stopping because the arms stopped differing has stopped early.
5. Hold the real surface untouched across every iteration. Nothing outside the run's own board pages changes until the pick is final.

### Before the pick joins the page

A round never sees its neighbors, so run this before Step 6 item 1 where the pick joins a page of other sections. Elsewhere, as on a first section or a logo, say in one line that it was skipped.

- List each section's pickers, containers, and motion models beside the pick's against the `design-taste` locks, and judge a container by radius, theme, and the card kit tell
- Report the list and draw nothing when the pick brings no new style
- Else draw `arm-as-is` and `arm-restyled` on a new page on the run's list and ask as Step 4 does. That page is Step 6's picked round only if the restyle wins.

## Step 6: close

1. Apply the winning arm to the real surface, in one change.
2. Close out any document stating the decision as open, in the same change, naming the winner and the arms that stayed defensible. Skip this where nothing stated the decision.
3. Hand the winning arm's frame refs to `canon:design-record`, which lands them in the project's design record. Report it rather than proceeding silently when that skill does not resolve.
4. Capture the picked round's frames and the `references` page with `frameboard capture --page <page> --out <canon-dir>`, keeping the losing arms as a revert record. Report each image's `path`.
5. Resolve `<canon-dir>` as `.canon/` against the main worktree root, where shared session scratch resolves. Frameboard appends the project and page, so the archive lands at `.canon/<project>/<page>/`.
6. Delete every page on the run's list with `frameboard page delete <page>`, except a picked page on a named board. Touch no page the run did not add, and never remove a page folder by hand.
7. End the serve command if this run started it, since Frameboard carries no stop verb. Leave a server the operator started running.
8. Leave the renders in a live track's `evidence/<slug>/renders/`, since `plan-groundwork` treats evidence as durable.
9. Report each page or frame whose delete is refused, naming its `ref` and the `error.code`. The pick is applied either way.
10. Report every surface that changed, each on its own line, name the winning arm by its id and its cost, and report the archive path.

The picked round is the final one unless Step 4 resolved a revert. Archiving any other page lets item 6 delete the winning arm with nothing kept, and a variant left on the board is a second design nobody maintains.

### On a named board

A board `canon/config/design.toml` names is the one the project's design sync reads, and once `design-record` lands the pick, the sync's mapping points at the winning arm's frames. Deleting that page leaves a later redraw nothing to read.

- Keep the picked round's page and the winning arm's frames
- Delete each losing arm's frames with `frameboard frame delete <page>/arm-<id>-<px>`, after item 4's capture has archived them
- Delete every other page on the run's list as item 6 states

## What this delegates

Cite these rather than restating them. A step reimplemented here rots against the skill that owns it.

- `plan-feature` plans the work once the pick is made, and declares the pull request boundary that plan carries
- `design-record` lands the winning arm in the reference folder and its values in the design document, and runs before item 4's capture and item 6's deletes, which keep the picked page on named boards
- `references/widths.md` carries how to read a contrast, a column width, or a tap target off a frame, and `canon drive` runs the probes without gating
- `design-taste` carries the layer catalog, the ordering, grey-boxing, and the defaults an arm should reach past
- `write-human` carries the voice for any copy an arm puts in front of a reader

### Git, review, and the board

Commits, review, and the board mechanics each have an owner.

- `git-stage`, `git-pr`, and `git-followup` carry the commits and the pull request
- `review-pr` and `review-address` run the review pass
- `session-worktree` carries the main-root write route for a frame written from a linked worktree
- Frameboard carries the board itself, and `frameboard docs --json` prints its verbs, record shapes, content format, and refusals
