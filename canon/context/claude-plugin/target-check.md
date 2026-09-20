---
title: Target check
description: The six domains the target check reports, why the harness ships as a stated gap, and where the skill sits against canon-operator and the rollout worker
---

# Target check

`claude/skills/target-check/SKILL.md` reports what a target project holds against what the toolkit currently ships, one section per domain. It reports and never repairs. A rollout worker runs it as the first thing it does inside a target, ahead of the diagnose-and-repair step, so a wave reads one stated set of domains per target rather than whatever each session decided to examine.

## The six domains

Five answer from a verb that already exists and one answers from nothing.

- Toolkit version, from `skew` on `canon sync --check . --json`
- The `canon/` folder, from `unmigrated`, `superseded`, and `reverse` on that report, plus `canon context audit` and `canon records validate`
- Governance rules, from the `domains` array on that report
- Tooling, from the `tooling` block plus `canon tooling sync --check <stack>`
- Seeds, from `seeds.entries`
- The Claude harness, which no verb reads

`claude/skills/target-check/references/domains.md` holds what each reads, what current looks like, and where a finding routes. The body holds the order, the guards, and the report shape.

## Why the harness ships as a stated gap

`canon claude` carries `init`, `sync`, `setup`, `seeds`, `list`, `routing`, `plugin-update`, and `skills` with `drift`, `audit`, `reach`, and `rank` beneath it, and none of them answers whether a target's hooks fire, whether `.claude/settings.json` registers them, or which plugin version that target's sessions load. `canon claude skills drift` comes nearest and reads this toolkit's own history against a ref, which says what moved upstream rather than what a target holds.

The seeds domain reads `.claude/settings.json` and every `.claude/hooks/*.sh` as seed entries, so a `matching` verdict there says the bytes match what ships. It says nothing about whether the harness those files configure is wired, which is the part that goes unread.

File inspection was the alternative and it is refused. Every other section answers from the verb under test, which is the toolkit's own rule that a session reading toolkit state prefers a CLI verb over its own read of the same files. A sixth section answering from a hand-rolled read would reach a verdict nothing else in the report is entitled to make, so the row stays `unchecked` and names what is unread. A domain silently absent reads as a domain that passed.

## Why there is no verdict over the six

Five sections answering from verbs and one answering from nothing cannot roll into a number without that number lying about the sixth. `canon inventory` reports a listing rather than a verdict for the same reason, recorded in `canon/context/inventory.md`, and it is absent from the six because its subject is a target's own routes rather than what the toolkit ships.

The same asymmetry is why an unread domain is a third state beside current and behind. A refused command, an absent report key, and a subcommand the target's binary does not carry all leave a section unread, and the version domain is reported first because a target a release behind explains every unread section under it. `canon/ARCHITECTURE.md` records that skills and the CLI ship at two speeds, which is what makes a missing subcommand an ordinary reading rather than a failure.

## Where it sits against the neighbors

- `canon-operator` routes one plain-language intent to the command or skill that satisfies it, and diagnoses along the way. This skill answers one fixed question across a fixed domain list and routes nothing, which is what makes its output comparable between two targets and between two waves.
- `setup-init` scaffolds a project that holds nothing. This one reads a project that already holds something.
- `seed-sync` proposes per-section seed edits. This one counts seed states and names that skill.

## Open

- The tooling section calls `canon tooling sync --check <stack>`. `canon tooling diff` is the verb it wants and does not exist yet, and `--check` stays working as an alias by design, so the retarget when that verb lands is a change of name rather than of behavior.
- Document health is a content question rather than a structural one and is absent here by design.
- Nothing checks that the domain list in the body, the reference, and this entry stay the same six. A domain added to one and not the others drifts silently.
