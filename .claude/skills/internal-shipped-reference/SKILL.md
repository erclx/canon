---
name: internal-shipped-reference
description: Reviews a shipped-corpus edit for a reference that resolves only in this checkout and reads as portable, the one form the reference gate cannot classify by pattern. Use before shipping a change under claude/, docs/, governance/, scripts/, snippets/, standards/, or tooling/, routed here by `598-authoring-layout.md`. Do NOT use for a pull request number, a commit sha, a resolvable `docs/<name>.md` path, a phase label, or a numbered rule path, which `canon gate run`'s shipped-references stage already classifies by pattern.
---

# Internal shipped reference

`src/shipped/references.ts` classifies five same-repository reference forms by pattern and stops there on purpose. Its own `DOCS_PATH` comment names the sixth: telling a `canon/context/<name>.md` citation of this repository's own domain entry apart from an illustration of a target's own generic tree, such as `canon/context/index.md`, is a semantic read no pattern makes. This skill is that read, plus the parallel judgment over a layout or count claim.

## Discriminator

Read every added or changed line in the diff under this rule's eight corpora: `internal/`, `standards/`, `snippets/`, `claude/`, `governance/`, `docs/`, `scripts/`, `tooling/`.

For each `canon/context/<name>.md` token:

- **Fine.** The sentence reads as an instruction for a target session to consult its own project's copy if one exists, or illustrates the path shape a target's own tree would take, never naming a fact only this checkout holds. `ux-measure/SKILL.md`'s `canon/context/development/: the documented run commands and the port each serves` is this case, read as "check your own project's entry."
- **Fails.** The sentence names a fact true of this repository specifically, one only this checkout's own `canon/context/` resolves, such as a documented decision or a domain narrative a target reader cannot open. `canon-cli/SKILL.md`'s prior citation of `canon/context/tooling.md` as "the toolkit's" was this case.

Do not test a token against what a scaffolded project's seed happens to ship. That discriminator was measured and rejected: the seed's own contents drift, and a token reading as an instruction is fine regardless of what any seed carries.

A token inside a branch only a toolkit-repo reader ever follows, such as an `In the toolkit:` clause beside an `In a project:` one, is Fine even when it names a domain entry, since the reader who reaches that branch is by construction sitting in this checkout. `create-standard/SKILL.md`'s `In the toolkit:` line is this case. An unbranched sentence naming the same path for every reader stays a Fails, since a target reader reaches it too.

For each layout, stack, or config-path claim:

- **Fine.** The claim names a portable convention true of any project carrying the same toolkit surface, such as a fixed install path (`.claude/canon/pr-labels.toml`).
- **Fails.** The claim states a count, a stack choice, or a folder shape true of this checkout specifically, phrased as if every target shared it.

## Repair menu

- State the fact the reference carries instead of the path. `claude/skills/canon-cli/SKILL.md`'s repaired form, naming the toolkit's own context entries as authoritative over a target-session summary without the three paths, is the shape.
- Where the sentence labels the path toolkit-only inside text every reader sees, the label is not the fix. Drop the path and fold what it pointed at into the sentence, or drop the trailing clause when the path carried nothing past the label. `youtube-transcripts/SKILL.md`'s repaired form is this case.
- Where the path sits inside a branch only a toolkit-repo reader ever follows, keep it and mark `<!-- canon-allow-reference: <why> -->`, naming the branch. That reader can open the path, so dropping it costs the only audience the sentence has. `create-standard/SKILL.md`'s `In the toolkit:` branch is this case, not the bullet above.
- Where the token is a genuine illustration rather than a citation, mark it the same way, the marker `src/shipped/references.ts` already reads for its own four forms. Nothing in the gate scans a `canon/context/` token today, so the marker documents the read for the next reader rather than suppressing a check.
- Scope a checkout-specific claim to "in the toolkit" or "in this repository" rather than deleting it, when the fact is worth keeping for a toolkit-only reader.

## Report

State each finding as `<file>:<line>: <token>`, which half of the discriminator it failed, and the repair applied or proposed. Report a clean pass as `No self-only reference found` rather than staying silent, so a reviewer reading the diff sees the skill ran.
