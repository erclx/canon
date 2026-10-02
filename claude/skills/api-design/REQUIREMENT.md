---
name: api-design
description: Why a session changing what a caller can see needs stated rules on exposure, contracts, errors, additive change, and retried writes, and where that judgment stops short of layout, review, and visual design
---

# API design requirement

## Gap

Without this skill, a session changing a surface a caller depends on has nothing in front of it about what that caller can see or how a change lands without breaking it. It works for the one caller it opened, renames a field in place, returns whatever record it had in hand, and nothing in the toolkit answers before the change ships.

The absence is measured across the shipped corpus. No folder under `claude/skills/` matches `api`, `interface`, or `contract`, and no file across `claude/`, `governance/`, and `standards/` carries `hyrum` or a form of `idempotent`. The only related lines are the two error bullets in the core code rule, which state that errors are structured and hide internals and say nothing about exposure, versioning, or retries.

The one skill nearest the subject leaves the pointer open. `codebase-layout` excludes shaping "a module's interface and seams" in its description and names no skill to take it, so a session routed away from layout on that question lands nowhere.

`review-craft` lists the consumers of a changed contract, but only once the change exists. A rename caught at review costs a second pass over a surface that was cheap to shape before its first caller.

## Must

- State Hyrum's Law as design rules a session can act on: decide what is observable, and expose no storage type, internal identifier, ordering, or timing by accident
- Tell the session to write the contract, being the signature, flags, output shape, or schema, before the body
- State one error shape per surface with a stable code a caller can branch on, pointing at the core code rule for structured errors and hidden internals rather than restating it
- State validation at the boundary, once, with the value trusted inside
- State additive change as the default: new fields and flags optional, nothing renamed or removed in place, no change of meaning under an existing name, and the One-Version Rule for a caller that cannot pin
- State the four idempotency rules: store and honor a caller's key, claim it in one atomic step under a unique constraint, fail loudly on a reused key with a different body, and keep a key past the longest retry window
- Record the external sources adopted and declined with the reason for each, so a later session extends the position instead of re-deriving it
- Close with a table of the excuses a session gives for breaking a caller, each with its rebuttal, the red flags a session can see in its own diff, and a checklist each line of which answers yes or no against the surface the change produced
- Exclude a visual interface by name in the description, since `design-taste` already routes on drafting or judging an interface

## Must not

- Name a framework, a protocol style, or a language in the body. Status codes, verbs, pagination, and schema languages stay out, so the body holds for a function, a command, a file format, and an endpoint alike.
- Restate the two error bullets of the core code rule
- Restate the consumer-listing axis `review-craft` carries for a finished change
- Cover interface depth or the internals behind a boundary, which govern what sits behind a surface rather than what crosses it
- Import an external skill's tone, such as a law stated as absolute, or an excuse row rebutting an objection no session has raised

## Guards

- A change that stays behind an existing boundary and alters nothing a caller observes skips the skill
- A rename lands as an addition beside the old name, never in place, unless every caller lives in the same change and the change migrates each one

## Out of scope

- Where the file holding a surface sits on disk: `codebase-layout`
- Interface depth, deep modules, and the internals behind a boundary: `code-craft`
- Listing the consumers a finished change breaks, and the docs it made false: `review-craft`
- A visual interface, its layout, and its look: `design-taste`
- Retiring a surface and migrating its last consumers off it, beyond the additive rule stated here
- Protocol-specific guidance such as verbs, status codes, and pagination
- Whether the guidance changes what a session ships, which needs a measured with-and-without run rather than a rule here
