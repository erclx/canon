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
- On `over-cap`, which only a fixture's own plan raises, cut its beats through the one named and film again. The motion fallback cuts itself and lists the rest in `dropped`.
- On `untouched`, post no reel, since the lift paints no test path.

## Checking

- Open every beat's `still` in the record and confirm it shows the state its beat names, per the still check in `canon:pr-evidence`. A wrong still posts nothing.

## Posting

- Push the reel with `canon pr frames <number> --reel <reel> --pass "$(date -u +%Y%m%dT%H%M%SZ)" --json` and hold the record's `link`.
- Render it with `canon pr evidence <number> --reel <link> --json`, then post or edit its `body` the way `canon:pr-evidence` posts one. The verb renders and never posts.
- Film again after a push that changes an engine path, since `canon pr lift` settles only on a reel filmed at the head.
