---
title: Catalog health
description: Whether a skill earns its place, how to read a usage census, the eval wrapper not built and the gate that reopens it, and reading the catalog for overlap rather than for size
---

# Catalog health

## Decisions

### Whether a skill earns its place

The redundancy audit in `canon/context/claude-plugin/skill-strategy/redundancy-audit.md` runs outward, against community counterparts. Inward, `create-skill` asks the catalog's two zero-cost tells before a folder exists, being a folder wrapping something already reachable and a folder nobody calls.

- `governance/rules/claude/skill.md` carries the same check for whatever creates a `SKILL.md` some other way
- The third question, whether anything invokes the skill beyond the author typing its name, has no answer at creation time
- It ships in the skill's own `REQUIREMENT.md` as a review criterion, read against a usage census rather than gated on up front

### What a verdict requires

A skill carries a verdict when these entries reach a disposition on it, being a passage stating why it stays or a redundancy audit line stating keep or borrow. Naming a skill inside another skill's disposition is a mention and settles nothing.

- A skill with no plausible community counterpart skips the comparison outright
- That covers most of the catalog, since it wraps this toolkit's own catalogs and formats
- Where a counterpart exists, the comparison is recorded in the redundancy audit rather than restated per skill here

### Reading a usage census

A typed-prompt history and a tool-level transcript record are both per-machine readings rather than repository facts. Reading either straight risks several traps.

- Sandbox and eval runs inflate anything with a test driving it, in both records, so split a reading by project path to separate harness use from organic use
- The tool-level window is shorter than the typed history's, so recent adoption reads lower there until it catches up
- A skill body read by path, rather than invoked through the tool, writes no record in either corpus
- A one-shot skill can only score in the typed record, since every target it acts on was scaffolded before any transcript window opened

### What a count cannot show

A census does not reproduce on a second machine or a second pass, because it spans whatever machine and project folders it was run against.

- A skill with `disable-model-invocation: true` cannot be reached by a description match
- Its tool-level number counts explicit hand-offs rather than routing, so its floor is structural rather than earned
- A skill a sibling body chains counts how often the chain ran, not how often anyone wanted it. Read it against the typed count of its chain head
- A rename splits a skill's history across two spellings, and a rename of the plugin's prefix splits every skill's at once

A zero or near-zero reading does not mean nobody reaches the skill. A skill cited by sibling bodies, exercised only by a sandbox arm, or named by a governance rule or docs page can carry real reach with no typed or routed call behind it. Read a census as one input to a conversation about a skill's place, never as a removal list.

### Every skill currently ships

Every folder under `claude/skills/` ships. Each, read against `create-skill`'s three questions, has no simpler surface already reaching its moment, or carries a nontrivial procedure worth its own body, or both. One exception stays open.

- `youtube-transcripts` answers question 1 with a plain yes, since `canon transcripts <url>` already owns the fetch, the cleanup, and the frontmatter its body wraps
- It is the strongest removal candidate the audit has found, and it stays a skill until the operator answers whether to drop it
- A skill landing after a given census pass carries no verdict yet by construction, and a later pass closes that gap

### Patterns across the catalog

Running the three questions across the whole catalog surfaces a few load-bearing patterns.

- `git-commit`, `git-branch`, `git-pr`, and `git-stage` each partly overlap a Claude Code built-in, decided by `governance/rules/canon/git.md`
- A project without governance has no such rule and no seed fallback, since one scaffolded without the plugin carries no `canon:git-*` skills at all
- `auto-ship`'s ship step invokes `git-ship` directly and states the sequence once, adding only the draft marking ahead of the CI watch
- A skill reached almost entirely through a chain, such as most of the `git-ship` sequence, is not adopted by an operator typing its name
- The chain is the denominator of its call count, so read its reach against the typed count of the chain head

### Reach and merging

Neither usage instrument substitutes for the other, and a body's own boundaries can outweigh both.

- The most-called skill can carry no sandbox arm when how many chain steps route to it already proves its reach
- A skill with a real sandbox arm and a real citation can still score zero on every usage record
- A skill whose own body forbids merging into a neighbor, on a stated contradiction the merge would create, stays split even when its usage looks nominal next to that neighbor's
- `role-worker` and `role-planner` each answer question 1 (does a rule, verb, or skill already reach the moment) with no, since each asserts a role or channel obligation nothing else covers

### The eval wrapper not built

`canon-skill-eval` is a proposed thin wrapper composing `claude plugin eval`, the one runner that scores whether a skill changes behavior rather than whether it conforms. It is not built. This entry holds the reason, so a session proposing it again reads it before finding a groundwork folder.

The command is gated. `claude plugin eval`, `claude plugin eval init`, and every target spelling refuse with `` `plugin eval` is currently in early access `` at Claude Code `2.1.250`, and the refusal precedes target parsing, so the resolution question the proposal turns on cannot be measured.

- A wrapper shipped against it would refuse in every target whose operator is not enrolled, and the toolkit would own a body whose failure it caused and cannot explain
- Building the guard alone is a `README` line wearing a skill folder, which fails `create-skill`'s second question outright
- Building a runner here instead is the forked-curation trap `canon/context/claude-plugin/skill-strategy/overview.md` names

Read that as a state rather than a verdict, since the gate can lift without notice.

- The probe that reopens it is `claude plugin validate <path>`, the one ungated surface in the family nobody has run
- `.canon/groundwork/47-skill-eval-resolution/` carries the four dropped alternatives and the enrolment question that closed unanswered

### What ships instead of the eval wrapper

The half nothing blocks ships. `canon claude skills rank` and `reach` read a target's own `.claude/skills/` through `resolveSkillsCorpus`, and `rank --cases` takes a project's own prompts as JSON, covering routing against the project's own vocabulary, the axis no external runner will cover.

Neither measure has a recorded floor in `canon/config/baseline.json`, so `bun run check` never gates on the rank score or the collision count. That matters most when a change edits a skill's `description`, since a widened one silently takes cases off its neighbors, including ones neither the plan nor the diff names.

- A standing collision and a fresh regression read identically in one run, so measure both sides
- The verb takes a project root, which makes the comparison cheap. Extract the trunk with `git archive origin/main` into a scratch tree, rank that tree, and read the branch against it

### Reading the catalog for overlap rather than for size

A catalog-size trim is answered by the marketplace subset lever instead of a cut. A trim measured by catalog size reaches that lever at a cost already paid, which an overlap read answers instead.

- `canon/context/claude-plugin/distribution.md` carries the result, where a marketplace root with one symlink per kept skill loads a handful at a fraction of the full plugin's always-on token cost
- The one job-duplication candidate an overlap read has found is `git-commit` inside `git-stage`
- The merge fails on a behavioral difference neither description states, since `git-stage` clears the stage and restages whole files, destroying the hunk-level selection `git-commit` preserves

### Pairs that read as overlap

Every other pair that reads as overlap is a declared boundary or a wording collision rather than duplication.

- `target-setup` holds the leaf-script check and the server smoke check as two depths in one reference
- A leaf script is judged by exit code and a server by whether it starts and stays up, but a caller picks how heavy the check is, which a depth argument states
- `test-first` and the `canon gov test-order` step in `auto-ship` do not overlap, since the body carries the red-green loop and the step carries a history read
- The boundary that matters is against `systematic-debugging`, since both write a test before a change and only one starts from a failure nobody has explained
- `record-screencast` and `draft-screencast` stay separate, since a second skill re-reading a draft it did not write is the risk the split declines

`wiki/claude/skills.md` covers the Claude Code skill feature itself, and `docs/workflow/visual-design-workflow.md` is the worked example of per-workflow skill recommendations.
