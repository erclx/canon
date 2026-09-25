---
title: Catalog health
description: Whether a skill earns its place, how to read a usage census, the eval wrapper not built and the gate that reopens it, and reading the catalog for overlap rather than for size
---

# Catalog health

## Whether a skill earns its place

The redundancy audit in `canon/context/claude-plugin/skill-strategy/redundancy-audit.md` runs outward, against community counterparts. Inward, against the catalog's own two zero-cost tells, a folder wrapping something already reachable and a folder nobody calls, `create-skill` asks the first two before a folder exists, and `570-skill.md` carries the same check for whatever creates a `SKILL.md` some other way.

The third question, whether anything invokes the skill beyond the author typing its name, has no answer at creation time. It ships in the skill's own `REQUIREMENT.md` as a review criterion, read against a usage census rather than gated on up front.

### What a verdict requires

A skill carries a verdict when these entries reach a disposition on it: a passage stating the reason it stays, or a redundancy audit line stating keep or borrow against a counterpart. Naming a skill inside another skill's disposition is a mention and settles nothing on its own.

A skill with no plausible community counterpart, which covers most of the catalog since it wraps this toolkit's own catalogs and formats, skips a redundancy comparison outright. Where a plausible counterpart exists, the comparison and its outcome are recorded in the redundancy audit rather than restated per skill here.

### Reading a usage census

A typed-prompt history and a tool-level transcript record are both per-machine readings rather than repository facts, and reading either one straight risks several traps:

- Sandbox and eval runs inflate anything with a test driving it, in both records. Split a reading by project path to separate harness use from organic use.
- The tool-level record's window is shorter than the typed history's, so recent adoption reads lower there until the window catches up.
- A skill body read by path, rather than invoked through the tool, writes no record in either corpus.
- A one-shot skill can only ever score in the typed record, since every target it acts on was scaffolded before any transcript window opened.
- The census spans whatever machine and project folders it was run against, so it does not reproduce on a second machine or a second pass.
- A skill carrying `disable-model-invocation: true` cannot be reached by a description match at all, so its tool-level number counts explicit hand-offs rather than routing, and its floor is structural rather than earned.
- A skill a sibling body chains carries a tool-level number that counts how often the chain ran rather than how often anyone wanted it specifically. Read it against the typed count of its chain head instead.
- A rename splits a skill's history across two spellings. A rename of the plugin's own prefix splits every skill's history at once rather than one skill's.

A zero or near-zero reading is not the same as nobody reaching the skill. A skill cited by sibling bodies, exercised only by a sandbox arm, or named by a governance rule or docs page can carry real reach with no typed or routed call behind it. Read a census as one input to a conversation about a skill's place, never as a removal list on its own.

### Every skill currently ships

Every folder under `claude/skills/` currently ships. Each read against `create-skill`'s three questions either has no simpler surface already reaching its moment, or carries a nontrivial procedure worth a body of its own, or both, with one open exception: `youtube-transcripts` answers question 1 with a plain yes, since `canon transcripts <url>` already owns the fetch, the cleanup, and the frontmatter its body wraps. It is the strongest removal candidate the audit has found, and it stays a skill until the operator answers whether to drop it. A skill landing after a given census pass carries no verdict yet by construction, and a later pass closes that gap.

A few load-bearing patterns come out of running the three questions across the whole catalog:

- Four skills, `git-commit`, `git-branch`, `git-pr`, and `git-stage`, each partly overlap a Claude Code built-in, decided by `governance/rules/core/087-git.md`. A project without governance has no such rule, and no seed fallback, since one scaffolded without the plugin carries no `canon:git-*` skills at all.
- `auto-ship`'s ship step invokes `git-ship` directly and states the sequence once, in the body a reader also meets on its own, rather than restating it. The one thing the wrapping chain adds is marking the pull request as a draft, placed ahead of the CI watch rather than after it.
- A skill reached almost entirely through a chain, such as `memory-capture` or most of the `git-ship` sequence, is not adopted by an operator typing its name. The chain is the denominator its call count measures, not demand, so read such a skill's reach against the typed count of whichever skill heads the chain.
- The most-called skill in the catalog can carry no sandbox arm at all when its reach is already proven by how many chain steps route to it, and a skill with a real sandbox arm and a real citation can still score zero on every usage record. Neither instrument substitutes for the other.
- A skill whose own body forbids merging into a neighbor, on a stated contradiction the merge would create, stays split even when its usage looks nominal next to that neighbor's.
- `role-worker`, `role-planner`, and `repo-metadata` each answer question 1, whether a rule, a verb, or an existing skill already reaches this moment, with no: each asserts a role, a repository metadata proposal, or a channel obligation nothing else in the catalog covers.

## The eval wrapper not built

`canon-skill-eval` is a proposed thin wrapper composing `claude plugin eval`, which is the one runner that scores whether a skill changes behavior rather than whether it conforms. It is not built, and this is where the reason sits, since a session proposing it again reads this entry before it finds a groundwork folder.

The command is gated. `claude plugin eval`, `claude plugin eval init`, and every target spelling refuse with `` `plugin eval` is currently in early access `` at Claude Code `2.1.250`, and the refusal precedes target parsing, so the resolution question the proposal turns on cannot be measured at all. A wrapper shipped against it would refuse in every target whose operator is not enrolled, and the toolkit would own a body whose failure it caused and cannot explain. Building the guard alone is a `README` line wearing a skill folder, which fails `create-skill`'s second question outright, and building a runner here instead is the forked-curation trap `canon/context/claude-plugin/skill-strategy/overview.md` names.

Read that as a state rather than a verdict. The gate can lift without notice, and the probe that reopens it is `claude plugin validate <path>`, the one ungated surface in the family nobody has run. `.canon/groundwork/47-skill-eval-resolution/` carries the four dropped alternatives and the enrolment question that closed unanswered.

What ships instead is the half nothing blocks. `canon claude skills rank` and `reach` read a target's own `.claude/skills/` through `resolveSkillsCorpus`, and `rank --cases` takes a project's own prompts as JSON, so a live target's own skills can be measured on routing. Routing against a project's own vocabulary is the axis no external runner will ever cover, because only that project can pose the question.

Neither measure has a recorded floor in `canon/config/baseline.json`, so `bun run check` never gates on the rank score or the collision count. That matters most when a change edits a skill's `description`, since the field is what the corpus scores and a widened one silently takes cases off its neighbors, including neighbors neither the plan nor the diff names. A standing collision and a fresh regression read identically in one run, so the only way to tell them apart is to measure both sides. The verb takes a project root as its argument, which makes the comparison cheap: extract the trunk with `git archive origin/main` into a scratch tree, rank that tree, and read the branch against it.

## Reading the catalog for overlap rather than for size

A catalog-size trim is answered by the marketplace subset lever instead of a cut: `canon/context/claude-plugin/distribution.md` carries the result, where a curated marketplace root holding one symlink per kept skill loads a handful of skills at a fraction of the always-on token cost of the full plugin. A trim measured by catalog size reaches that lever at a cost already paid, which is what an overlap read answers instead.

The one job-duplication candidate an overlap read across the catalog has found is `git-commit` inside `git-stage`. That pair fails the merge on a behavioral difference neither description states on its own: `git-stage` clears the stage and restages whole files, destroying the hunk-level selection `git-commit` preserves.

Every other pair that reads as overlap is a declared boundary or a wording collision rather than genuine duplication.

- `seed-sync` cites `canon-cli` and `target-setup` does not, a gap an overlap read found and no pass has closed.
- `target-setup` carries the leaf-script check and the server smoke check as two depths inside one reference rather than two skills. The procedures differ, since a leaf script is judged by its exit code and a server by whether it starts and stays up, but what a caller picks between is how heavy the check is rather than which of two skills to name, and a depth argument states that where two descriptions would not.
- `test-first` and the `canon gov test-order` step in `auto-ship` do not overlap: the body carries the red-green loop and the autoship step carries a history read. The boundary that matters is against `systematic-debugging`, since both write a test before a change and only one starts from a failure nobody has explained.
- `record-screencast` and `draft-screencast` stay separate, since a second skill re-reading a draft it did not write is the risk the split declines.

`wiki/claude/claude-skills.md` covers the Claude Code skill feature itself, and `docs/workflow/visual-design-workflow.md` is the worked example of per-workflow skill recommendations.
