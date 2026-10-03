---
name: record-screencast
description: Why compiling and running a screencast draft needs a routed skill rather than an operator typing two verbs by hand, and why the unresolved-field refusal cannot be a suggestion
---

# Record screencast requirement

## Gap

Without this skill, `draft-screencast` writes a draft and names `canon demo compile` as the next step, and nothing after that routes a session there or to `canon demo run`. An operator has to know both verbs, type them in order, and read the compile record for unresolved fields by hand. A session that fills one in on its own reproduces the exact failure `canon demo run`'s `plan-unresolved` reason exists to catch, one layer up where nothing enforces it.

## Must

- Resolve the default plan path the same way `canon demo compile` does, so a caller passing only the draft path reaches the plan without naming it
- Skip compiling when a plan already exists at that path, since its timing may be tuned by hand and a draft cannot reproduce that
- Report every unresolved field from the compile or run record and stop rather than filling one in
- Report every path a run wrote, video, mp4, gif, still, skipping any the record carries as null
- Compose the take into a finished mp4 through HyperFrames when the draft's wrap section asks for anything, check the composition before rendering, and hand the render to `read-frames`
- Stop at the take when the wrap section says `none` throughout, and stop with the install command when HyperFrames is absent

## Must not

- Pass `--force` to compile
- Guess or fill a target, a URL, or any other unresolved field
- Drive the application through anything other than `canon demo run`
- Install HyperFrames, vendor it, or restate its composition rules, which its own skills own
- Assume this skill's own invocation frequency needs no check. `draft-screencast`'s closing block names it by hand, but whether anything else reaches for it beyond that pointer or an operator typing its name has no answer at creation time, so a review pass some months in should read that back rather than take it on faith.

## Guards

- No draft path given: stop rather than guessing what to compile

## Out of scope

- Drafting the beats, which `draft-screencast` owns
- Filling an existing plan's target or URL, which is the operator's own edit
- Verifying a recording beyond its own caption, which nothing in the toolkit does yet
