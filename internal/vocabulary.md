---
title: Rule-writing vocabulary
description: Glossary of terms for writing rules, prompts, and standards
---

# Rule-writing vocabulary

A running bank of terms worth reaching for when authoring rules, prompts, skills, and standards. Each entry is term, one-line gloss, and one-line use-when. Entries are grouped by category and alphabetical within each. Append new terms as they come up, and prune or consolidate during periodic sweeps.

This page departs from `standards/glossary.md` on one rule and states the departure as that reference requires. Each entry closes with a use-when rather than naming where the term first appears, because the bank is drawn from every session that produced a term rather than from one body of material, so there is no first appearance to point at. The use-when carries what the reader came for in its place, which is whether to reach for the term at all.

Source: this repo itself. The vocabulary is the toolkit's own working surface, growing a term at a time and getting pruned in place, with no target project consuming it, which is what makes `internal/` its home per `CLAUDE.md`'s content-ownership section.

## Techniques

Ways to write a rule well.

- **Answer slots**: plan-file `- Answer:` placeholders for open questions that the user fills in asynchronously. Use when a planning pass produces more than two questions and inline chat Q&A would stall the session.
- **Ban the shape, not instances**: forbid a structural pattern instead of enumerating banned items. Use when a rule would otherwise become a drifting list of forbidden examples.
- **Invalidator list**: an explicit roster of upstream changes that should trigger a re-run of a verifier, test, or sync. Use when authoring a script or doc whose staleness the tool cannot detect on its own.
- **Progressive disclosure**: front-load critical instructions, defer detail to references. Use when structuring a skill body or reference doc.
- **Sharpen**: tighten a rule's phrasing without adding surface. Use when a rule is directionally right but loose.
- **Ship minimal v1**: smallest version that works, queue extensions as follow-ups. Use when scoping a new feature or refactor.
- **Soft guidance, not a cap**: framing a quantitative rule as advisory rather than enforced. Use when a hard cap would be too rigid but direction still matters.
- **Suggested order, most important to least**: ordering rule items by priority so the reader can skim and stop. Applies to numbered lists in skills and rule documents.
- **Terse bullet rules**: short directive phrasing for cases where the requested behavior is a known default. Use when the instruction is unambiguous and the reader is a capable agent.

## Anti-patterns

Shapes to avoid in a rule.

- **Artifact-specific framing**: a public-facing intro that names repo-specific artifacts as if they were universal problems. Use as a caution when reviewing an overview paragraph or positioning sentence.
- **Inventory**: listing instances of a pattern instead of the pattern itself. Use as an anti-pattern callout when reviewing a rule.
- **Overfitting**: a rule so specific to one incident that it fails to fire on the next case. Use as a caution when a rule comes out of a single session's pain.
- **Rule-letter fix**: an edit that satisfies a rule's surface phrasing without improving the underlying surface. Use as a caution when reviewing audit edits where the rewrite ticks the rule but the reader is no better off.
- **Silent scope extension**: bundling unrelated changes into a focused edit without flagging them. Use as a caution when a fix has a tempting adjacent cleanup.

## Qualities

Properties a rule should have, aim for, or minimize.

- **Ceremony**: visible overhead a structure imposes on author or reader. Use when deciding whether a structural choice earns the weight it adds.
- **Crispness**: the one-line phrasability test. Use when deciding whether to promote a memory entry or cut it.
- **Generality**: breadth of a rule's applicability. Use when auditing a newly drafted rule or promoting a memory.
- **Language-agnostic**: portable across programming languages or domains. Use when authoring governance or standards meant to apply beyond one language.

## Frames

Concepts for thinking about or discussing rules.

- **Content ownership**: each rule or concept lives in exactly one canonical surface. Others point to it instead of duplicating. Use when deciding where a new rule goes.
- **Correcting defaults vs teaching novel**: litmus for rule length. Correcting a default needs one line. Teaching a novel pattern needs an example.
- **Holding pen**: temporary storage meant to churn rather than accumulate. Entries should resolve to promote or delete on review. Use when describing a storage surface that is not long-term.
- **Litmus test**: a single sorting question that decides which of two treatments applies. Use when documenting a judgment call with a clean binary.
