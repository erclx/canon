---
title: Adopted and declined
description: Which external API design sources this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record, and a later session extending the skill adds to it rather than re-arguing an item settled here.

A source a bullet rests on is linked once, in that bullet's row of the toolkit's per-bullet ledger at `governance/ledger/skills/api-design/`, which ships outside the plugin. This file names those sources without the link and keeps the catalog-level adopted and declined record, linking only a source no row cites.

## Adopted from the default shelf

### Observable behavior

Software Engineering at Google, ch. 1 states Hyrum's Law, that with enough users, every observable behavior of a system is depended on by somebody, whatever the contract promises.

Adopted as the opening group, stated as design rules rather than as an observation, so a session decides what is observable before a caller decides it for them. Ordering and timing are named because the chapter's own examples are hash iteration order and timing.

### One version per dependency

Software Engineering at Google, ch. 16 states the One-Version Rule, keeping one version of each dependency in a repository, so a change to it migrates every caller rather than leaving two versions live. Adopted under additive change for a caller that cannot pin, which is any module imported from inside one repository.

## Adopted from one external skill

From `addyosmani/agent-skills@2686b620`, `skills/api-and-interface-design/SKILL.md`.

### Contract and errors

**Contract first.** Write the interface before the body. Adopted as its own group, widened from an endpoint to a signature, a flag set, an output shape, and a schema.

**One error shape.** Every failure on one surface carries the same structure. Adopted with a stable code for the caller to branch on, and internal details kept out of the message, since no project rule carries either for every code stack.

### Input and change

**Validation at the boundary.** Check input where it enters and trust it inside. Adopted, with a value read back from a file or another service counted as input.

**Additive change.** New fields optional, nothing removed in place. Adopted, with a change of meaning under an existing name as its own ban, since it breaks a caller as surely as a removal and no rename shows in the diff.

### Idempotency

A stored key honored on retry, an atomic claim under a unique constraint, a reused key with a different body failing loudly, and retention past the longest retry. Adopted as four rules, keeping the reused-key rule, which is the one most often left out.

### The closing sections

The same source's skill anatomy supplies the excuses, red flags, and closing checklist, adopted toolkit-wide through `${CLAUDE_SKILL_DIR}/../create-skill/references/skill-practice.md`. Each excuse row here rebuts a reason a session gives when about to break a caller, such as "nobody depends on that field".

## Declined

Each item below was read and left out, with the reason it changes nothing a session does here.

### Protocol-specific guidance

The source skill carries verbs, status codes, pagination, and URL shapes for one protocol style. Declined because the body holds for a function's exports, a command's flags, and a file format as much as an endpoint, so a protocol section would route every non-network surface to rules that do not apply.

A project needing those conventions states them in its own stack rule.

### Depth and versions

**Interface depth.** Ousterhout's deep modules, after [A Philosophy of Software Design](https://web.stanford.edu/~ouster/cgi-bin/book.php), judge how much a module hides behind its surface. Depth is about what sits behind a boundary, and this skill owns only what crosses it, so `code-craft` carries it.

**Versioned surfaces as the default.** Shipping a new version beside the old for every breaking change. Additive change avoids the break in the first place and two live versions split the callers, so the One-Version Rule covers a caller that cannot pin.
