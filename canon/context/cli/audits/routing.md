---
title: Routing measures
description: The skill routing rank over the case corpus, its tokenizer and unmeasurable cases, and the CLAUDE.md routing report
---

# Routing measures

## Decisions

### The skill routing rank

`canon claude skills rank` scores the shipped catalog's frontmatter descriptions against a hand-authored case corpus at `src/claude/cases/`, one prompt per case naming the skill it should reach. The mechanism is TF-IDF cosine similarity over the tokenized description.

### It does not gate

It joins the aggregate with an empty `gatingExits`. The corpus is a first run with no baseline to fail a push against, and the score bounds a necessary condition rather than real routing behavior.

### The tokenizer drops short words

It strips a fixed stopword list and every word three characters or under before scoring. A prompt built entirely from such words, `what do you need from me` among them, vectorizes to nothing and reads 0 against every skill.

No description edit closes a miss shaped that way, only the stopword list or the prompt can. `decision-escalate`'s miss on that phrase was closed by dropping `need` from the list.

### An all-zero tie is a defect in the instrument

A naive sort falls through to `localeCompare`, so a case whose expected skill sorts first alphabetically reports a false rank-one in place of the unmeasured result it is.

- `buildModel.rank` returns an empty ranking for a prompt whose token vector is empty
- `measureCases` sorts that case into `unmeasurable`, not toward `rank1`, `top3`, or `misses`
- `--json` carries the count apart from `misses`, since it names a gap in what the run could measure rather than a routing collision

### The operation decides a shared phrase

A phrase two skills can each plausibly claim is settled by the operation it names. `target-setup` runs the install, so a phrase naming the install wins for it even when another skill's words quote `install rules` too. The corpus asserts that pairing on a case of its own.

### The verb reads a target

`resolveSkillsCorpus` in `src/claude/skills-list.ts` answers which corpus a root carries. `CORPORA` order takes `claude/skills/` ahead of `.claude/skills/`, so every reading in this repository is the one it always was and a project holding its own skills alone is measured for the first time.

### `--cases` replaces the corpus

`--cases <path>` takes a JSON array of `{ prompt, expect }` objects in the shape `src/claude/cases/` holds. A project's own skills need its own prompts, and a corpus written against a catalog it did not author scores vocabulary it never uses.

No standard stands behind the file until a third project needs one. An empty array refuses rather than scoring 0 of 0, which a reader takes for a clean pass.

### The resolver sits beside `listSkills`

`src/counts/catalogs.ts` counts the shipped catalog through that function. Widening it would take the reported total from 62 to 70, falsify every sentence stating what ships, and move `assets/captures/hero.html` with it.

A measure that reaches a target resolves its own corpus, and the counter keeps reading the tree that installs.

### The routing report

`canon claude routing` reports per `CLAUDE.md` section how many top-level bullets name a path and how many of those a path-scoped rule already covers. It answers what the always-loaded file is paying for, which the tier test in `canon/context/context-model/overview.md` decides case by case.

### A named path is evidence, not the judgment

A bullet naming a folder can still apply every session, and one firing on a path it never spells is invisible here. `src/claude/routing.ts` states that where a reader meets the function, since a count phrased as a verdict is the shape this measure is easiest to misread as.

### A glob must anchor to a location

A glob opening `**` reaches every folder, so it answers that a file type is governed and never that a named path is. Admitting one would collapse the column to every markdown path, which `governance/rules/writing/markdown.md` does.

Excluding it lets the column separate a folder somebody scoped a rule to from one nobody has.

### Placeholders read as their folder

`canon/context/<domain>.md` reads as the folder above its placeholder, which keeps the scratch and memory sections from reporting as naming no path. A placeholder opening the first segment has no openable prefix and is dropped.

### Globs come from frontmatter alone

Reading the whole file would register a body bullet quoting a path as a scope the rule never declared.
