---
title: Closing comment reference
description: The shape of the comment a pull request carries when it closes unmerged, its two forms, and the limits the verb checks
---

# Closing comment reference

## Scope

Governs the comment posted when a pull request closes without merging.

Does not govern:

- A pull request body or title: `${CLAUDE_SKILL_DIR}/../git-pr/references/pr.md`
- A review reply, which `review-address` writes

## Shape

A reader who finds the closed pull request later learns why it closed and where the work went, in two sentences at most.

- Open on what happened: `Superseded by #<number>` when another pull request carries the work, or `Closing unmerged.` otherwise
- Say why in one sentence, naming the decision rather than retelling the discussion that reached it
- End on what replaces it, or how to reopen when the close is a pause
- Keep each paragraph under 350 characters, and two paragraphs at most

### Superseded

Another pull request carries the work, so the comment links it and says nothing is left behind.

```markdown
Superseded by #<replacement>, which combines this batch with the five other context rebuilds and carries every reviewed change from this branch. Nothing here is left to carry over.
```

### Closed for a decision

Nothing replaces the work, so the comment names the decision that ended it.

```markdown
Closing unmerged. Base's starter label map should stay stack-neutral rather than list every stack's configs, so each project adds rows for its own stack.
```

## What the verb refuses

`canon pr close` checks the reason before it reads the pull request, and refuses `reason-unpublishable` with the findings in its record.

- A banned character, a phase label, a board reference, or a session link, the checks `canon labels scan` runs on a body
- A paragraph or a run of paragraphs past the density limits, measured on the reason itself
- The scan measures density only on a post opening on a known heading, so the verb measures it here

## Sources

- [Zephyr pull request lifecycle policy](https://docs.zephyrproject.org/latest/contribute/pr_lifecycle_policy.html)
  - "Close with explicit rationale and a reopen path."
  - For a superseded one: "Link the replacement pull request." and "Add a short summary comment preserving context."
