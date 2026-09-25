---
name: internal-teach
description: Why the teach implementation and its fixture need a domain skill beside the standards that govern a workspace's shape and the rule that routes workspace content
---

# Internal teach requirement

## Gap

Without this skill, a session editing the teach implementation:

- Hand-edits chrome inside a marker pair, and the next `canon teach nav` overwrites it with nothing reporting the loss, so the edit reads as applied and is gone.
- Writes a lesson with no marker pairs and meets a refusal it reads as a bug in the verb rather than as the contract the verb states.
- Chooses a quiz option order by judgment, which is the exact failure `canon teach lesson` draws the order to prevent, and nothing downstream compares what the verb drew against what the body shipped.
- Runs a bare `canon teach list` and reports on the operator's live workspaces while believing it read the committed fixture, so a claim about the fixture describes a tree the change never touched.
- Reads `governance/rules/claude/561-teach.md` as covering this work. That rule is scoped to `.canon/teach/**`, which is workspace content, and reaches neither `src/teach/` nor `examples/teach/`.
- Adds a staleness gate over the renders under `examples/`, which inverts the split `canon/context/web.md` draws between a folder whose output something depends on and one whose output nothing does.
- Encodes a workspace's required shape in code or in a skill body rather than in the standard that governs it, leaving two sources for one shape.

## Must

- Point at `canon/context/teach.md` for structure and decisions rather than restating them, so one edit to the entry moves what every reader sees.
- Name the chrome splice as the domain's first trap, and carry the marker contract in a reference the session opens when authoring rather than in the body every session loads.
- State which `canon teach` invocation reaches the fixture and which reaches the operator's live workspaces.
- Route a change in a workspace's required shape to `standards/teach.md` or `standards/glossary.md` rather than absorbing it.
- Carry a sync checklist naming what to run after a render-pipeline change, since the splice rewrites committed files and a change that skips the diff ships them unread.

## Must not

- Restate what `canon standards teach` or `canon standards glossary` fixes. Each is the single source for the artifact it governs and a second copy here drifts on its own cadence.
- Restate `canon/context/teach.md`'s structure or gotchas. The ownership table in `CLAUDE.md` puts per-domain narrative in the context entry, and a skill paraphrasing its own entry is the duplication that table exists to prevent.
- Carry the pedagogy that decides what to teach next. `claude/skills/teach-workspace/references/` owns it, and `canon/context/standards/per-standard/surfaces.md` records the split.
- Fire on a `.canon/teach/**` edit. `561-teach.md` already reaches that path and ships to targets, where this skill is toolkit-internal and does not.

## Guards

No refusal strings. This is a domain skill loaded before editing rather than a procedure with entry conditions.

## Out of scope

- `internal-web` covers the outward-facing surface and its committed images.
- `internal-scripts` covers `src/` generally. This covers what `src/teach/` means, which that skill does not carry.
- `internal-standards` covers authoring a standard. This routes a shape change there and stops.
- `teach-workspace` is the shipped skill an operator runs to teach. This is for editing the machinery underneath it.

### The open question this cannot answer

Whether anything invokes this other than a session reading the `CLAUDE.md` domain table and loading it by name. That is unanswerable before the skill has run, and it is the criterion to re-read after a few sessions have edited this domain with it in place. A domain skill nothing loads is a context entry with extra steps.
