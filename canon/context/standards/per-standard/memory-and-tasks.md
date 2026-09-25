---
title: Memory and tasks
description: Where the memory standard's delete prohibition lives and why, the shape rules measured against the pen, and the tasks readiness test widened to admit a row waiting on an external condition
---

# Memory and tasks

## Memory standard

`standards/memory.md` fixes the filename and its type prefix, the frontmatter, the body shape each type carries, links between entries, and the lifecycle.

`CLAUDE.md` keeps two bullets rather than pointing at the standard for everything: the write location, because `.canon/memory/` rather than `~/.claude/projects/` is project policy, and the routing rule, because it has to fire before an entry is written at all.

The delete prohibition sits in both tiers on purpose. A path-scoped rule fires when a session edits a file the glob matches, and a bulk retire runs through the shell as a `mv`, so `559-memory.md` is never loaded at the moment the irreversible act happens. The always-loaded copy is what reaches the shell path, and the rule copy is the reminder a session gets while editing an entry. The tier test in `canon/context/context-model.md` asks whether a rule fires on a path being edited, and this is the case where the answer is no because the violating action is not an edit.

## Memory pen shape

The shape rules are measured against the pen rather than drafted from the sources. Every body opens with a prose rule line, no marker is ever indented, and `**Why:**` and `**How to apply:**` co-occur in every rule-bearing entry, and the entries carrying neither are exactly the `reference` and `user` types.

Blank lines between the three parts vary across the pen, so the standard states the three parts as the contract and stays silent on the separator. Requiring one spelling would report a large share of the corpus on the rule readers are least served by.

`category` is compared against the sentence-case form of the filename prefix rather than checked field by field. One comparison catches a prefix outside the four types, a field disagreeing with the prefix, and a casing drift that would open a second group in the generated catalog, and it reports one finding where three rules would report the same defect three times.

No dangling-link check ships. A `[[name]]` link that resolves to nothing usually names an entry not yet written, which the format treats as a marker worth keeping, and some apparent dangles are backticked TOML `[[table]]` syntax.

The two classes the verb catches are an entry titled with its own filename stem, which renders a slug in the catalog where the rule belongs, and a filename prefix belonging to none of the four types.

## Tasks readiness test

`standards/tasks.md` admits a row to `## Up next` on a written plan plus a stated reason the task cannot start, and that group's `Waiting on` cell carries a collision, a sibling task, or an external condition. The three forms are stated under the group they govern rather than under the header they share. A test naming only the first two leaves a planned task waiting on a condition outside the board passing neither it nor the `## Needs a plan` test below it.

A fourth heading lost, and the standard bans one, because a board grouped under names of its own reads as empty to anything counting rows under a heading. Widening a test costs one clause and keeps the three headings every reader already parses.

The three tests are read in order, so widening `## Up next` alone leaves its new kind unreachable. A `## Run now` test whose second half names only a file collision admits a task blocked on an external condition, since such a task collides with nothing running. Both tests therefore turn on the same clause, that the task carries no reason it cannot start, with the collision kept named under `## Run now` so the `Touches` column and the validator's collision check keep their basis.

The external kind names what would satisfy the condition rather than the condition alone. Without that clause the kind admits any excuse, including a row nobody has looked at.

The `## Needs a plan` cell takes the same treatment. It states why the row sits where it does, never why the row matters, since a reason of that shape admits every row at once and leaves the order to whenever each was filed. Naming the row or the class it is ranked against is what a comparison costs. `canon tasks validate` reads it back, and the mechanism sits in `canon/context/cli/audits.md`.

`canon tasks validate` resolves the `Task`, `Plan`, and `Touches` columns by header text and never reads the `Waiting on` cell, so the widened test holds on reading alone and the standard says so. A non-empty check lost, since every row already passes it. Every finding the validator reports compares a written claim against the tree, and an external condition puts no fact there to disagree with.
