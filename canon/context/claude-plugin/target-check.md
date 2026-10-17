---
title: Target check
description: The six domains the target check reports, why the harness ships as a stated gap, and where the skill sits against the other health reports
---

# Target check

`claude/skills/target-check/SKILL.md` reports what a target project holds against what the toolkit ships, one section per domain. It reports and never repairs. A rollout worker runs it first inside a target, so a wave reads one stated set of domains per target rather than whatever each session chose to examine.

## Layout

### The six domains

Five answer from a verb that already exists and one answers from nothing.

1. Toolkit version, from `skew` on `canon sync --check . --json`
2. The `canon/` folder, from `unmigrated`, `superseded`, `unmovedSurfaces`, and `reverse` on that report, plus `canon context audit` and `canon records validate`
3. Governance rules, from the `domains` array on that report
4. Tooling, from the `tooling` block plus `canon tooling sync --check <stack>`
5. Seeds, from `seeds.entries`
6. The Claude harness, which no verb reads

`claude/skills/target-check/references/domains.md` holds what each reads, what current looks like, and where a finding routes. The body holds the order, the guards, and the report shape.

## Decisions

### Why the harness ships as a stated gap

No `canon claude` verb answers whether a target's hooks fire, whether `.claude/settings.json` registers them, or which plugin version that target's sessions load. The verbs are `init`, `sync`, `target-setup`, `seeds`, `list`, `routing`, `plugin-update`, and `skills` with `drift`, `audit`, `reach`, and `rank`.

`canon claude skills drift` comes nearest and reads this toolkit's own history against a ref, which says what moved upstream rather than what a target holds.

- The seeds domain reads `.claude/settings.json` and every `.claude/hooks/*.sh` as seed entries. A `matching` verdict says the bytes match what ships and nothing about whether the harness is wired
- File inspection was the alternative and it is refused, because a hand-rolled sixth section would reach a verdict nothing else in the report is entitled to make
- The row stays `unchecked` and names what is unread, since a domain silently absent reads as a domain that passed

### Why there is no verdict over the six

Five sections answering from verbs and one from nothing cannot roll into a number without that number lying about the sixth. `canon inventory` reports a listing rather than a verdict for the same reason, recorded in `canon/context/features/inventory.md`, and it is absent from the six because its subject is a target's own routes.

An unread domain is a third state beside current and behind. A refused command, an absent report key, and a subcommand the target's binary does not carry all leave a section unread.

- The version domain is reported first because a target a release behind explains every unread section under it
- `canon/context/claude-plugin/distribution.md` records that skills and the CLI ship at two speeds, so a missing subcommand is an ordinary reading rather than a failure

### Where it sits against the neighbors

`target-setup` scaffolds a project that holds nothing. This skill reads a project that already holds something.

## Gotchas

### Open

Three gaps stand open.

- The tooling section calls `canon tooling sync --check <stack>`, and `canon tooling diff` is the verb it wants but does not exist yet. `--check` stays as an alias, so the retarget renames only.
- Document health is a content question absent from the six by design, answered by the skill in `canon/context/claude-plugin/document-health.md`. Its `REQUIREMENT.md` omits that skill.
- Nothing checks that the domain list in the body, the reference, and this entry stay the same six, so a domain added to one and not the others drifts silently.
