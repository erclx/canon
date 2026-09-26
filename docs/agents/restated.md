---
title: Restated instructions
description: Counting the instructions the always-loaded file and every path-scoped rule share with the seed, the skill bodies, and each other, how a match is decided, the three classes, which surface a later edit starts from, and why the sweep reports rather than gates
---

# Restated instructions

`canon gov restated` reports every instruction the always-loaded file or a path-scoped rule states that a further surface states too. It answers a question nothing else here could: one rule was found written in three places, and it was found by accident when a shipped skill deleted a file the rule said to keep.

```bash
canon gov restated
canon gov restated --json
canon gov restated --root ../my-app
```

| Option          | Behavior                                                   |
| --------------- | ---------------------------------------------------------- |
| `--root <path>` | Tree to read, defaulting to the current directory          |
| `--json`        | Add a machine-readable record on stdout, keeping the frame |

Under `--json` the record holds stdout alone and the frame still renders on stderr, refusals included, which is the split `output-shape.md` fixes for every mode.

## The corpus it reads

Four surfaces, and they are not read symmetrically. Every top-level bullet in `CLAUDE.md` and in every path-scoped rule is a subject, and every surface below is searched, rules included a second time:

- `tooling/claude/seeds/CLAUDE.md`, read as bullets, since the seed carries the same shape as the file it is authored from
- `claude/skills/*/SKILL.md` and `.claude/skills/*/SKILL.md`, read as every prose line and bullet, since the motivating case was stated in a body as a paragraph rather than a list item. The second root holds the project's own skills, which are equally a place a rule gets restated
- `governance/rules/**/*.md` and `internal/rules/**/*.md`, the authoring roots rather than the consumed copy under `.claude/rules/`, read as bullets the same way the seed is. Each record's `file` carries the root it was read from

A rule reads as both a subject and a candidate, unlike the seed and the skill bodies. A stack ships a whole rule folder, so a bullet duplicated between two rules reaches a target exactly as a bullet duplicated between the always-loaded file and a rule does, and neither shape is visible from one side alone. A candidate sharing its subject's file is skipped, since two bullets inside one rule sharing anchors are adjacent instructions on one topic rather than the same rule shipped twice, and a pair found from one direction is not reported again from the other.

Frontmatter, headings, tables, and fenced blocks are read past. A heading names a section instead of stating a rule, a fenced block is an example whose words belong to the prose around it, and a body's `description` restates that skill's own purpose, so sweeping it would match every subject naming its domain.

A rule stated in two skill bodies and never in `CLAUDE.md` or another rule is outside this reading. A body is searched but never read as a subject, and a subject is what the search runs from.

## How a match is decided

Matching is recall-first and keyed on shared distinctive tokens rather than on a phrase two surfaces spell the same way. The case this exists for was one rule written three different ways, so a near-exact matcher would ship a cheap report blind to the defect it was built for.

A token is distinctive when it appears in at most 20 of the corpus's statements, which is under one percent of them. `.canon/plans/` sits at 14 and is the anchor the motivating case turns on, while `file` sits at 371 and would match most of the tree.

A backticked token counts double. An author marking a span as code named an identifier rather than describing one, so `.canon/plans/archive/` says more about what a statement governs than any two prose words do. Two statements are one rule when their shared anchors reach a weight of 3.

Every record names the anchors its match rested on, so a reader can weigh a finding instead of taking it.

## The three classes

- **Mirror.** Both files sit on a declared path pair whose duplication is deliberate. `CLAUDE.md` and the seed are the one pair, since the seed is authored from it and `seed-sync` exists to reconcile the two. Excluding by pair rather than by content is the point: the duplication is a location fact this repository already records, and a content test would rediscover it on every run.
- **Repetition.** Two surfaces state one rule and neither is declared a copy of the other.
- **Contradiction.** The prohibition falls on one surface alone, on a match strong enough to read that as a disagreement. This is a polarity reading rather than a judgment about meaning, so weigh each against the surfaces it names.

The contradiction floor sits above the match floor deliberately. A thin match says two statements touch the same subject, which is not enough to claim one forbids what the other prescribes, so a weak pair reports as a repetition and the loudest class is reserved for a pair sharing real identity.

Two further rules decide where a prohibition counts, and both came out of false positives rather than from reasoning ahead of the corpus.

Polarity is read off the clause the anchors landed in, and off the densest such clause rather than every one carrying an anchor. A statement states one rule across several clauses, so a union answers true whenever any clause anywhere carries a marker, which is the whole statement again under another name.

The marker also has to open its clause, because an instruction leads with its verb. `Never delete a task file` prohibits where `a fallback never fires` reports, and no test reading the marker anywhere in the clause tells those apart. What that costs is a prohibition written mid-clause, which now reads as description and lands the pair in the repetition class, so both surfaces still reach the report and only the label is weaker.

One mid-clause shape still counts. A `no` opening a clause or a comma-set phrase directly on a code span prohibits, as in `pinned to major tags, no` followed by the pinned tag, since sitting on an identifier it names what is ruled out. The phrase boundary keeps description out: `returns no` then a code span puts the marker after a verb and reports what happens. `not` and `never` in the same position are left out, because admitting them turned agreeing pairs into false contradictions.

A mirror that disagrees stays a finding. The exclusion reaches a repetition alone, because the two files on a declared pair are meant to agree.

## Which surface is authoritative

Each restatement names where a later edit starts.

- `claude-md` for a seed match, since the always-loaded file is authored first and the seed carries it to a target
- `skill-body` where the subject names that skill, which is the content-ownership rule that behavior triggered only when editing one domain belongs to that domain's skill
- `unknown` everywhere else, a rule match included, which is a first-class answer rather than a gap

The ownership table assigns a cross-domain rule and a domain-triggered one, and reaches nothing stated in a skill body the always-loaded file never names. Guessing there would put a reader on a surface nobody decided.

## Exit codes

Exit codes are `0` when no instruction is restated outside a declared mirror, `1` for a refusal, and `2` for at least one restatement outside one. Mirrors move no exit code.

Nothing wires this into `bun run check` or into a hook. A restatement is legitimate more often than not, and gating a measure whose ordinary result is a finding is what teaches contributors to route around the stage. `canon gov test-order` and `canon labels audit` are the siblings.

Both refusals are absences rather than breaks. A target may hold none of the seed, a skills tree, or a rules tree, so `canon audits run` reads `no-instructions` and `no-surfaces` as a corpus that is not there rather than a verb that failed.

An exit code says nothing about a call made from a session, since a shell profile may wrap the binary in a function taking its status from a later command. Read the record's `counts` rather than the exit when a skill consumes this.
