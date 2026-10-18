---
name: record-screencast
description: Why compiling and running a screencast draft needs a routed skill rather than an operator typing two verbs by hand, and why the unresolved-field refusal cannot be a suggestion
---

# Record screencast requirement

## Gap

Without this skill, nothing routes a session from a screencast draft to `canon demo compile` and `canon demo run`. An operator has to know both verbs, type them in order, and read the compile record for unresolved fields by hand.

A session that fills an unresolved field in on its own reproduces the failure `plan-unresolved` exists to catch, where nothing enforces it. A take with no composition ships raw, and an unguided one reaches for generic defaults.

## Must

- The default plan path resolves the way `canon demo compile` resolves it, and an existing plan there is run rather than recompiled, since its timing may be tuned by hand
- Every unresolved field from the compile or run record is reported and the run stops there
- Every path a run wrote is reported, skipping any the record carries as null
- The video craft guidance loads before composing, and a draft whose wrap section asks for anything becomes a finished mp4 through HyperFrames, checked before rendering and handed to `read-frames`
- A wrap section reading `none` throughout stops at the take, and an absent HyperFrames stops with its install command

## Must not

- Pass `--force` to compile, or guess what to compile when no draft path is given
- Guess or fill a target, a URL, or any other unresolved field
- Drive the application through anything other than `canon demo run`
- Install HyperFrames, vendor it, or restate its composition rules
- Assume anything reaches for this skill beyond `script-screencast`'s closing pointer or an operator, which a later review reads back

## Out of scope

- Drafting the beats, which `script-screencast` owns
- The captions, zoom, pointer, and audio judgment, which `video-craft` owns
- Reading the render back, which `read-frames` owns
- Filling an existing plan's target or URL, which the operator owns
