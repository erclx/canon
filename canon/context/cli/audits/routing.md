---
title: Routing measures
description: The skill routing rank over the case corpus, its tokenizer and unmeasurable cases, and the CLAUDE.md routing report
---

# Routing measures

## The skill routing rank

`canon claude skills rank` scores the shipped catalog's frontmatter descriptions against a hand-authored case corpus at `src/claude/cases/`, one prompt per case naming the skill it should reach. TF-IDF cosine similarity over the tokenized description is the mechanism. It joins the aggregate with an empty `gatingExits`, since the corpus is a first run with no baseline to fail a push against and the score bounds a necessary condition rather than reporting real routing behavior.

The tokenizer strips a fixed stopword list and every word three characters or under before scoring. A prompt built entirely from such words, `what do you need from me` among them, vectorizes to nothing, so cosine similarity would read 0 against every skill and a naive sort would fall through to `localeCompare`, deciding by name rather than by content. No description edit closes a miss shaped that way, only the stopword list or the prompt can. `decision-escalate`'s own miss on that exact phrase took this shape, closed by dropping `need` from the list rather than by rewording the skill.

That fallback is a defect in the instrument rather than only in the one description it happened to catch. A tie-break over an all-zero score set hands the win to whichever skill sorts first alphabetically, so a case whose expected skill happens to be that one reports a false rank-one rather than the unmeasured result it actually is. `buildModel.rank` returns an empty ranking for a prompt whose token vector is empty, and `measureCases` sorts that case into `unmeasurable` rather than crediting it toward `rank1`, `top3`, or `misses`. `canon claude skills rank --json` carries the count separately from `misses`, since it names a gap in what the run could measure rather than a routing collision the catalog itself carries.

A phrase two skills can each plausibly claim is settled by the operation it names rather than by whichever skill's description happens to quote it first. `canon-operator` calls itself the toolkit's front door and quotes `install rules` among its own triggers, and `target-setup` is the skill that runs that install, so a phrase naming the install wins for `target-setup` even though the front door's own words match it too. The corpus asserts that pairing on a case of its own.

A separate miss is a different prompt and stays open. `canon-operator` still loses `I don't know which specific toolkit skill I need, just handle it for me.` to `create-skill` at rank 2, and that prompt names no operation, so the rule above predicts nothing about it. Closing it needs its own read rather than riding on this one.

The verb reads a target as well. `resolveSkillsCorpus` in `src/claude/skills-list.ts` answers which corpus a root carries, taking `claude/skills/` ahead of `.claude/skills/` in `CORPORA` order, so every reading taken in this repository is the one it always was and a project holding its own skills alone is measured for the first time. `--cases <path>` replaces the toolkit corpus with a JSON array of `{ prompt, expect }` objects in the shape `src/claude/cases/` already holds, because a project's own skills need its own prompts and a corpus written against a catalog it did not author scores vocabulary it never uses. No standard stands behind the file until a third project needs one, and an empty array refuses rather than scoring 0 of 0, which a reader takes for a clean pass.

The resolver sits beside `listSkills` rather than inside it. `src/counts/catalogs.ts` counts the shipped catalog through that function, so widening the function itself would take the reported total from 62 to 70, falsify every sentence in the corpus stating what ships, and move `assets/captures/hero.html` with it. A measure that reaches a target resolves its own corpus and the counter keeps reading the tree that installs.

## The routing report

`canon claude routing` reports per `CLAUDE.md` section how many top-level bullets name a path and how many of those a path-scoped rule already covers. It answers what the always-loaded file is paying for, which the tier test in `592-claude-md` decides case by case.

Two readings decide what it says, and both are narrower than they sound. A bullet counts as path-scoped when it names a path, which is evidence for the tier judgment rather than the judgment itself, so a bullet naming a folder can still apply every session and one firing on a path it never spells is invisible here. `src/claude/routing.ts` states that where a reader meets the function, since a count phrased as a verdict is the shape this measure is easiest to misread as.

A rule counts as covering a path only when its glob anchors to a location. A glob opening `**` reaches every folder in the tree, so it answers that a file type is governed and never that a named path is: admitting one would collapse the column to every markdown path, which `801-markdown` does. Excluding it is what lets the column separate a folder somebody scoped a rule to from one nobody has.

A shape such as `canon/context/<domain>.md` reads as the folder above its placeholder rather than as nothing, which is what keeps the scratch and memory sections from reporting as naming no path at all. A placeholder opening the first segment has no openable prefix and is dropped.

The glob list is read out of the frontmatter block alone, rather than the whole file, since a body bullet quoting a path would otherwise register as a scope the rule never declared.
