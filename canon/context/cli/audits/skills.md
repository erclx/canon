---
title: Skill audit and reach
description: The skill audit and its dated-provenance check, and the citation reach check over shipped skill bodies with its qualifier and a target's own corpus
---

# Skill audit and reach

## The skill audit

`canon claude skills audit` measures both skill corpora against `standards/skill.md`, gating on one check and reporting seven, which is the split the context audit set. Requirement presence is the fact and the rest are judgments. The gate exists because the standard required `REQUIREMENT.md` with nothing reading the rule, the shape three open issues already record.

Every measure traces to a stated line, so the report carries no rule of its own. Tracing each `Must` to a stated gap is the rule in that standard worth the most, and it needs a verdict per skill, so it is named as unmeasured rather than approximated by a count. The report names its blind spots on every run, since a list of what passed reads as a verdict on the whole standard.

The audit reads raw frontmatter rather than `listSkills`, which prefers the folder name over the declared one and can never surface a disagreement between them. The two also resolve their root differently. The listing reads its own install root and the audit reads the cwd, which is what lets a branch be measured by the checkout running it.

A clean run is the expected outcome rather than a broken check, since a preventive check reads as broken unless the report states what it measured. Its value is the regression it stops rather than a backlog it surfaces.

### Dated provenance

The seventh check reads `SKILL.md` and every `references/**/*.md` under a skill folder for an ISO date outside a fence or a code span, and reports each as `datedProvenance`. `REQUIREMENT.md` and `EVAL.md` are not read, since the skill standard sends the incident and its date to the requirement's `Gap` or to git, which makes a date there the rule working rather than a breach of it.

The skill rule drops the carve-out the context standard keeps for a date after "measured" or "verified". A context entry is a record of what the tree held when someone read it, where a skill body is an instruction a session follows today, and a measurement stamp in one is the exact shape the reporting target found. So the check does not call the context audit's private `provenance()` detector, which clears those stamps and would have passed 5 of the 26 dates the shipped corpus carried when the check landed. It runs its own date pattern over `bodyLines` and `maskDisplayed` from `src/markdown/scan.ts`, which is all the two detectors share.

It reports and never sets the failing exit. Targets run this verb, and a date in prose is a judgment a reader settles, the same reason the frontmatter measures report. Holding this repository's own count at zero is a gate stage's job rather than this verb's, and that stage is a separate row not yet built. The check reads ISO dates only, so a date in words, a month with no day, and undated provenance pass, and the Unmeasured step says so on every run.

## The citation reach check

`canon claude skills reach` asks whether a path a shipped body names is a path its reader can open. A plugin skill installs into a target and this repository's own tree is not there, so a body citing `canon/context/features/transcripts.md` sends a reader to nothing.

The measure keys on ownership rather than on existence. A cited path counts when it sits under an authoring root no install channel delivers, which `src/claude/skills-reach.ts` lists as eight prefixes covering standards, governance, the wiki, the internal tree, the tooling tree, the plugin tree, the CLI contract pages, and this narrative folder. Everything else a body might name is the reader's own tree, so `src/`, `scripts/`, and bare `docs/` are deliberately outside the list: including them would report every correct citation of the reader's own files as a defect alongside the real ones.

A seeded path is disowned twice, under its own name and under the folder spelling it takes once a target splits the entry. A domain outgrowing one file becomes `<domain>/`, still the entry the seed delivered, and reporting the split form would fail a project for growing. That single rule is what cleared `project-commands`, whose body already tests both spellings before reading either.

### Why the qualifier is a word rather than a notation

A correct citation and a defective one are the same string. What separates them is the sentence around it, so the check reads the line for the word `toolkit` and calls a citation decided when it finds one. Three bodies already spelled it that way before anything measured, which made the repair the shipped precedent rather than an invention. A parser-visible syntax was the alternative and it mints a spelling for a handful of lines while leaving those three unreadable.

The cost is that a line mentioning the toolkit for an unrelated reason exempts a citation on it. That is accepted because the check reports rather than gates, and because the failure it buys is one missed finding against a notation every future body would have to learn.

### Why it reports rather than gates

A body naming a toolkit path is sometimes correct. A toolkit-scoped instruction is meant for a session in this repository, so a gate would fail a push over a judgment the catalog already draws a line for, and the recorded split gates a fact and reports a judgment. The verb still exits 2 on an unqualified citation, which is what lets a caller branch without the aggregate treating it as a fact.

A clean run is the preventive shape the skill audit already records: what it buys is the regression it stops rather than the backlog it surfaces.

The spec names `no-skills` as an absence, which is the second tracked corpus to override the default. A project carrying neither `claude/skills/` nor `.claude/skills/` refuses the verb on every run, and reading that as unmeasured would pin the aggregate at `incomplete` there permanently. `canon claude skills audit` carries the same exposure and writes no record at all on its refusal, so the aggregate cannot tell an absent corpus from a broken verb for that one.

### What a target's own corpus changes

The check reads whichever corpus `resolveSkillsCorpus` finds, so a project holding `.claude/skills/` alone is measured rather than refused, and the refusal narrows to a tree carrying neither. What the two corpora do not share is which prefixes belong to the toolkit. A seeded path is disowned by reading `tooling/*/seeds/`, and a target carries no tooling tree at all, so nothing disowns anything there and every citation of the project's own `canon/context/` entry read as a path its reader cannot open.

`authoringRootsFor` drops the dotted roots when the corpus being read is a project's own, on the same reasoning that keeps `src/` and `scripts/` off the list: a body naming one of those describes the reader's own tree, and reporting it is a correct citation on every run. Measured on 2026-08-28 against the two live targets at 16 such citations in `career` and 5 in `life`, enough to exit 2 on both before the split.
