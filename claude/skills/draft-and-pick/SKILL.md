---
name: draft-and-pick
description: Drafts several candidates for a decision judged by looking, renders them side by side on one page, hands the operator the addresses, takes the pick through the structured question surface, and loops on the pick until they stop. Use when asked to "draft some options", "show me a few versions", "try a few variations", "mock up alternatives", "give me candidates for X", or when a choice is taste rather than correctness. Do NOT use when the request already names the answer and asks for it to be built, which is `plan-feature`. Do NOT use to read source for roughness, which is `ux-audit`, to measure what a running interface costs to paint, which is `ux-measure`, to write tests for a change already made, which is `ui-test`, to script a recording, which is `draft-screencast`, or to inspect a running app across many findings, which is `ux-walkthrough`.
---

# Draft and pick

Some decisions are settled by looking rather than by reasoning, and no draft is wrong until one is picked. Every step here puts several candidates in front of the operator and keeps the real surface untouched until they have chosen.

## Guards

- If the request names one answer and asks for it to be built, stop: `❌ This names one answer, so there is nothing to pick between. Use /canon:plan-feature.`
- If the decision has no visible form, stop: `❌ Nothing to look at. Drafting candidates needs a decision a render can show.`
- Draft no candidate for a decision the operator has not asked to make. A run offering options everywhere spends their attention rather than saving it.

## Step 1: name the decision and the arms

1. State the decision in one sentence, naming what changes between arms and what stays fixed. Name the layer that sentence puts the decision at, and check that the arms will differ there rather than somewhere cheaper to change.
2. Derive a kebab slug from that sentence. Call the folder every file this run writes to `<dest>` below. `<dest>` is `.canon/tmp/<slug>/`, a nested `<slug>/` folder rather than a flat `<slug>-<file>.md`, which is the shape every temporary write in this project takes. Running inside a live `plan-groundwork` track is the one exception: `<dest>` is the track's own `evidence/<slug>/` instead, since a candidate render is evidence the track's decision file cites rather than spike input.
3. Write one arm per candidate, each carrying an id, a label, and what the arm costs. An arm with no stated cost is not an option.
4. Make the current state arm `0`, so the baseline is a candidate rather than an absence. A decision with nothing shipped yet says so and starts at arm `1`.
5. Stop at three to five arms. Two is a comparison the operator can hold in prose, and past five the pick stops being a look and becomes a sort.

## Step 2: author the candidate set as one page

Write every arm side by side on one self-contained HTML page at `<dest>/candidates.html`, and write each arm again as its own self-contained whole-page file at `<dest>/arms/arm-<id>.html`. Clear `<dest>/arms/` first on every pass through this step, including from Step 5's loop, so a file left behind by a wider earlier round never survives into a narrower one.

- One page for the pick, never a set of separate images handed to the operator to compare from memory. The comparison they judge is `candidates.html`, which Step 3 renders and Step 4 asks about. The per-arm files exist only for Step 6's archival capture, once the pick is made, and only the last pass through this step is what Step 6 finds there.
- Wrap each arm's markup in the same class on both files, chosen once per run and reused everywhere, so one selector addresses an arm on the combined page and on its own standalone file alike.
- Label each arm on the page with its id and its cost, so the render carries what the question will ask about.
- Give the combined page one control that sets every arm's theme at once, beside whatever per-arm control the arms carry. A set spanning both themes cannot be compared, since the operator has to toggle each arm and hold the earlier ones in memory, which is the failure the single-page rule exists to prevent.
- Take the live-app branch instead when the surface under decision is a running app: lift the rendered markup and link a copy of the built stylesheet rather than inlining, per `${CLAUDE_SKILL_DIR}/references/live-arms.md`.
- On the default path, inline every style, script, and asset the page needs. The render reads the file off disk, so a page reaching for a build step or a network font renders without it and the arms differ by something nobody chose.
- On the default path, declare a font stack the machine resolves, such as `system-ui` behind a generic fallback. The render refuses a page that would rewrap against a substitute rather than shipping a false comparison, so a page naming no font at all is refused on whatever the default resolves to.
- Vary one property across the arms. A page whose arms differ in three ways answers no question, since the pick cannot say which difference decided it.
- Vary the property the decision is about, which the rule above is satisfiable without. Holding composition fixed and varying color obeys it exactly and produces five skins of one design, because a set differing in the layer a reader notices least answers nothing. A palette is chosen to serve a composition, so it cannot be picked ahead of one.

## Step 3: render and hand off

Render the page, then look at what came back:

```bash
canon capture <dest>/candidates.html --selector <element>
```

- `--selector` has no default and the command refuses without it. Name the element wrapping the arms rather than `body`, which crops to whatever the page's own margins leave.
- `canon capture` and `canon drive` both need a browser binary the toolkit does not install. When either refuses for that reason, report the refusal and name `bunx playwright install chromium` as the repair, then stop rather than describing an arm nobody has seen.
- Serve the page instead of capturing it when the operator has to drive the decision, such as a hover response, a scroll-linked position, or a pace. Start `canon serve <dest> --entry candidates.html` in the background and read the link off its record, since the printed link opens `index.html` without that flag and `<dest>` holds no such file. A still answers how a thing looks and answers none of those.
- Write the render inside the record that cites it wherever one exists, by pointing `--out` at `<dest>/renders/` rather than at a session scratch path. A pick taken from an image the record does not hold is a judgment nobody but this session can check, and the archival capture in Step 6 covers the final round alone.
- Hand over the address rather than a description. Emit the PNG path on its own line, and the link beside it where the page is served.
- Never report a visual result you have not looked at. A claim about appearance with no render behind it is a guess.
- Look to judge rather than to confirm. Reading the image back to check it rendered satisfies the rule above and still hands over weak work, so name the weakest thing on the page in a sentence. Where that sentence would embarrass the work, fix it and hand over the second version. Say the remaining weakness out loud either way, so the operator is not hunting for what you already know.

## Step 4: take the pick

Put the choice to the operator through the structured question surface, since a call the operator's preference decides always routes through it rather than through prose.

- One option per arm, labeled with the arm's id and carrying its cost as the description.
- Rank the recommendation first and mark it `(Recommended)`.
- Author the real arms only. The surface appends its own escapes for a free-text answer and for reopening the question, so writing either as an option ships a duplicate the tool rejects.
- Take no pick on the operator's behalf when two arms are both defensible and the difference is taste. That call is theirs, and a silent one is the failure this skill exists to prevent.

## Step 5: loop on the pick

1. Write each iteration to its own `<dest>` rather than narrowing the previous one in place, suffixing the slug so the folders sort. An iteration overwritten is one a later pass cannot open, and the losing round is what stops a correction re-proposing something already rejected.
2. Write fresh arms off the pick and return to Step 2 where the correction opens a new question. Revise the one arm where it does not.
3. Re-render, hand off again, and take the next answer.
4. Repeat until the operator says it is right. The loop stops on their word and on nothing else, so a run stopping because the arms stopped differing has stopped early.
5. Hold the real surface untouched across every iteration. Nothing outside the run's own folders changes until the pick is final.

## Step 6: close

1. Apply the winning arm to the real surface, in one change.
2. Close out whatever document stated the decision as open, in the same change, naming the arm that won and the ones that stayed defensible. A pick that changes a surface and records nothing about why leaves the next reader to re-derive it from a diff. Skip this where nothing stated the decision.
3. Batch-capture the final round's arm files, when `<dest>` is the scratch path: `canon capture <dest>/arms --selector <wrapper-class> --out <archive-dir>`, naming Step 2's chosen class. This is the directory-batch convention `draft-identity` Step 6 already uses.
4. Resolve `<archive-dir>` as `.canon/picks/<slug>/` against the main worktree root, since shared session scratch resolves there rather than against a linked worktree this run happens to be building in. The capture is what keeps every arm past the pick, the losing ones included, as a durable revert record distinct from the live comparison page.
5. Delete `<dest>` and every file inside it, when `<dest>` is the scratch path, now that every arm sits at the durable path above. A variant left behind there is a second design nobody maintains.
6. Leave `<dest>` in place when it is a live track's `evidence/<slug>/`: `plan-groundwork`'s write scope treats evidence as durable rather than as scratch a session may delete, and the arms already sit at a durable path there.
7. Report `<dest>` as still standing when the scratch-path delete is refused, naming the path for the operator to remove, rather than closing on a report the tree contradicts. The pick is applied either way, so the run has done its work and the folder is what outlives it.
8. Report every surface that changed, each on its own line, name the arm that won by its id and its cost, and report the archival path from Step 3 where it ran.

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
- `write-human` carries the voice for any copy an arm puts in front of a reader
- `git-stage`, `git-pr`, and `git-followup` carry the commits and the pull request
- `review-branch` and `review-address` run the review pass
