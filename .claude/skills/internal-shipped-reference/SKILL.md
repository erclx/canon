---
name: internal-shipped-reference
description: Reviews a shipped-corpus edit for a reference that resolves only in this checkout and reads as portable, the one form the reference gate cannot classify by pattern, and for a line in a target-loaded skill that only this toolkit acts on. Use before shipping a change under claude/, docs/, governance/, scripts/, standards/, or tooling/, routed here by `authoring-layout.md`. Do NOT use for a pull request number, a commit sha, a resolvable `docs/<name>.md` path, a phase label, an installed rule path, or a stack's `configs/` or `seeds/` source path, which `canon gate run`'s shipped-references stage already classifies by pattern.
---

# Internal shipped reference

`src/shipped/references.ts` classifies seven same-repository reference forms by pattern and stops there on purpose. Its own `DOCS_PATH` comment names one more, a `canon/context/<name>.md` token that may cite this repository's own domain entry or illustrate a target's generic tree, such as `canon/context/index.md`.

Telling those two apart is a semantic read no pattern makes. This skill is that read, plus the parallel judgment over a layout or count claim and the audience test over a shipped skill's lines.

## Discriminator

Read every added or changed line in the diff under this rule's seven corpora, being `internal/`, `standards/`, `claude/`, `governance/`, `docs/`, `scripts/`, and `tooling/`.

For each `canon/context/<name>.md` token:

- **Fine.** The sentence tells a target session to consult its own project's copy, or illustrates the path shape a target's tree would take, and names no fact only this checkout holds
- **Fails.** The sentence names a fact true of this repository alone, such as a documented decision or a domain narrative a target reader cannot open

`ui-measure/SKILL.md`'s `canon/context/development/local-loop.md`: the documented run commands and the port each serves is Fine, read as "check your own project's entry." `canon-cli/SKILL.md`'s prior citation of the tooling entry as "the toolkit's" Failed.

### Branches and seeds

Never test a token against what a scaffolded project's seed ships, since the seed's contents drift and a token reading as an instruction is Fine regardless.

- A token inside a branch only a toolkit-repo reader follows, such as an `In the toolkit:` clause beside an `In a project:` one, is Fine for the discriminator, since that reader sits in this checkout
- Under `claude/skills/` that branch still takes the audience test below
- An unbranched sentence naming the same path for every reader Fails, since a target reader reaches it too

### Layout and count claims

Each layout, stack, or config-path claim takes the same two verdicts against the checkout-only line in `authoring-layout.md`.

- **Fine.** The claim holds for any project carrying the same toolkit surface.
- **Fails.** The claim is one that line bars, phrased as if every target shared it.

## Audience

The discriminator asks whether a reference resolves for a target reader. This test asks whether a target session ever acts on the line, a question a line with no path in it can fail. A rule only this toolkit meets passes the discriminator, and a target still loads it on every run.

### Scope

Read every added or changed line under `claude/skills/` outside the toolkit-facing skills. A line under `docs/`, `governance/`, `tooling/`, or another corpus takes the discriminator alone.

- A skill's `REQUIREMENT.md` and a `references/adopted.md` sit outside the test, since a maintainer reads both rather than a target session
- `isSkillBodyScope` in `src/shipped/references.ts` excludes `REQUIREMENT.md` for the same reason

### The test

Ask whether any target session acts on the line, whatever its wording.

- **Fine.** A target session follows it. A sentence where "this repository" means the reader's own, as in `proposal-critique`, passes, since the match is on who acts and not on the phrase.
- **Fails.** Only a session in this checkout ever acts on it, stated outright or worded as a condition only this checkout meets, such as a rule for "a project keeping a stack under `tooling/<stack>/`"

An `In the toolkit:` branch is Fine in `create-skill`, which exists to write into this checkout, and Fails in `plan-feature`, whose every reader is planning a target's feature.

### Toolkit-facing skills

These skills exist to reach the toolkit checkout or to report against it, so a toolkit-only line in them speaks to their own audience. They are `canon-feedback`, `create-rule`, `create-skill`, `target-check`, `target-scaffold`, `target-setup`, and `target-update`.

This list is the one place the exemption lives, and `authoring-layout.md` points here rather than copying it. A new skill whose job reaches the checkout reports findings until it joins, so a stale list surfaces as a finding rather than a silent pass. `document-repair` joins only if its checkout refusal keeps a toolkit branch.

### Repair

Move a failing line to the surface the toolkit reads, being an `internal/rules/` rule, an `internal-*` skill, or the toolkit's context entry for the domain, or drop it when it carried nothing a target needs. Scoping it to "in the toolkit" is no repair here, since the label leaves the line in every target's load.

## Repair menu

The default repair states the fact the reference carries instead of the path. `claude/skills/canon-cli/SKILL.md` is the shape, naming the toolkit's own context entries as authoritative over a target-session summary without the three paths.

- A toolkit-only label on a path every reader sees is not the fix. Drop the path and fold in what it pointed at, as `youtube-transcripts/SKILL.md` does, or drop a clause that carried nothing more.
- Scope a checkout-specific claim to "in the toolkit" or "in this repository" rather than deleting it, when the fact is worth keeping for a toolkit-only reader
- Under `claude/skills/` that scoping holds only in a toolkit-facing skill, per the audience test

### The allow marker

Mark `<!-- canon-allow-reference: <why> -->` where a path sits inside a branch only a toolkit-repo reader follows, naming the branch. That reader can open the path, so dropping it costs the only audience the sentence has.

- Mark a genuine illustration the same way, with the marker `src/shipped/references.ts` reads for its own four forms
- No gate scans a `canon/context/` token today, so the marker documents the read for the next reader rather than suppressing a check

## Report

State each finding as `<file>:<line>: <token>`, which half of the discriminator it failed, and the repair applied or proposed. State an audience finding as `<file>:<line>: audience`, naming who acts on the line and where it moves.

Report a clean pass as `No self-only reference found` rather than staying silent, so a reviewer reading the diff sees the skill ran.
