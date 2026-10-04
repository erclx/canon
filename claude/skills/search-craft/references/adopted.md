---
title: Adopted and declined
description: Which comparable research skills this skill was read against, what it took from them, what it declined, and which of its rules rest on measurement rather than a source
---

# Adopted and declined

Three third-party research skills were read before this one was written. None of them was imported, and most of the body rests on paired searches measured in this skill's `REQUIREMENT.md` rather than on any of them. A later session extending the skill adds to this file rather than re-arguing an item settled here.

## Adopted

**Recording each route's failure.** [aghori3004/claude-research-stack](https://github.com/aghori3004/claude-research-stack) keeps one `research-sources` skill that orders sources cheapest first and writes down how each one fails. Adopted as the access note, which records a refusal a session hit rather than leaving the next session to learn it by failing.

**Calling the tools directly.** The same skill ships no wrapper scripts, so it calls the command-line tools and servers it names. Adopted as the rule to reach a keyless API with a plain request rather than writing a wrapper for one search.

**Treating a paid route as the operator's call.** [rohunvora/x-research-skill](https://github.com/rohunvora/x-research-skill) reaches X through the official API at a cost per search page. Adopted as the stop before any route that pays or logs in, since that cost is one the operator decides rather than one a session discovers.

## Declined

**A directory of sites per category.** None of the three is one, and each earns its keep on access and cost instead. A site list also rots with nobody noticing, so the body derives a field's authorities per question rather than reading them off a list.

**Reaching walled sites through a logged-in browser.** `claude-research-stack` reaches Reddit and X through a desktop Chrome session holding the operator's login. Declined because the body never suggests working around a login.

**A bundled engine.** [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) is a Python engine with its own test suite and paid aggregators behind it. Declined because a skill here ships no code, and access a session needs repeatedly becomes a `canon` verb.

## Stated by no source

**Naming the field and deriving its authorities.** No comparable skill takes a thinking step before searching. The step rests on the paired open and scoped searches recorded in `REQUIREMENT.md` under `Gap`, where the scoped run returned primary sources and caught a wrong version number the open run carried.

**Preferring a public API over a fetched page.** It rests on the same probes, where the scholarly and reference APIs returned the dates, authors, and identifiers a citation needs and a fetched page returned a summary.
