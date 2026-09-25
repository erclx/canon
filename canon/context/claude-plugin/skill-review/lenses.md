---
title: Lenses
description: The review lenses that read the pull request body rather than the diff, from the Testing question and the stale ticked box to the reviewer request section and the key-changes claim check
---

# Lenses

`review-pr` Step 3 reads the diff through the ordinary lenses and reads three sections of the pull request body through lenses of their own. Each lens draws its bound at one section and reads neither the sections around it nor the rest of the body, since the Summary and Technical Context carry the author's argument for the change, and a reviewing pass reading that argument while judging the change is most of what an independent vantage exists to avoid.

## The Testing question

A lens reads the `## Testing` section against what the repository can drive. It reads the claim the author made about verifying the change, which is the one part of a description a reviewing session can falsify: the branch author cannot see what a sibling branch drove the same day.

It asks rather than grades, so it stays out of the finding counts. Whether a human is genuinely required is a reading the author may hold a reason for, so the question carries no severity and enters no count.

A question riding on a close-out would land on a thread reporting nothing owed, the dispatch would never fire, and the one party who can answer would never see it, so the lens sits under the same unified threshold as everything else: the threshold reads anything owed rather than any finding, which covers a bare question alongside a graded finding without separating them, and the summary line names the question count beside the three that stay zero.

What it tests against is `standards/pr.md`, which says what makes a human required: a capability the agent lacks, never the cost of the run. A refusal the author actually met counts and names itself, and a refusal predicted and never met does not. `review-pr` reads that file off the plugin root through the fallback citation form, the same route every skill citing it takes.

## The stale ticked box

A second check reads the opposite half of the same section: a ticked box rather than an unchecked one. A box stays true only as long as what it names does, and a fix commit landing after review is what breaks that, so a box naming a test a later commit replaced can reach the merge record with nothing positioned to catch it.

The check is bounded to a box naming a file or a command, since a claim carrying no artifact has nothing this lens can confirm, and it tests that the named artifact still exists rather than re-running what the box claims, which keeps the check from turning a review into a test run. Unlike the Testing question, a stale ticked box carries severity and enters the count, since it is a factual claim the body still makes rather than a judgment call the author is owed a chance to defend.

Confirming a file's existence keys off `<headRefOid>` rather than local `HEAD`. `review-pr` never checks out the branch it reviews: Step 2 reads the diff and file contents through `gh pr diff`, `gh api`, and `git fetch -q origin pull/<number>/head`, resolving the branch tip rather than reading a checkout. A read against `HEAD` would resolve the reviewing session's own branch instead of the pull request, a silent wrong answer rather than a missing one, since `HEAD` always resolves to something.

That resolution comes off `canon pr head --json`, taking the record's `tip`, rather than off a pull request object's own field, which can trail the branch ref by up to a minute after a push with nothing on it saying so. Step 1 still reads `number`, `headRefName`, `title`, and `body` in one `gh` call and takes the head from the verb instead, which costs one extra remote round trip. The `<short-sha>` naming the Step 4 body file is drawn from the same tip, so a body file and the ancestor test beside it name one commit rather than two.

## The reviewer request section

`standards/pr.md` defines `## For the reviewer` as what the reviewer should confirm, one bullet per request, and names that reader as the reviewing session rather than leaving it ambiguous between a person and a session. A lens reads that section and stops there.

Answering a request takes the Testing question's shape rather than new machinery, since the two match on the surface: an item that is not a finding still has to survive to a reader, still has to avoid the merge-blocking counts, and still has to keep the thread open until it is settled. The output block sits beside the Testing block in Step 4 for the same reason the lens sits beside the Testing lens in Step 3.

Owed narrows to a bullet the pass could not answer, rather than every bullet a pull request carries. Treating every bullet as owed the moment the pass carries one would force the open heading and a dispatch on every pull request carrying the section, whether or not anything is left for the author to do, since a reviewer request is normally discharged by the same pass that reads it, unlike a Testing question, which stays owed until the author answers on a later pass.

A pass whose bullets are all answered takes the closed heading with the block standing in for the canned line, the same shape a withdrawn finding already takes.

## The key-changes claim check

Step 3 also checks `## Key Changes`: `canon pr key-changes` compares the paths that section claims against the pull request's own changed-file list, and the step files a claim the diff does not carry under the same `**PR body**` block the stale ticked box takes, since what both corrupt is the merge record rather than a file in the diff.

The section is read alone, since `## Technical Context` names files a branch never touched by design. A bullet's claim region ends at its first comma, since a clause past the comma is usually naming context rather than the edit itself, and reading the whole bullet as a claim pulls those context mentions in as false claimed-but-untouched paths.

Only the claimed-but-untouched direction is graded. A changed file no bullet names is reported without a severity, since that class covers a real omission and equally a generated asset or a regenerated index, and grading it would fire on nearly every branch. A path written partially, or one past its bullet's first comma, can credit a changed file and never accuse one, since nothing separates a path written short from a path written wrong or a second claim from a file cited for context.

Three words void a bullet's claim outright when the bullet declines an edit rather than making one: `untouched`, `unchanged`, and `as written`.

Each direction then splits again on whether the evidence is worth raising with a person, and what each split sets aside is still reported rather than dropped. A test beside its subject, a fixture, and a lockfile owe no bullet by Step 3's own standard, so they come out of `unnamed` into `incidental`, since a count mixing files that owe a bullet with files that never could cannot be acted on at any value. A generated asset and a regenerated index belong in that class and are deliberately absent, since neither has a spelling that holds outside one project and guessing at one would set aside a file that did owe a bullet. `docs/agents/key-changes.md` carries the span rules and the residual rate.

It composes on the body read Step 4 already does rather than opening a second one, since two reads of one text at one head is two places for the head to be wrong.
