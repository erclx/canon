---
title: Self-stated count sweep
description: The canon gov counts sweep, its closed catalog set, the trigger shape a count needs to be seen, and the widening that closed its live misses
---

# Self-stated count sweep

## Decisions

### What the sweep reads

`canon gov counts` reads a sentence stating how many members a closed catalog holds and compares the figure against what the tree counts. Otherwise a document going stale on its own figure is caught only by a reviewer recomputing it.

The scope is narrower than `canon/context/cli/audits/restated.md`. A number with a command behind it is in scope, and two English sentences stating one rule are not.

### Where the verb sits

The verb sits under `gov` beside `test-order`, `superseded`, and `restated`. All four measure a stated convention against the tree, and a session reaching for one finds the others.

### The catalog set is closed

The set is skills, governance rules, standards, CLI commands, and audit ids, not every list command this CLI ships. Each is read off the filesystem directly, since the module already runs inside the process a `canon` subprocess would spawn.

### A bare number was the first design

A bare number next to a catalog noun anywhere in the corpus returned 290 findings against a tree with one actionable instance. `18 rules citing a standard`, `21 skill bodies`, and `eight internal skills` pair a number with a catalog noun while naming a subset, an example, or another catalog.

### An assertion verb cut it to five

Requiring an assertion verb (`loads`, `ships`, `carries`, and nine more) directly ahead of the number took false positives from 290 to five on the same tree. Every instance the sweep was written against reads the number as the direct object of a verb asserting the catalog's own total.

### A plausibility filter closed the rest

`carries two rules about a standard's own lifecycle` and `documents two similar commands` still passed the verb gate while reading `rules` and `commands` as something other than this tree's catalogs. Magnitude told them from the live finding.

- A genuine staleness claim sits within a factor of two of the true count
- `2` beside a true count of `59` is a different `rules` entirely
- Both bounds are tuned against this one run, like the restated sweep's document-frequency ceiling

### Dates and commits read past a sentence

A sentence carrying a calendar date or a backticked commit reference is read past whole, the convention `.claude/ARCHITECTURE.md` wrote its own figures against. `canon/context/cli/overview.md` carries bare skill counts with neither marker, narrating an incident rather than a live size, and the verb gate keeps those from matching.

### Known gaps

A delta phrased as a transition, a fraction, and a total reached through an indirect noun (`denominator of sixty-one shipped skills`) are each a size claim the trigger shape does not match. Each stays a gap until a false-positive measurement says one closes.

### `commands` applies only here

`commands` is the one catalog with no meaning outside this repository, the way `regen-hero.ts` documents itself as clone-only. A tree carrying no `src/cli.ts` reads it as not applicable rather than zero, since zero would report a finding against any project stating a nonzero command count, forever.

### The first measurement

Measured against `a24b65ce` on 2026-08-27, the verb-gated run named one live stale figure and no false positive over 533 tracked markdown files. It joins the aggregate with `gatingExits: []`, since one clean run does not settle a false-positive rate.

### Article-after-noun order is open

A stale total whose sentence puts its verb after the noun is missed. Admitting an article ahead of the number reaches it, but it also reads a real subset as a claim about the whole catalog when a qualifying adjective fills the same optional slot.

### Dating closes the subset false positive

A sentence true when written and unmarked as a past state takes a date, the way `canon/ARCHITECTURE.md` dated its figures before it was retired. The date exclusion then reads it past, with no narrower qualifier rule. Correcting the figure is not available, since the number was correct for the moment it described.

### What an author must write

For a count to be seen, the sentence needs a trigger against the number, then the number, then at most one qualifying word, then the catalog's own noun.

- The trigger is one of thirteen assertion verbs (`loads`, `ships`, `carries`, `authors`, and nine more), the quantifier `all`, or an article
- `the toolkit authors 49 rules` and `took all 49 rules` are in
- `a domain of 55 skills` and `denominator of sixty-one shipped skills` are out, since a noun stands between trigger and number
- A calendar date or backticked commit puts a sentence out whatever its shape, the escape for a past state

### A code span is no shelter

The ban scan drops a code span, so a standard quoting its own banned character reports nothing. This sweep reads the span as prose, so a sentence quoting a matchable phrase reports itself. Explain the shape rather than reproducing it when writing about a stale figure.

### Findings cannot measure a widening

A finding count cannot show whether a widening reaches its target sentence. The verb reports only where a stated figure disagrees with the tree, so a target stating the true figure reads the same as a matcher that never matched it.

Both target sentences stated 69 against a true count of 69, so findings showed the two candidate axes producing identical output. Reading matched sentences is what separated them.

### Gap width closed the axis

Allowing one, two, or three words between trigger and number reaches 77, 104, and 132 sentences against a baseline of 65, over 518 files and 31,836 sentences.

- No width reaches `took all 49 rules`, whose nearest trigger is the sentence-opening `The` with five words before the number
- The width reaching `the toolkit authors 49 rules` also admits `a domain of 55 skills`, the indirect-noun shape the sweep declines
- Widening the vocabulary carries both misses at 75 sentences reached and no false positive

### Two words, not one axis

The two live misses had causes one fix could not share.

- `all` is a third trigger class and the only one stating a total outright, since `all 49 rules` names the catalog entire where `the 60 rules` leaves a qualifier to narrow it
- `authors` extends the verb vocabulary and generalizes to nothing, taken knowingly because the generalizing axis costs a named false-positive class
- `every` and `both` were measured beside `all`, reached nothing, and do not ship

### Live claim or past one

A finding splits on whether its sentence states a live claim or records a past one, the test the date exclusion runs. A live claim takes a corrected figure and a past one takes a date.
