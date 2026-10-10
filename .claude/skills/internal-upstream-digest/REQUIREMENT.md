---
name: internal-upstream-digest
description: Why a hand-run triage of Claude Code releases needs its own skill, and the line between it, the verbs it drives, and the intake skill that files its output
---

# Internal upstream digest requirement

## Gap

Without this skill, a session asked what changed upstream:

- Reads release notes whole, about two thousand bullets a month, and spends its context on bug fixes and surfaces canon does not ship on.
- Judges lines from the notes alone, keeps an item it never checked against a file, and cites nothing a reader can open.
- Misses a built-in that overlaps a canon mechanism, because it never held the list of canon's mechanisms beside the release lines.
- Files a finding as a fix to make, and edits a file in the same session.
- Advances the range before the findings are written down, so a run that dies midway skips the releases it never triaged.
- Calls the bare `canon` binary, which resolves to the installed package and fails on a verb that has not shipped.

## Must

- Run the fetch and the catalog verbs first, so the noise is dropped and the mechanism list is generated rather than recalled.
- Verify each claim against the repository before keeping it, and quote `file:line` or a line of text as evidence.
- Sort into the five classes with one test each, and send a confirmed no-op to the near-misses.
- File one intake pass through `canon:plan-intake`, with the release range written in the overview.
- Advance the cursor only after the pass lands, through the verb.
- Say the digest is a first pass.

## Must not

- Edit a file outside the intake folder. A finding names what to change and a plan carries the change.
- Run headless or in a cloud session. The triage needs the repository and `.canon/`, which neither reads.
- Restate the verb contract or the reasoning. `docs/agents/upstream.md` and `canon/context/claude-internal/upstream-digest.md` own them.

## Guards

- `fetch` refuses: stop and report its `reason`, asking for `--since` on `no-cursor`.
- Empty range: report it and stop without filing or advancing.

## Out of scope

- The reminder that a digest is due, which a later hook owns.
- A single question about one feature, which is `internal-ask`.
- Editing a wiki page a finding names, which `internal-standards` governs.
