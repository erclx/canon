---
name: ux-walkthrough
description: Runs an inspection walkthrough over a running app with the operator. Measures each finding off the built page, drafts arms as served HTML pages lifted from the app's own markup and stylesheet, hands over the localhost link before every pick question, records findings and picks with the arms they beat in one walkthrough file, and relays picks only in batches the operator calls. Use when asked to "run a first-use walkthrough", "do an operator walkthrough", "go through my findings one by one", "inspection walkthrough over the app", or "walk through everything I listed with me". Do NOT use for one decision on its own, which is `draft-and-pick`, to read source for roughness, which is `ux-audit`, or to build a pick, which is `plan-feature` and a worker.
---

# UX walkthrough

A walkthrough turns what the operator sees in a running app into findings and picks a builder can act on without the conversation. The render is the decision and the record carries the measurements, so every pick here is taken by looking and written down with the numbers behind it.

## Guards

- If no running build or build command exists to measure against, stop: `❌ Nothing to inspect. A walkthrough measures a running build.`
- If the session is asked to change a tracked file, stop and route it: `❌ A walkthrough records and does not build. Hand the pick to whoever dispatches the build.`
- Draft no arm for a finding the operator has not raised or agreed to take up.

## Posture

- Write only under `.canon/`, never a tracked file, and create no branch, commit or task row.
- Stay in the checkout the session started in. Enter no worktree for a walkthrough, since nothing it writes is tracked.
- Read the `walkthrough.md` of every earlier walkthrough under `.canon/walkthroughs/` first, and raise nothing they already decided.
- Name every folder a walkthrough writes with a two-digit prefix, per `${CLAUDE_SKILL_DIR}/references/record.md`, so the walkthrough and its rounds sort in the order they ran.
- Put builds, generator scripts and logs in a scratch folder outside the tracked tree, and anything the operator opens under `.canon/tmp/`.

## Steps

1. **Bring up both builds and record the conditions.** Follow `${CLAUDE_SKILL_DIR}/references/builds.md`. Start the walkthrough file with the commit, the ports and the build commands before the first finding.
2. **Take the operator's list in their order.** Name each item as a finding with the walkthrough letter and a number, such as T1, and confirm the order once rather than per item.
3. **Measure before drafting.** Read the component behind the finding and pull the numbers off the built page, per `${CLAUDE_SKILL_DIR}/references/measuring.md`. Write the finding into the walkthrough file with those numbers before any arm exists.
4. **Route a finding with no visible choice.** A parse defect, a stale figure or a broken invariant gets recorded as a finding with no draft and goes into the batch as a proposed row, not as a pick.
5. **Draft three or four arms.** Follow `draft-and-pick` Steps 1 and 2 for the arms, with arm 0 the shipped state, one property varied and a cost on each. Build the page from the app's own rendered markup, per `${CLAUDE_SKILL_DIR}/references/candidate-pages.md`.
6. **Look before handing anything over.** Capture every arm in every theme the app ships into `.canon/walkthroughs/<nn>-<slug>/evidence/<nn>-<slug>/`, with the finding's number as the prefix, open the captures, and fix what rendered wrong before the operator sees the page.
7. **Hand the link, then ask.** Emit `http://localhost:<port>/<nn>-<slug>/candidates.html` in a message that ends the turn, confirmed with a `200`, carrying no question. Take any reply after that message as the operator having looked, an explicit "go" included, rather than holding for a stated confirmation, and only then put the choice through the structured question surface with the recommendation first.
8. **Record the pick.** Write what won, what it beat and by which numbers, where the evidence is, and the build criteria, per `${CLAUDE_SKILL_DIR}/references/record.md`. Read every figure you quote back from the page or the data file first, and correct the record where the question quoted one wrong.
9. **Hold picks for the batch.** Relay nothing per pick. When the operator calls the batch, send it once per `${CLAUDE_SKILL_DIR}/references/relay.md`.
10. **Close on the operator's word.** Add the walkthrough summary table and the handoff, leave the evidence in place, and report every file written by its path.

## Rules

- Answer a question the operator asks mid-walkthrough in prose first, with a recommendation, and offer a draft rather than drafting unasked.
- Say when a pick revises an earlier walkthrough's pick, and record it as a revision naming the pick it revises.
- Check a claim against the code or the data before an arm makes it, since an arm drawn on a wrong fact is a pick on nothing.
- Measure both halves of a pick whose condition has two, such as a gap and what shows above it.
- Keep a finding's measured numbers and the pick's build criteria in the record, never only in chat.

## What this delegates

- `draft-and-pick` owns the arm discipline and the structured question. This walkthrough departs from its Step 2 inlining and its Step 6 apply and delete, for the reasons `${CLAUDE_SKILL_DIR}/references/candidate-pages.md` states.
- `write-human` carries the voice of every recorded passage and any copy an arm puts in front of a reader.
- `plan-feature` and whoever dispatches builds turn a batch into plans and code.
- `canon capture`, `canon serve` and `canon sessions list` own the render, the address and the roster.
