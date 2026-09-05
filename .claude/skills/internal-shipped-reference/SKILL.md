---
name: internal-shipped-reference
description: Reviews a shipped-corpus edit for a reference that resolves only in this checkout and reads as portable, the one form the reference gate cannot classify by pattern. Use before shipping a change under claude/, docs/, governance/, scripts/, snippets/, standards/, or tooling/, routed here by `598-authoring-layout.md`. Do NOT use for a pull request number, a commit sha, a resolvable `docs/<name>.md` path, or a phase label, which `canon gate run`'s shipped-references stage already classifies by pattern.
---

# Internal shipped reference

`src/shipped/references.ts` classifies four same-repository reference forms by pattern and stops there on purpose. Its own `DOCS_PATH` comment names the fifth: telling a `.claude/context/<name>.md` citation of this repository's own domain entry apart from an illustration of a target's own generic tree, such as `.claude/context/index.md`, is a semantic read no pattern makes. This skill is that read, plus the parallel judgment over a layout or count claim.

## Discriminator

Read every added or changed line in the diff under this rule's eight corpora: `internal/`, `standards/`, `snippets/`, `claude/`, `governance/`, `docs/`, `scripts/`, `tooling/`.

For each `.claude/context/<name>.md` token:

- **Fine.** The sentence reads as an instruction for a target session to consult its own project's copy if one exists, or illustrates the path shape a target's own tree would take, never naming a fact only this checkout holds. `claude-ux-measure/SKILL.md`'s `.claude/context/development/: the documented run commands and the port each serves` is this case, read as "check your own project's entry."
- **Fails.** The sentence names a fact true of this repository specifically, one only this checkout's own `.claude/context/` resolves, such as a documented decision or a domain narrative a target reader cannot open. `canon-cli/SKILL.md`'s prior citation of `.claude/context/tooling.md` as "the toolkit's" was this case.

Do not test a token against what a scaffolded project's seed happens to ship. That discriminator was measured and rejected: the seed's own contents drift, and a token reading as an instruction is fine regardless of what any seed carries.

For each layout, stack, or config-path claim:

- **Fine.** The claim names a portable convention true of any project carrying the same toolkit surface, such as a fixed install path (`.claude/canon/pr-labels.toml`).
- **Fails.** The claim states a count, a stack choice, or a folder shape true of this checkout specifically, phrased as if every target shared it.

## Repair menu

- State the fact the reference carries instead of the path. `claude/skills/canon-cli/SKILL.md`'s repaired form, naming the toolkit's own context entries as authoritative over a target-session summary without the three paths, is the shape.
- Where the sentence already labels the path toolkit-only, the label is not the fix. Drop the path and fold what it pointed at into the sentence, or drop the trailing clause when the path carried nothing past the label.
- Where the token is a genuine illustration rather than a citation, mark it `<!-- canon-allow-reference: <why> -->` on the line or the line above, the marker `src/shipped/references.ts` already reads for its own four forms. Nothing in the gate scans a `.claude/context/` token today, so the marker documents the read for the next reader rather than suppressing a check.
- Scope a checkout-specific claim to "in the toolkit" or "in this repository" rather than deleting it, when the fact is worth keeping for a toolkit-only reader.

## Report

State each finding as `<file>:<line>: <token>`, which half of the discriminator it failed, and the repair applied or proposed. Report a clean pass as `No self-only reference found` rather than staying silent, so a reviewer reading the diff sees the skill ran.
