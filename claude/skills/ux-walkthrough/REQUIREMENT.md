---
name: ux-walkthrough
description: Why a multi-finding inspection walkthrough with the operator needs its own surface beside draft-and-pick, and where the boundary against building and auditing falls
---

# UX walkthrough requirement

## Gap

Without this skill, a session running an inspection walkthrough with the operator:

- Files every round's evidence into one flat shared folder, so nothing shows which walkthrough a folder came from or in what order the rounds ran.
- Hands over screenshots or file paths the operator cannot open, where a served localhost page is the one form that reaches them.
- Asks the pick question before the operator has the page, so the answer is taken from a description.
- Sends the link inside the same message as the question, where the structured question surface draws over it and the operator never sees the link.
- Draws arms as hand-written mock-ups of the app, which drift a few pixels and a few words from what ships, rather than lifting the built page's own markup and stylesheet.
- Measures the mark and not the text inside it, or the gap and not what shows above it, so a pick ships with half its condition unchecked.
- Quotes figures in a pick question from memory, and records them without reading the computed values back.
- Relays each pick as it is taken when the operator wants picks batched on their own call.
- Serves a rebuilt export from a server whose working directory was deleted by the rebuild, and measures a page that is not there.
- Applies a pick to the tracked tree, or deletes the candidate pages, because the single-decision loop it borrowed does both.
- Leaves findings, numbers and build criteria in chat, so whoever files the work does it from a summary rather than from a record.

## Must

- Record conditions, findings with their measurements, picks with the arms they beat, evidence paths and build criteria in one walkthrough file under `.canon/walkthroughs/`.
- Measure each finding off the built page before drafting any arm.
- Build candidate pages from the app's rendered markup and built stylesheet, with a theme toggle, served on localhost.
- Capture every arm in every theme the app ships to its walkthrough's own evidence folder, and look at the captures before handing the link over.
- Number the walkthrough folder and each round's folders so they sort in the order they ran, and let a round's number match its finding's.
- Send the localhost link in its own message, ending the turn, before every pick question is asked.
- Hold picks and relay them only when the operator calls a batch, as one message, to the controller where one exists and to the operator otherwise.
- Route a finding with no visible choice into the batch as a proposed row rather than drafting arms for it.

## Must not

- Change a tracked file, create a branch or commit, or file a task row.
- Apply a winning arm or delete the evidence.
- Draft arms for a finding the operator has not raised.
- Restate `draft-and-pick`'s arm rules or the `canon capture` and `canon serve` mechanics.
- Fire on a request naming one decision alone, which `draft-and-pick` covers.
- Review criterion, not a gate: whether anything other than the operator or a controller's launch brief invokes this skill, and which lines a second project found in its way. Read both back after it has run outside the project it was written in.

## Guards

The refusal strings sit in the body. Two conditions stop a run: no build to measure against, and a request to change a tracked file.

## Out of scope

- `draft-and-pick` runs one decision end to end and applies it. This runs many decisions and applies none.
- `ux-audit` reads source for roughness. This takes its findings from what the operator saw.
- `plan-feature` and a worker build a pick. This stops at the record and the batch.
- The controller, or the operator where none exists, decides rows, order and pull request boundaries. This proposes and does not file.
