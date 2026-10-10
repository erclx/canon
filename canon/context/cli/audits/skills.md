---
title: Skill audit and reach
description: The skill audit with its dated-provenance, practice shape, reference contents, and family checks, and the citation reach check over shipped skill bodies with its qualifier and a target's own corpus
---

# Skill audit and reach

## The skill audit

`canon claude skills audit` measures both skill corpora against `standards/skill.md` and `claude/skills/create-skill/references/skill-practice.md`, gating on one check and reporting ten, which is the split the context audit set. Requirement presence is the fact and the rest are judgments. The gate exists because the standard required `REQUIREMENT.md` with nothing reading the rule, the shape three open issues already record.

Every measure traces to a stated line, so the report carries no rule of its own. Tracing each `Must` to a stated gap is the rule in that standard worth the most, and it needs a verdict per skill, so it is named as unmeasured rather than approximated by a count. The report names its blind spots on every run, since a list of what passed reads as a verdict on the whole standard.

The audit reads raw frontmatter rather than `listSkills`, which prefers the folder name over the declared one and can never surface a disagreement between them. The two also resolve their root differently. The listing reads its own install root and the audit reads the cwd, which is what lets a branch be measured by the checkout running it.

A clean run is the expected outcome rather than a broken check, since a preventive check reads as broken unless the report states what it measured. Its value is the regression it stops rather than a backlog it surfaces.

### Dated provenance

The seventh check reads `SKILL.md` and every `references/**/*.md` under a skill folder for an ISO date outside a fence or a code span, and reports each as `datedProvenance`. `REQUIREMENT.md` and `EVAL.md` are not read, since the skill standard sends the incident and its date to the requirement's `Gap` or to git, which makes a date there the rule working rather than a breach of it.

The skill rule drops the carve-out the context standard keeps for a date after "measured" or "verified". A context entry is a record of what the tree held when someone read it, where a skill body is an instruction a session follows today, and a measurement stamp in one is the exact shape the reporting target found. So the check does not call the context audit's private `provenance()` detector, which clears those stamps and would have passed 5 of the 26 dates the shipped corpus carried when the check landed. It runs its own date pattern over `bodyLines` and `maskDisplayed` from `src/markdown/scan.ts`, which is all the two detectors share.

It reports and never sets the failing exit. Targets run this verb, and a date in prose is a judgment a reader settles, the same reason the frontmatter measures report. Holding this repository's own count at zero is the Skill provenance gate stage's job rather than this verb's. The check reads ISO dates only, so a date in words, a month with no day, and undated provenance pass, and the Unmeasured step says so on every run.

### Practice shape

The eighth check reads each skill on `PRACTICE_SKILLS` in `src/claude/skills-audit.ts` for the three closing H2s `claude/skills/create-skill/references/skill-practice.md` names, and each skill on the wider ledger list below for `references/adopted.md`, reporting each missing part as `practiceShape`. A listed folder the shipped corpus does not hold reports as a missing skill, since the walk only reaches folders that exist and a renamed or misspelled entry would otherwise pass unread. That half stays silent where `claude/skills/` is absent, which is every target. A heading matches only as an exact H2 outside a fence, so an H3 or a heading carrying trailing words reads as missing, and a skill renaming toward the shape owes the exact spelling.

The list lives in the audit rather than in a skill's frontmatter, because a skill declaring its own kind could exempt itself by leaving the key off. It is keyed by corpus-relative folder, `claude/skills/<name>`, so a target's own `.claude/skills/` folder sharing a name is never swept in. The cost is that a target cannot list its own practice skills, and the shipped standard says the shape carries no check there. Each later practice skill appends one entry, which makes the array a shared append point across the rows that add one. The tests in `src/claude/skills-audit.test.ts` and `src/gate/measures.test.ts` write a conforming fixture for every listed entry but the one a test varies, so an append changes only the list.

The ledger reads a second list, `LEDGER_SKILLS`, which spreads `PRACTICE_SKILLS` and adds the skills that cite outside sources without a practice's closing shape, being `design-taste`, `write-human`, and `test-first`. Widening the practice list instead would have forced the three closing sections onto bodies shaped around a craft rather than a practice a session cuts short. A skill on the wider list alone reports a missing ledger and never a missing section, and the missing-skill half walks the wider list. Both arrays are now shared append points, and the fixtures write every ledger-listed entry.

It reports and never sets the failing exit, for the reason provenance does. The Skill practice shape gate stage fails the same finding here.

### Reference contents

The ninth check reads every file under `references/` for a `## Contents` H2 once it runs past 100 lines, reporting each as `referenceContents`. The threshold is Anthropic's skill authoring guidance for long reference files, and the count is every line of the file the way `wc -l` prints it, frontmatter included, so the number a finding names matches what a reader sees beside it. The heading matches as an exact H2 outside a fence, the same reading the practice sections take, through one shared helper.

It reports and no gate stage reads it, so a reference crossing 100 lines never fails a push. The 300-line document ceiling is the constraint that bites first: three references sat at exactly 300 rendered lines when the check landed, so a contents list there cannot fit until the file splits, and those findings stay open.

### Family

The tenth check reads `metadata.family` from every skill under `claude/skills/` and reports a missing value, or one naming no key in `src/claude/skills-families.ts`, as `family`. The family names the skill map group a skill's row sits under, and the landing page groups its skills field by the field, so the web build is the other reader. An internal skill takes no row and no family, so the check never asks `.claude/skills/` for one.

The vocabulary keeps short keys apart from the map's headings. A heading is prose and a frontmatter value is not, so renaming a heading edits one constant rather than every skill in its group. Family never decides the practice list, which stays a hand list for the reason that section gives.

It reports and never sets the failing exit. The Skill family gate stage fails the same finding here.

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
