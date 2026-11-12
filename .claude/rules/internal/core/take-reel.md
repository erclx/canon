---
description: Hold a take engine pull request to a reel of its fixtures filmed by the branch's own engine
paths:
  - 'src/take/**'
---

# Take reel standards

## Filming

- Before opening or pushing a pull request changing a non-test path under `src/take/`, run `bun src/take/fixtures/pr-reel.ts --base origin/main --out .canon/tmp/take-reel/<number> --json`.
- Never film with the `canon` on PATH, which is the published release rather than the engine under review.
- Write a `<stem>.json` plan beside a fixture the change adds or alters, since a fixture with no plan films `motion.json` instead.
- On `over-cap`, cut the beats through the one the record names and film again, since the reel caps every fixture at 12 s in sum.
- On `untouched`, post no reel, since the lift paints no test path.

## Checking

- Open every beat's `still` in the record and confirm it shows the state its beat names, per the still check in `canon:pr-evidence`. A wrong still posts nothing.

## Posting

- Push the reel with `canon pr frames <number> --reel <reel> --pass "$(date -u +%Y%m%dT%H%M%SZ)" --json` and hold the record's `link`.
- Post it with `canon pr evidence <number> --reel <link> --json`, which opens the evidence comment with no checklist.
- Film again after a push that changes an engine path, since `canon pr lift` settles only on a reel filmed at the head.
