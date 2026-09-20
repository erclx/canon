---
title: Teach
description: Learning workspace layout, the chrome splice, the committed fixture, and the canon teach verbs
---

# Teach

## Overview

A learning workspace is a folder of standalone HTML lessons a learner opens directly, with a mission, a glossary, resource pages and learning records beside them. `canon teach` opens a workspace, resolves what the next lesson needs, seeds a stylesheet from the design tokens, and splices navigation chrome into every lesson.

Two standards fix the artifact and one skill drives the pedagogy. `standards/teach.md` fixes layout, ordinal naming, frontmatter, and the mission and learning-record formats. `standards/glossary.md` fixes the glossary. The shipped `teach-workspace` skill decides what to teach next, which is deliberately not a standard.

## Layout

- `src/teach/`: the implementation. `workspace.ts` resolves roots and reads a workspace, `nav.ts` splices lesson chrome, `lesson.ts` resolves what a lesson needs and draws its quiz order, `render.ts` and `html/` turn a body block list into HTML, `components/` and `fonts.ts` carry the chrome's own pieces.
- `examples/teach/`: the committed fixture, rooted at `00-fixture/`, which is what development renders against.
- `.canon/teach/`: the operator's live workspaces, gitignored and backed through `canon records push`.

## Decisions

**A workspace is named `<nn>-<topic>` rather than by a bare slug**, so a listing sorts by when each opened. It is the first record folder to take that shape, which was free because the surface was greenfield. `canon/context/standards/per-standard.md` carries the decision and the groundwork and intake folders' shared sequence beside it.

**Quiz option order is drawn by `canon teach lesson` rather than chosen by the author.** An author told to vary a position still varies it by judgment, and a verb is a check where an instruction is a hope. What the split cannot close is that the body remains free to reorder what the verb reports, since nothing downstream compares the two, which is recorded rather than fixed.

**The chrome is spliced into each lesson rather than inserted by a template.** A lesson is a standalone file a learner opens with no build step, so a template would introduce one and a copied header would drift per lesson. The splice keeps the file directly openable and the chrome uniform, at the cost that an authored file and a generated one share a path.

**The chrome's markup and its CSS come from different files.** `src/teach/nav.ts` emits the header, the footer nav and the contents pages, while every chrome rule is generated from `TEACH_CHROME` in `src/design/components.ts`, so a repair to how the chrome looks lands in the second file. `nav` seeds a workspace's stylesheet pair when `course.css` is absent, never overwrites it, and drops the `@import` from the copy a lesson embeds, since that line resolves against the lesson's folder and the `<link>` already reaches the base sheet.

**Teach reads the design module's faces and keeps only the hand pair as its own.** `--teach-sans` and `--teach-mono` resolve to `--type-body-family` and `--type-code-family`, and `TEACH_FONT_FACES` is `FONT_FACES` plus `HAND_DRAWN_FONT_FACES`, so a face change reaches teach with no edit here. Font sizes equal to a step read `--t2` through `--t6`, and the sizes between steps stay as chrome tuning until a taste pass takes them. Keeping teach's own Nunito and Cascadia Code was the alternative, and it left the tree rendering three families where the design record names two.

**A durable page promoted out of a workspace routes through a file of its own**, at `.canon/tmp/handoff/teach-promotion/<slug>.md`, which `docs-fold` folds and deletes. Sharing the memory-routing handoff was the obvious reuse and is what the pattern cannot take, since that file already has two writers and a reader that deletes it.

## Gotchas

- `canon teach nav` rewrites lessons in place and refuses a lesson missing its four marker pairs, `canon:teach:style`, `canon:teach:header`, `canon:teach:footnav` and `canon:teach:scripts`. A hand-edit inside a pair is overwritten by the next run with nothing reporting it. The authored heading, lede, body and quiz sit between the header and footnav markers and are left untouched.
- One `nav` run rewrites the teach root, the contents pages, and every lesson's chrome, so its diff reaches files the change did not name. That is the verb working rather than a defect, and the diff is still the cheapest place to notice a wrong pipeline change.
- `workspace.ts` resolves a root whose basename is already `teach` as that root rather than nesting a second `teach` below it, so a path ending in `teach` behaves differently from one that does not.
- A bare `canon teach list` reads the operator's live workspaces. Reaching the committed fixture takes `--root examples/teach`, and a claim about the fixture made without the flag describes a different tree.
- `governance/rules/claude/561-teach.md` is scoped to `.canon/teach/**`, which is workspace content. It reaches neither `src/teach/` nor `examples/teach/`, so an implementation or fixture edit is routed by the `internal-teach` skill rather than by that rule. Widening the rule is wrong, since it ships to targets through governance sync and a target has no `src/teach/`.
- Renders committed under `examples/` are disclaimed rather than gated, because nothing outside `examples/` depends on them staying current. `canon/context/web.md` draws that line between `assets/` and `examples/` on who each folder addresses.

## Related

- `canon standards teach`: the workspace artifact
- `canon standards glossary`: the glossary every workspace carries
- `claude/skills/teach-workspace/`: the pedagogy and the promotion handoff
- `canon/context/design.md`: the token values a workspace stylesheet is seeded from
