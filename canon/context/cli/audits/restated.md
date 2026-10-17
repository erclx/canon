---
title: Restated-instruction sweep
description: The canon gov restated sweep, its asymmetric surfaces, recall-first matching, polarity, and rules read as both subject and candidate
---

# Restated-instruction sweep

## Decisions

### Why a sweep for restated instructions

`canon gov restated` counts the instructions this repository's always-loaded file shares with the seed and the skill bodies. A rule stated in three places can drift out of step until a shipped skill acts against the version it loaded, so the value is catching the next drift.

### A path-scoped rule cannot express it

The trigger is changing the text of an instruction, which fires on no path a glob can name. A command that sweeps is the only shape left, the argument the superseded sweep makes about its own key.

### Where the verb sits

It sits under `gov` beside `test-order` and `superseded`. All three measure a stated convention against the tree, and a session reaching for one finds the others.

### Surfaces are read asymmetrically

Every top-level bullet in `CLAUDE.md` or in a rule is a subject. The seed, the skill bodies under both skill roots, and every rule again are searched against it, so a rule stated in two skill bodies and never in the always-loaded file or another rule is outside the reading.

### A body is read as prose

The motivating instruction reached `claude/skills/context-fold/SKILL.md` as a paragraph, so a bullet-only read would have missed the one instance the sweep exists for.

### Matching is recall-first

Matching keys on shared distinctive tokens rather than a phrase two surfaces spell the same way. Near-exact was cheaper and misses the motivating case by construction, since that instance was one rule written three different ways.

Recall-first narrows from real output, where precision-first cannot widen without a rebuild.

### Backticked tokens count double

An author marking a span as code named an identifier rather than describing one. The weighting lets the match floor rise high enough to drop a coincidental word pair without losing a rule two surfaces spelled differently around one shared path.

### The knobs are tuned, not derived

`.canon/plans/` sits at 14 statements and anchors the motivating case, while `file` sits at 371 and matches most of the tree. The ceiling sits at 20, since cutting it to 12 would drop the real third surface while keeping a two-word coincidence.

### Frontmatter is skipped

Skipping body frontmatter took the candidate corpus from 2543 statements to 2412. A `description` restates that skill's own purpose in every body, so sweeping it matched each skill against any subject naming its domain.

### Mirrors are excluded by path pair

`CLAUDE.md` and `tooling/claude/seeds/CLAUDE.md` are the one declared pair. The duplication is a location fact the architecture record carries, and a content test would rediscover it every run.

The exclusion reaches a repetition alone. A mirror is meant to agree, so a polarity split on a declared pair stays a finding.

### The contradiction floor sits above the match floor

A thin match says two statements touch one subject, which is not enough to claim one forbids what the other prescribes. At the match floor the class held 15 entries, nearly all coincidence.

### Polarity reads one clause

Polarity is read off the clause the anchors landed in, and off the densest such clause rather than the union of every one carrying an anchor. A union answers true whenever any clause anywhere carries a marker, which is the whole statement again.

### The marker must open its clause

An instruction leads with its verb. `Never delete a task file` prohibits where `a fallback never fires` reports, and no test reading the marker anywhere in the clause separates them.

### The position rule

Both rules answer one class of false positive. The always-loaded file splits the stream-editor rule across two bullets where the seed folds them into one, so the subject can be the exception half alone while the seed's bullet carries a `never` from a clause the anchors never touch.

### What the position rule costs

A prohibition written mid-clause, as in `edit with the tool, never a stream editor`, now reads as description. That lands the pair in the repetition class rather than dropping it, so both surfaces still reach the report and only the label is weaker.

Polarity is a reading, not a judgment about meaning. Detecting that a skill does the opposite of what a rule states needs a reader, so the report names both surfaces and the anchors and leaves the verdict to one.

### Authority can be unknown

The content-ownership table assigns a cross-domain rule and a domain-triggered one and reaches nothing stated in a body the always-loaded file never names. Reporting `unknown` there is a first-class answer, since guessing would put a reader on a surface nobody decided.

### What the aggregate retains

It retains the contradiction and repetition counts and drops the mirrors, as the label audit drops its declined rows. It also drops the three-surface reach count, which measures how many surfaces an instruction reached and moves in lockstep with the two retained.

### Both refusals read as absences

This is the third tracked corpus taking that allowance, beside the secret scan and the reach check. A target holds neither the seed nor a shipped skills tree, so without it every project installing this CLI reports the verb unmeasured forever.

### The first measurement

Measured against `5da3214d` on 2026-08-25, the run read 85 instructions against 2412 statements from the seed and 61 shipped bodies.

- No contradiction
- 53 repetitions outside a declared mirror and 43 on one
- 18 instructions reaching three surfaces or more

Zero contradictions is the correct reading, not a class that cannot fire, since the unit cases hold the directive shape the class exists for.

### Rules are a third source

The corpus reads `governance/rules/`, the authoring root rather than the copy under `.claude/rules/`. A stack takes a whole rule folder, so a bullet landing anywhere under it ships to every target the stack reaches, as a bullet in the always-loaded file does.

Without it, a bullet moved from `CLAUDE.md` into `governance/rules/claude/` reads as no longer restated, rather than still shipping under a different carrier.

### A rule is subject and candidate

The seed and the shipped bodies stay candidate-only. The always-loaded file and a rule both state a directive directly, so the corpus must compare two rules against each other.

That catches the shape that motivated this row. A retired rule's `## CLAUDE.md editing` section restated two instructions a second retired rule carried, and neither was ever a bullet in `CLAUDE.md`, so no subject existed until rules joined that side.

### Pairs are keyed unordered

One kind holding both roles risks reporting a pair twice, once with each end as the subject. An unordered key over the two statements' `file:line` is recorded when a pair first clears the anchor floor and checked before every later attempt.

The pair a reader meets names whichever direction the subject loop reached first, and the reverse never surfaces.

### Same-file candidates are skipped

Two bullets inside one rule file routinely share anchors, being adjacent instructions on one topic rather than one rule shipped twice. A candidate sharing its subject's file is skipped outright instead of left to the matcher.

### The widened run

Measured against `5196cc9a` on 2026-08-27, the widened run read 45 always-loaded instructions and 66 rule files against 3055 statements.

- 0 contradictions and 5 repetitions on a mirror
- 86 repetitions outside a declared mirror, recorded in `canon/config/baseline.json` as the floor for `repetitions`
- 18 instructions reaching three surfaces or more
- Thirteen of the 86 are a rule restating a different rule, a class the narrower corpus could never produce

### Reach reads clusters

A rule sitting on both sides lets one duplicated instruction fragment across several entries once the pair-skip strips an already-seen edge. `countThreeSurfaceClusters` in `src/gov/restated.ts` unions every reported pair and counts a component once, however many entries it fragmented into.

Each entry's own `surfaces.length` would double-count a cluster fragmenting across more than one entry.

### Rule roots are shared

Rules are read from every root in `RULE_DIRS`, shared with `src/gov/citations.ts`, so `internal/rules/` joins `governance/rules/` on both sides. Each statement carries its root in `file`, and the same-file skip compares the full path, so two same-named rules under the two roots still pair.

`internal-rule-audit` read that folder's restatements by grep until this closed the gap.

### Internal skills are candidates

`.claude/skills/*/SKILL.md` joins `claude/skills/` as a candidate root and stays candidate-only. In a target that folder holds the project's own skills, equally a place a rule gets restated, so a target carrying its own skills measures rather than refusing `no-surfaces`.

An internal body routinely quotes the rule it helps edit, so those pairs are the verb reporting correctly rather than noise to tune against.

### Internal authority reads unknown

`authorityFor` looks for the skill's folder name in the subject, and an `internal-*` name almost never appears there verbatim.

### A leading `no` reads as a prohibition

A `no` opening a clause or a comma-set phrase directly on a code span counts beside the clause-opening markers. It answers the one contradiction reported at `e5766988`, where `ci-workflow.md` saying never `@latest` and the `ci-workflow` body saying no `@latest` agree.

`not` and `never` in that position were tried and dropped. Each turned an agreeing pair into a new contradiction, such as a body saying not `pwd` against a rule negating plain words.

### The latest read

Measured against `e5766988` on 2026-09-26, the run read 34 instructions and 83 rule files against 4199 statements from the seed, 96 skill bodies, and every rule again.

| Reading                | After widening | Before |
| ---------------------- | -------------- | ------ |
| Rule files             | 83             | 74     |
| Skill bodies           | 96             | 85     |
| Statements             | 4199           | 3817   |
| Contradictions         | 0              | 1      |
| Repetitions            | 126            | 109    |
| Three-surface clusters | 25             | 23     |

Nineteen earlier pairs dropped out as the larger corpus pushed an anchor past the ceiling, eight of them `ci-workflow.md` against `ci-workflow`, so the change is not additions alone. The run read 0 mirrors.
