---
name: design-pick
description: Drafts several candidates for a decision judged by looking, lays them side by side on one Frameboard page, and takes the operator's pick through the structured question surface, looping until they stop. Use when asked to "draft some options", "show me a few versions", or "mock up alternatives", or when a choice is taste. Do NOT use when the request names the answer, which is `plan-change`.
metadata:
  family: decide
---

# Design pick

Some decisions are settled by looking rather than by reasoning, and no draft is wrong until one is picked. Every step here puts several candidates in front of the operator and keeps the real surface untouched until they have chosen.

The candidates live on the Frameboard board at the main root, in the project the pick's origin gives it, and stay there after the pick. Read `${CLAUDE_SKILL_DIR}/references/board.md` before the first `frameboard` verb, for how `<board>` and `<project>` resolve, the flags every verb carries, and how a selection resolves.

## Guards

- If the request names one answer and asks for it to be built, stop: `❌ This names one answer, so there is nothing to pick between. Use /canon:plan-change.`
- If the ask is to try a built app and find what is wrong, stop: `❌ Nothing to pick between yet. Use /canon:app-drive.`
- If the decision has no visible form, stop: `❌ Nothing to look at. Drafting candidates needs a decision a render can show.`
- Draft no candidate for a decision the operator has not asked to make, since options everywhere spend their attention rather than saving it
- If neither `frameboard` nor `bunx` is on PATH, stop: `❌ Frameboard not found. Install frameboard or bun and re-run.`

## Step 1: name the decision and the arms

Read `${CLAUDE_SKILL_DIR}/references/from-finding.md` first when the ask names a drive finding or an intake item, for where that pick draws and what it writes back.

1. State the decision in one sentence, naming what changes between arms and what stays fixed.
2. Emit the design read in the run's output, in the form `design-taste` fixes, taking the layer from its ordered catalog. The arms differ at that layer, and a missing read is visible.
3. Derive a kebab slug from that sentence. A standalone pick's first round is page `<slug>`, and Step 5 names later rounds `<slug>-2`, `<slug>-3`, and so on.
4. Gather references before writing any arm, as `### Gather references before drafting` below states.
5. Write one arm per candidate, each carrying an id, a label, what the arm costs, and the reference it draws on. An arm with no stated cost is not an option.
6. Make the current state arm `0`, so the baseline is a candidate rather than an absence. A decision with nothing shipped yet says so and starts at arm `1`.
7. Stop at three to five arms, plus a contrast arm. Two is a comparison the operator holds in prose, and past five the pick becomes a sort.

Inside a live `plan-groundwork` track, renders land in the track's own `evidence/<slug>/renders/`, since a candidate render is evidence its decision file cites. Everywhere else they land in session scratch.

### Gather references before drafting

A round drafted with nothing real in front of it comes back generic, so gather references before Step 2 as `references/board.md` states.

- Name in each arm's reference field the frame it draws on and what it takes, or `none`
- Take structure alone, as the `design-gather` skill draws that line, and never a product's text, accounts, logo, or numbers
- Ask once for taste words before a look round, per `references/taste.md`

## Step 2: draft the arms as frames on one page

Every arm of a round sits as one group of frames on one board page, the groups side by side. The operator judges that page, never a set of separate images compared from memory.

1. Start the board the way `references/board.md` states, unless this run already has. Note whether this run started the server, read off `reused`, since Step 6 ends only a server this run started.
2. Resolve `<project>` per `references/project-name.md`. Run `frameboard list --root <board> --json` with no `--project`, and `frameboard project add <project> --root <board> --json` if absent.
3. Add the round's page with `frameboard page add <page>` and record its `ref` on the run's list of pages. A `name-taken` refusal means the name is somebody else's, so take the next free suffix.
4. Add each arm at each round width as `frameboard frame add <page>/arm-<id>-<px> --device on --scroll`, laid out per `${CLAUDE_SKILL_DIR}/references/drawing.md`. Step 4's selection reads the names.
5. Write each frame's whole document to the `path` the add verb reported. From a linked worktree, take the heredoc route `session-worktree` gives for a main-root write.

A pick on a drive finding or an intake item joins that finding's or item's page instead, each round a row on it, with the page and frame names `references/drawing.md` gives in place of items 3 and 4's.

A frame renders at its own layout width on the board and in a capture alike, so a layout decision needs no device toolbar. Read `${CLAUDE_SKILL_DIR}/references/widths.md` before the first add, for the phone, tablet, and desktop widths the round draws, the 320 check, and the form a tablet frame takes.

### What every frame carries

Each frame carries its own label and follows the board theme, so the set reads as one comparison.

- Label each arm inside its frame with its id, its cost, and its reference, since the composite capture draws no captions
- Theme every arm off the `data-theme` attribute the board sets on each frame's root, so the theme toggle sets the whole set at once. A set spanning both themes cannot be compared.
- Give no arm a script that stores a theme and reapplies it on load. It overwrites the toggle, and a fresh browser profile hides the fault.
- Write each frame's headings, labels, and captions by `${CLAUDE_SKILL_DIR}/../ui-craft/references/copy.md`, since a candidate's copy is often the first draft of the shipped page's
- Write a page frame's headline, supporting line, and section copy by `${CLAUDE_SKILL_DIR}/../ui-craft/references/page-copy.md` as well

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
- Add a contrast arm at composition, per `${CLAUDE_SKILL_DIR}/references/contrast-arm.md`

## Step 3: render and hand off

Render the page and look at what came back before handing anything over:

```bash
frameboard capture --page <page> --composite --root <board> --project <project> --json
```

- Point `--out` at `evidence/<slug>/renders/` inside a live track, and leave the board's default elsewhere
- Read each image's `path` off the record's `images`. The composite lands once per theme, so look at both.
- A `font-missing` refusal names the family it read. Set that text's `font-family` to a named family the board serves or the machine has, never a generic keyword, and capture again.

When the capture refuses with `browser-not-found`, report it and name `bunx playwright install chromium` as the repair. End the serve command if this run started it, then stop rather than describe an arm nobody has seen.

### Handing over

Hand over the address rather than a description. Emit the board link first on its own line, naming the page, then each PNG path on its own line.

- A still answers how a thing looks and none of a hover, a scroll-linked position, or a pace, which the live frame does
- Never report a visual result you have not looked at, since a claim about appearance with no render behind it is a guess
- Look to judge rather than to confirm. Name the weakest thing on the page in a sentence, fix it where that sentence would embarrass the work, and say what remains.

## Step 4: take the pick

Put the choice to the operator through the structured question surface, since a call the operator's preference decides always routes through it rather than through prose. Ask one round per question, behind `frameboard show` on its frames, as `${CLAUDE_SKILL_DIR}/references/drawing.md` states under Asking.

- Emit the link ahead of the question call and again in the question's text, since some surfaces render the card alone
- One option per arm, labeled by its id, with its cost as the description
- Rank the recommendation first and mark it `(Recommended)`
- Author the real arms only. The surface appends its own free-text and reopen escapes, and a duplicate is rejected.

### Taking the answer

Take no pick on the operator's behalf when two arms are both defensible and the difference is taste. That call is theirs, and a silent one is the failure this skill exists to prevent.

- Read the selection when the answer points at the board, such as "the selected one", which `references/board.md` maps to a pick, a revert, a correction, or no answer
- Hold a pick while any of its frames scrolls sideways, measured before Step 6 as `${CLAUDE_SKILL_DIR}/references/widths.md` states, and carry it into Step 5 naming each width that failed

## Step 5: loop on the pick

1. Add each iteration as its own page on the run's list, or as a row on a joined page. An overwritten page cannot be reopened, and the losing round stops a correction re-proposing a rejected arm.
2. Write fresh arms off the pick and return to Step 2 where the correction opens a new question. Revise the one arm's frame where it does not.
3. Re-render, hand off again, and take the next answer.
4. Repeat until the operator says it is right. A run stopping because the arms stopped differing has stopped early.
5. Hold the real surface untouched across every iteration. Nothing outside the run's own board pages changes until the pick is final.

### Before the pick joins the page

A round never sees its neighbors, so run this before Step 6 item 1 where the pick joins a page of other sections. Elsewhere, as on a first section or a logo, say in one line that it was skipped.

- List each section's pickers, containers, and motion models beside the pick's against the `design-taste` locks, and judge a container by radius, theme, and the card kit tell
- Report the list and draw nothing when the pick brings no new style
- Else draw `arm-as-is` and `arm-restyled` on a new page on the run's list and ask as Step 4 does. That page is Step 6's picked round only if the restyle wins.

### A clickable prototype

Offer one prototype once the pick settles on an app or product surface with more than one screen, and read `${CLAUDE_SKILL_DIR}/references/prototype.md` before building it. Skip it for a section, a logo, or a palette, which hold no flow to click.

## Step 6: close

1. Apply the winning arm to the real surface, in one change.
2. Close out any document stating the decision as open, in the same change, naming the winner and the arms that stayed defensible. Skip this where nothing stated the decision.
3. Hand the winning arm's frame refs to `canon:design-record`, which lands them in the project's design record. Report it rather than proceeding silently when that skill does not resolve.
4. Draw a standalone pick's `00-next` as `references/drawing.md` states. A pick from a finding or an item writes back per `references/from-finding.md` instead, and a track's pick does neither.
5. Keep every page on the board, the losing rounds among them, since they are the revert record and no copy is made. Delete no page that holds a frame.
6. End the serve command if this run started it, since Frameboard carries no stop verb. Leave a server the operator started running.
7. Leave renders in a live track's `evidence/<slug>/renders/`, which `plan-groundwork` keeps. Under `role-planner`, offer a record per `references/record.md`.
8. Report every surface that changed, each on its own line, name the winning arm by its id and its cost, and report the picked page's ref and `00-next`'s.

The picked round is the final one unless Step 4 resolved a revert, so `00-next` takes its arm from that page.

The prototype page stays on the board, since later changes land on it first.

## What this delegates

Cite these rather than restating them. A step reimplemented here rots against the skill that owns it.

- `plan-change` plans the work once the pick is made, and declares the pull request boundary that plan carries
- `design-record` lands the winning arm in the reference folder and its values in the design document from the picked page, which the close keeps
- `references/widths.md` carries how to read a contrast, a column width, or a tap target off a frame, and `canon drive` runs the probes without gating
- `design-taste` carries the layer catalog, the ordering, grey-boxing, and the defaults an arm should reach past
- `write-human` carries the voice for any copy an arm puts in front of a reader

### Git, review, and the board

Commits, review, and the board mechanics each have an owner.

- `git-stage`, `git-pr`, and `git-followup` carry commits and the pull request
- `review-pr` and `review-address` run the review pass
- `session-worktree` carries the main-root write route for a frame written from a linked worktree
- Frameboard carries the board itself, and `frameboard docs --json` prints its verbs, record shapes, content format, and refusals
