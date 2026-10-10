---
title: Adopted and declined
description: Which external API design sources this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record. A later session extending the skill adds to it rather than re-arguing an item already settled here.

## Adopted

### From the default shelf

**Hyrum's Law.** [Software Engineering at Google, ch. 1](https://abseil.io/resources/swe-book/html/ch01.html): with enough users, every observable behavior of a system is depended on by somebody, whatever the contract promises. Adopted as the opening group, stated as design rules rather than as an observation, so a session decides what is observable before a caller decides it for them. Ordering and timing are named because the chapter's own examples are hash iteration order and timing.

**The One-Version Rule.** [Software Engineering at Google, ch. 21](https://abseil.io/resources/swe-book/html/ch21.html): a repository keeps one version of each dependency, so a change to it migrates every caller rather than leaving two versions live. Adopted under additive change for a caller that cannot pin, which is any module imported from inside one repository.

### From one external skill

From `addyosmani/agent-skills@2686b620`, [`skills/api-and-interface-design/SKILL.md`](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/skills/api-and-interface-design/SKILL.md):

**Contract first.** Write the interface before the body. Adopted as its own group, widened from an endpoint to a signature, a flag set, an output shape, and a schema.

**One error shape.** Every failure on one surface carries the same structure. Adopted with a stable code added for the caller to branch on, and pointed at the core code rule for the structured-error floor rather than restating it.

**Validation at the boundary.** Check input where it enters and trust it inside. Adopted, with a value read back from a file or another service counted as input.

**Additive change.** New fields optional, nothing removed in place. Adopted, with a change of meaning under an existing name added as its own ban, since it breaks a caller as surely as a removal and no rename shows in the diff.

**Idempotency.** A stored key honored on retry, an atomic claim under a unique constraint, a reused key with a different body failing loudly, and retention past the longest retry. Adopted as four rules, keeping the reused-key rule, which is the one most often left out.

**Excuses, red flags, and a closing checklist.** The same source's skill anatomy, adopted toolkit-wide through `${CLAUDE_SKILL_DIR}/../create-skill/references/skill-practice.md`. Each excuse row here rebuts a reason a session gives when it is about to break a caller, such as "nobody depends on that field".

## Declined

**Protocol-specific guidance.** The source skill carries verbs, status codes, pagination, and URL shapes for one protocol style. Declined because the body has to hold for a function's exports, a command's flags, and a file format as much as an endpoint, and a protocol section would route every non-network surface to rules that do not apply. A project needing those conventions states them in its own stack rule.

**Interface depth.** Ousterhout's deep modules, after [A Philosophy of Software Design](https://web.stanford.edu/~ouster/cgi-bin/book.php), judge how much a module hides behind its surface. Declined here because depth is about what sits behind a boundary, and this skill owns only what crosses it. `code-craft` carries it.

**Versioned surfaces as the default.** Shipping a new version beside the old for every breaking change. Declined as the default because additive change avoids the break in the first place, and two live versions split the callers. The One-Version Rule covers a caller that cannot pin.
