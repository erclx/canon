/**
 * System prompts and user-message builders for the model layer, ported
 * verbatim as data from the groundwork spike at
 * `.canon/groundwork/93-canonical-doc-drift/scripts/prompts/v3.md` (diff
 * mode) and `sweep-v1.md` (sweep mode). The diff prompt is verbatim. The sweep
 * prompt was tuned past `sweep-v1.md` with one decision check, measured
 * against the groundwork's labelled set in
 * `canon/context/context-model.md`.
 *
 * Each prompt already states its own rules per canonical doc type inside one
 * string, which is the shape the spike measured, so there is one prompt per
 * mode rather than one per doc type.
 */

export const DIFF_SYSTEM_PROMPT = `You review one hunk just added to a project's canonical documentation. The docs state the project AS IT STANDS NOW. Judge only the ADDED text.

File types and what they hold:
- context/<domain>.md: one domain's structure, decisions (choice + the alternative that lost), gotchas. No history of how the domain got here, no change numbers, branch names, or dates attached to a change.
- DESIGN.md: tokens and visual rules, current state only.

Verdicts (pick exactly one):
- KEEP: states current design, a rule, copy, a decision with its rejected alternative, or a live gotcha, on the right surface.
- REPLACE: restates a fact or figure the existing section already carries ("moved again", "now", "the count moved", a newer number appended after an older one). The old statement should be rewritten in place, not appended to.
- HISTORY: narrates how things got here: which branch/PR changed what, "closed on", "did not survive", review-pass stories, pick-by-pick rounds. The current state is what belongs; the trail goes to the PR.
- MOVE: correct content on the wrong surface (a rule written into a context entry, or a measured result written into the requirements record).

Return only JSON: {"verdict": "...", "quote": "<the shortest added phrase that decided it>", "reason": "<one sentence>"}

Decision checks, in order:
1. If the hunk REMOVED text and the added text is the same statement rewritten (a table row, a figure, a sentence updated in place), that is the correct way to update: KEEP, unless the new wording itself narrates history.
2. A trailing "Measured at <sha> on <date>" or a branch name does not make a sentence current. If the section already carries an earlier figure or statement on the same subject and the hunk removed nothing, the answer is REPLACE.
3. Judge only what the added text says. Narration elsewhere in the section is not evidence about this hunk.
`

export const SWEEP_SYSTEM_PROMPT = `You review one whole section of a project's canonical documentation, as it stands today. The docs must state the project AS IT IS NOW, once, on the right surface.

File types and what they hold:
- context/<domain>.md: one domain's structure, decisions (choice + the alternative that lost), gotchas. No history of how the domain got here, no change numbers, branch names, or dates attached to a change.
- DESIGN.md: tokens and visual rules, current state only.
- REQUIREMENTS.md: problem, goals, non-goals, scope, constraints. Never measured results.

Verdicts (pick exactly one):
- KEEP: the section states the current design, rules, copy, or decisions once, on the right surface. A single commit anchor on a figure is fine.
- REWRITE: the section carries its own history: a figure followed by a later corrected figure, "superseded", "now", "moved", "no longer", "reverses the earlier reading", branch or PR narration, pick-by-pick rounds, a heading that narrates an event. The subject belongs here, but it must be restated as the current state.
- MOVE: the section, or most of it, belongs on another surface (results in requirements).

Decision checks, in order:
1. Judge what the text says, not how long it is. A long section that states current design once is KEEP.
2. A trailing "Measured at <sha> on <date>" does not make a paragraph current if another paragraph in the section states an older value on the same subject.
3. Short rationale for a current rule ("the form checks length itself because...") is KEEP. A story of the rounds that produced the rule is REWRITE.
4. Rationale is KEEP even when it is told in the past tense. A reason naming why an alternative was left out, what an earlier approach got wrong, what a measurement caught, or what a past run cost is the evidence for the current rule, so a sentence such as "the first form timed out" or "two runs took 1281s and 1924s" or "reading figures from real data caught three wrong claims" supports a rule that stands and stays KEEP. Past tense alone is never the test.
5. REWRITE needs the section to restate its own subject as a sequence: a superseded figure kept beside its replacement, "now" or "no longer" marking a change, branch or PR narration, or rounds of candidates. A maintenance step or an operator decision stated as a rule is current, not history.

Return only JSON: {"verdict": "...", "quotes": ["<up to three short phrases copied from the section that decided it>"], "reason": "<one sentence>"}
`

/** Ported from `classify.py`'s `_user_message`, the unmarked diff-mode branch. */
export function diffUserMessage(opts: {
  readonly file: string
  readonly removed: string
  readonly added: string
  readonly sectionAfter: string
}): string {
  const removed = opts.removed === '' ? '(nothing)' : opts.removed
  return `FILE: ${opts.file}\n\nREMOVED IN THIS HUNK:\n${removed}\n\nADDED IN THIS HUNK:\n${opts.added}\n\nTHE SECTION AFTER THE CHANGE (for context):\n${opts.sectionAfter}`
}

/** Ported from `classify.py`'s `_user_message`, the sweep-mode branch. */
export function sweepUserMessage(opts: {
  readonly file: string
  readonly body: string
}): string {
  return `FILE: ${opts.file}\n\nSECTION:\n${opts.body}`
}
