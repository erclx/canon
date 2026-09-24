---
title: Self-stated counts
description: Reading a sentence that asserts a closed catalog's size, how a match is decided, the plausibility filter that keeps a generic word from matching a subset, and why the sweep reports rather than gates
---

# Self-stated counts

`canon gov counts` reports a sentence stating how many members a closed catalog holds where the stated figure disagrees with what the tree actually counts. A document that reports its own catalog size carries a number nothing else compares against the tree, so it goes stale on the edit that moves the catalog and reads as current until a reviewer happens to recompute it.

```bash
canon gov counts
canon gov counts --json
canon gov counts --root ../my-app
```

| Option          | Behavior                                                   |
| --------------- | ---------------------------------------------------------- |
| `--root <path>` | Tree to read, defaulting to the current directory          |
| `--json`        | Add a machine-readable record on stdout, keeping the frame |

Under `--json` the record holds stdout alone and the frame still renders on stderr, refusals included, which is the split `output-shape.md` fixes for every mode.

## The catalogs it reads

A closed set of six, each with a filesystem reader behind it rather than every list command this CLI ships:

- `skills`: shipped plugin skills, a folder per `claude/skills/*/SKILL.md`
- `rules`: authored governance rules, a file per `governance/rules/**/*.md`
- `standards`: the authoring corpus at `standards/`
- `snippets`: distinct entries across every `snippets/` category, matching what `regen-hero.sh` counts
- `commands`: top-level `canon` commands, read off `src/cli.ts`'s registration imports
- `audits`: the registered set in `src/audits/catalog.ts`, this entry included

The set is closed rather than derived, so widening it is a deliberate change to this file rather than a side effect of a new list command shipping elsewhere. `commands` is the one catalog with no meaning outside this repository: a project installing this CLI carries no `src/cli.ts` of its own, and that catalog reads as not applicable there rather than as zero, since zero would report a finding against any such project stating its command count as anything but zero, forever.

## How a match is decided

A sentence has to carry an assertion verb (`loads`, `ships`, `carries`, `holds`, `counts`, `totals`, `documents`, `declares`, `installs`, `lists`, `contains`, `comprises`, `authors`), the quantifier `all`, or an article (`the`, `a`, `an`) immediately ahead of the number, which is immediately ahead of the catalog noun, with one optional qualifying word between the number and the noun (`sixty-one shipped skills`). The number reads either as digits or as a spelled-out cardinal through ninety-nine, since this corpus states a catalog size in words as often as in digits.

Nothing stands between the trigger and the number, which is the rule an author writing a new count has to know. It separates `the toolkit authors 81 rules` and `took all 81 rules`, both read, from `a domain of 55 skills` and `denominator of sixty-one shipped skills`, neither of them read. A figure meant as a past state takes a date in the same sentence instead, which reads the sentence past whatever its shape.

## How the trigger set grew

The verb gate is not the first design tried. A bare number next to a catalog noun anywhere in the tracked corpus returned 290 findings against a repository whose actionable instance count was one. Reading that run showed why: `18 rules citing a standard`, `21 skill bodies`, and `eight internal skills` all pair a number with a catalog noun while naming a subset, an example, or a different catalog than the one matched, and that shape dominates ordinary prose. Every instance this sweep was written against reads the number as the direct object of a verb asserting the catalog's own total, and gating on that verb is what took the false-positive count from 290 to five on the same tree.

The article half was added after a first review of the shipped design found a live miss: `canon/context/development/gates.md` stated a stale audit total while the tree held 20, and the verb gate never reached it, since that sentence puts its verb after the noun rather than ahead of the number. Widening the trigger set to admit an article ahead of the number closed that gap.

The quantifier `all` and the verb `authors` joined on the same evidence, two more live misses failing only the trigger test. Allowing words to stand between the trigger and the number was the other candidate, measured and declined: at widths of one, two, and three it reached 77, 104, and 132 sentences against a baseline of 65, missed `took all 81 rules` at every width, and reached `the toolkit authors 81 rules` only at a width admitting the indirect-noun shape below. The two words reach both at 75 sentences and no false positive.

## The plausibility filter

The verb gate alone still left four false positives standing: `carries two rules about a standard's own lifecycle`, `holds one rule or one fact` (twice, once per mirrored copy), and `documents two similar commands`. Each pairs an assertion verb with a catalog noun used for something the `rules` or `commands` catalog does not mean, and what tells those apart from the one live finding is magnitude: a catalog this sweep tracks drifts by a few members between the day a sentence was written and the day it is read, so a genuine staleness claim sits near the true count. `2` beside a true count of `59` is not a catalog that shrank, it is a different `rules` entirely.

A stated figure is read only when it sits within a factor of two of the true count, in either direction. That bound is tuned against the run this sweep was written against rather than reasoned to from first principles, the way `restated.ts` tunes its own document-frequency ceiling, and it is a property of the scale every catalog here sits at (the tens) rather than a universal rule.

The article gate is looser than the verb list and carries a real cost. Re-running against the tree once it widened caught the live miss above and also misread a passage in `canon/context/standards/destinations.md` naming a real subset, a standard outside the retired `standards/bundled/` fan-out, as a claim about the whole standards catalog. The qualifying adjective there fills the same optional-word slot `sixty-one shipped skills` needs to match at all, and no syntactic rule tells a qualifier that narrows a catalog from one that only restates it. The finding could not be closed by correcting a figure, since the sentence was true when the corpus held it, only unmarked as a past state, which is the class the date exclusion already reads past. Naming the moment, the same way `canon/ARCHITECTURE.md` dates its own figures, closed it with no change to the matcher.

## What it does not measure

A delta phrased as a transition (`from fourteen to fifteen`), a fraction (`thirteen of sixteen`), and a total reached through an indirect noun (`denominator of sixty-one shipped skills`) are all catalog-size claims this corpus carries, and none matches the trigger shape this reads. Each stays a known gap. The false-positive rate that gated closing them has a measurement behind it now, and what it showed is that the widening these three need is the one that costs a false positive rather than the one that does not.

A second figure in a sentence whose first figure already matched is a fourth gap and a structural one, since one match is taken per catalog per sentence. `authors 81 rules under governance/rules/ and consumes 62 into .claude/rules/` is read for its 81 alone, which is correct here because the two figures name different populations, and a sentence stating one catalog twice would go unread the same way.

A calendar date (`2026-08-21`) or a backticked commit reference in the same sentence reads the whole sentence past, since that is how this corpus already marks a figure as a historical record rather than a live claim. `canon/ARCHITECTURE.md` and the context entries carry a figure this way deliberately, and every one of them stays correct forever.

The wider check over prose restatements is deliberately out of reach here. `canon gov restated` already records a parser over prose as rejected, and this sweep reaches a number with a command behind it rather than two sentences a reader has to judge as agreeing.

## Exit codes

Exit codes are `0` when no stated figure disagrees with the tree, `1` for a refusal, and `2` for at least one disagreement.

Nothing wires this into `bun run check` or into a hook. The false-positive rate is read off the first real run rather than assumed ahead of it, and gating a measure with an unmeasured rate is what teaches a contributor to route around the stage. `canon gov restated` and `canon gov test-order` are the siblings this reasoning already governs.

Both refusals are breaks rather than absences. A tree with no git history or no markdown file at all is a broken checkout, matching what `canon markdown audit` already reads `no-git` and `no-markdown` as, since this sweep shares that corpus.

An exit code says nothing about a call made from a session, since a shell profile may wrap the binary in a function taking its status from a later command. Read the record's `findings` rather than the exit when a skill consumes this.
