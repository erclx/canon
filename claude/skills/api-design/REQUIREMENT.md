---
name: api-design
description: Why a session changing what a caller can see needs stated rules on exposure, contracts, errors, additive change, and retried writes, and where that judgment stops short of layout, review, and visual design
---

# API design requirement

## Gap

A session changing a surface a caller depends on has nothing in front of it about what that caller can see or how a change lands without breaking it. It works for the one caller it opened, renames a field in place, and returns whatever record it held.

No skill carries the subject, and the core code rule's two error bullets say nothing about exposure, versioning, or retries. `review-craft` lists a changed contract's consumers only once the change exists, when a rename costs a second pass over a surface that was cheap to shape before its first caller.

## Must

- State Hyrum's Law as design rules, deciding what is observable and exposing no storage type, internal identifier, ordering, or timing by accident
- Write the contract before the body, with one error shape per surface carrying a stable code, and validate once at the boundary
- Make change additive by default, with new fields optional and nothing renamed, removed, or redefined in place, and the One-Version Rule for a caller that cannot pin
- State four idempotency rules: honor a caller's key, claim it atomically, fail loudly on a reused key with a different body, and keep it past the retry window
- Close with excuses, red flags, and a checklist, and exclude visual interfaces by name in the description

## Must not

- Name a framework, a protocol style, or a language in the body
- Restate the consumer-listing axis `review-craft` carries, or cover the internals behind a boundary
- Land a rename in place unless every caller sits in the same change and the change migrates each one

## Out of scope

- Where the file holding a surface sits on disk, which `codebase-layout` owns
- Interface depth and the internals behind a boundary, which `code-craft` owns
- Listing the consumers a finished change breaks, which `review-craft` owns
- A visual interface, its layout, and its look, which `design-taste` owns
- Retiring a surface and migrating its last consumers, which `deprecation-migration` owns
