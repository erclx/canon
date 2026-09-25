---
name: review-branch
description: What local review is for, the gaps it closes, and why it reports without fixing
---

# Review branch requirement

## Gap

Without this skill, a branch ships on the confidence of the session that wrote it. Review happens in chat and evaporates, so the ship step has no receipt to gate on. What review does happen mixes style opinion with real defects at one severity, and a reader cannot tell which blocks the merge. Worst, a diff that resolves empty against a stale base reports a clean branch instead of admitting the skill could not see the work.

## Must

- Read the project's own context before the diff, so a decision already settled is not reported as a defect
- Resolve the base ref once, preferring the remote over local `main`, and reuse it in the guard and the read
- Say when the baseline is unusable and name the narrowed scope, rather than letting a clean summary read as a clean branch
- Flag only what will cause incorrect behavior or break a documented rule
- Apply `canon:review-craft`'s axes and evidence bar, rendered output included, rather than carrying an axis list of its own
- Grade every finding, since the caller gates on the counts rather than on the prose
- Write the report to disk under a branch-derived slug, so what the ship step reads outlives the session

## Must not

- Fix, rewrite, or suggest a refactor outside a finding. Reporting is the whole job.
- Flag style, linter territory, or anything resting on unverified state. A false positive erodes trust in the pass.
- Substitute the whole tree for a missing baseline
- Repeat the full report in chat. The file is the report and a chat copy of it goes stale immediately.
- Stage or commit the receipt, which is gitignored scratch
- Auto-trigger on a vague signal. Require an explicit request or a pipeline invocation.

## Guards

- The staged set, the branch set, and the working set are all empty: stop with a pass
- Baseline unusable: continue on the uncommitted set and lead the report with the warning

## Out of scope

- Reviewing an open pull request, which `review-pr` owns. The split is by vantage: this one reviews local work for the session that wrote it and writes to disk.
- Deciding whether the findings block the ship. This skill grades and the caller gates.
- Fixing anything it found, which `review-address` owns once the work is on a pull request
