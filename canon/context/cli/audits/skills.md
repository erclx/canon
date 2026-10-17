---
title: Skill audit and reach
description: The skill audit and its dated-provenance, practice shape, and family checks, and the citation reach check with its qualifier
---

# Skill audit and reach

## Decisions

### The skill audit

`canon claude skills audit` measures both skill corpora against `claude/skills/create-skill/references/skill.md` and `claude/skills/create-skill/references/skill-practice.md`. It gates on one check and reports ten, the split the context audit set.

Requirement presence is the fact and the rest are judgments. The gate exists because the standard required `REQUIREMENT.md` with nothing reading the rule, the shape three open issues already record.

### The report carries no rule of its own

Every measure traces to a stated line. Tracing each `Must` to a stated gap is the most valuable rule in that standard, and it needs a verdict per skill, so it is named as unmeasured rather than approximated by a count.

The report names its blind spots on every run, since a list of what passed reads as a verdict on the whole standard.

### Raw frontmatter, not `listSkills`

`listSkills` prefers the folder name over the declared one and can never surface a disagreement between them. The two also resolve their root differently. The listing reads its own install root and the audit reads the cwd, which lets a branch be measured by the checkout running it.

### A clean run is expected

A preventive check reads as broken unless the report states what it measured. Its value is the regression it stops rather than a backlog it surfaces.

### Dated provenance

The seventh check reads `SKILL.md` and every `references/**/*.md` for an ISO date outside a fence or a code span, and reports each as `datedProvenance`. `REQUIREMENT.md` and `EVAL.md` are not read, since the skill standard sends the incident and its date to the requirement's `Gap` or to git.

### No carve-out for measurement stamps

The context standard keeps a carve-out for a date after "measured" or "verified". A context entry records what the tree held when someone read it, while a skill body is an instruction a session follows today, and a stamp in one is the shape the reporting target found.

The check therefore skips the context audit's private `provenance()` detector, which would have passed 5 of the 26 dates the shipped corpus carried. It runs its own date pattern over `bodyLines` and `maskDisplayed` from `src/markdown/scan.ts`.

### Provenance reports only

Targets run this verb, and a date in prose is a judgment a reader settles. Holding this repository's own count at zero is the Skill provenance gate stage's job.

The check reads ISO dates only, so a date in words, a month with no day, and undated provenance pass. The Unmeasured step says so on every run.

### Practice shape

The eighth check reads each skill on `PRACTICE_SKILLS` in `src/claude/skills-audit.ts` for the three closing H2s `skill-practice.md` names. It reads each skill on the wider ledger list for `references/adopted.md`, and reports each missing part as `practiceShape`.

- A listed folder the shipped corpus does not hold reports as a missing skill, since a renamed or misspelled entry would otherwise pass unread
- That half stays silent where `claude/skills/` is absent, which is every target
- A heading matches only as an exact H2 outside a fence, so an H3 or trailing words read as missing

### The list lives in the audit

A skill declaring its own kind in frontmatter could exempt itself by leaving the key off. The list is keyed by corpus-relative folder, `claude/skills/<name>`, so a target's own `.claude/skills/` folder sharing a name is never swept in.

A target cannot list its own practice skills, and the shipped standard says the shape carries no check there.

### The arrays are shared append points

Each later practice skill appends one entry. The tests in `src/claude/skills-audit.test.ts` and `src/gate/measures.test.ts` write a conforming fixture for every listed entry but the one a test varies, so an append changes only the list.

### The ledger list is wider

`LEDGER_SKILLS` spreads `PRACTICE_SKILLS` and adds `design-taste`, `write-human`, and `test-first`, which cite outside sources without a practice's closing shape. Widening the practice list would have forced the three closing sections onto bodies shaped around a craft.

A skill on the wider list alone reports a missing ledger and never a missing section. Both arrays are shared append points, and the fixtures write every ledger-listed entry.

### Practice shape reports only

The Skill practice shape gate stage fails the same finding here.

### Reference contents

The ninth check reads every file under `references/` for a `## Contents` H2 once it runs past 100 lines, and reports each as `referenceContents`. The threshold is Anthropic's skill authoring guidance for long reference files.

The count is every line the way `wc -l` prints it, frontmatter included, so a finding's number matches what a reader sees. The heading matches as an exact H2 outside a fence through one shared helper.

### The 300-line ceiling bites first

No gate stage reads this check, so a reference crossing 100 lines never fails a push. Three references sat at exactly 300 rendered lines when the check landed, so a contents list there cannot fit until the file splits, and those findings stay open.

### Family

The tenth check reads `metadata.family` from every skill under `claude/skills/` and reports a missing value, or one naming no key in `src/claude/skills-families.ts`, as `family`. The family names the skill map group a skill's row sits under, and the landing page groups its skills field by it, so the web build is the other reader.

An internal skill takes no row and no family, so the check never asks `.claude/skills/` for one.

### Short keys, prose headings

A heading is prose and a frontmatter value is not, so renaming a heading edits one constant rather than every skill in its group. Family never decides the practice list, which stays a hand list for the reason above.

The Skill family gate stage fails the same finding here.

### The citation reach check

`canon claude skills reach` asks whether a path a shipped body names is one its reader can open. A plugin skill installs into a target and this repository's tree is not there, so a body citing `canon/context/features/transcripts.md` sends a reader to nothing.

### The measure keys on ownership

A cited path counts when it sits under an authoring root no install channel delivers. `src/claude/skills-reach.ts` lists eight prefixes covering standards, governance, the wiki, the internal tree, the tooling tree, the plugin tree, the CLI contract pages, and this narrative folder.

Everything else a body names is the reader's own tree. `src/`, `scripts/`, and bare `docs/` stay off the list, since including them would report every correct citation of the reader's own files.

### A seeded path is disowned twice

A seeded path is disowned under its own name and under the folder spelling it takes once a target splits the entry. A domain outgrowing one file becomes `<domain>/`, still the entry the seed delivered, and reporting the split form would fail a project for growing.

That single rule cleared a skill whose body already tested both spellings before reading either.

### The qualifier is a word, not a notation

A correct citation and a defective one are the same string, so the check reads the line for the word `toolkit` and calls a citation decided when it finds one. Three bodies already spelled it that way before anything measured, which made the repair the shipped precedent.

A parser-visible syntax would mint a spelling for a handful of lines and leave those three unreadable.

### The word's cost

A line mentioning the toolkit for an unrelated reason exempts a citation on it. That is accepted because the check reports rather than gates, and the failure it buys is one missed finding against a notation every future body would have to learn.

### Reach reports rather than gates

A body naming a toolkit path is sometimes correct. A toolkit-scoped instruction is meant for a session in this repository, so a gate would fail a push over a judgment, and the recorded split gates a fact and reports a judgment.

The verb still exits 2 on an unqualified citation, which lets a caller branch without the aggregate treating it as a fact.

### `no-skills` is an absence

The spec names `no-skills` as an absence, the second tracked corpus to override the default. A project carrying neither `claude/skills/` nor `.claude/skills/` refuses on every run, and reading that as unmeasured would pin the aggregate at `incomplete` permanently.

`canon claude skills audit` has the same exposure and writes no record on its refusal, so the aggregate cannot tell an absent corpus from a broken verb for that one.

### A target's own corpus

The check reads whichever corpus `resolveSkillsCorpus` finds, so a project holding `.claude/skills/` alone is measured rather than refused. The refusal narrows to a tree carrying neither.

The corpora differ on which prefixes belong to the toolkit. A seeded path is disowned by reading `tooling/*/seeds/`, and a target carries no tooling tree, so nothing disowns anything there and every citation of the project's own `canon/context/` entry read as unopenable.

### Dotted roots drop for a project's corpus

`authoringRootsFor` drops the dotted roots when the corpus is a project's own, on the reasoning that keeps `src/` and `scripts/` off the list. A body naming one describes the reader's own tree.

Measured on 2026-08-28 against the two live targets, 16 such citations in `career` and 5 in `life` were enough to exit 2 on both before the split.
