---
description: Hold a take engine pull request to a reel of its fixtures filmed by the branch's own engine
paths:
  - 'src/take/**'
---

# Take reel standards

## Filming

- After opening or pushing a pull request changing a non-test path under `src/take/`, run `bun src/take/fixtures/pr-reel.ts --base origin/main --out .canon/tmp/take-reel/<number> --json`.
- Never film with the `canon` on PATH, which is the published release rather than the engine under review.
- Write a `<stem>.json` plan beside a fixture the change adds or alters, which is all the script films.
- On `unplanned`, which names the paths no plan films, take one route:
  - Write the `<stem>.json` a changed fixture lacks
  - Pass a plan written for the change as `--plan <file>` on `--fixture <stem>`, `motion` by default, with `route: "screencast"` where only that route shows it
  - Run `canon pr evidence <number> --reel-skip "unplanned, <why>"` with a review waiver per named path
- On `over-cap`, cut the plan's beats through the one named and film again, since the script trims nothing.
- On `untouched`, post no reel, since the lift paints no test path.

## Checking

- Open every beat's `still` in the record and confirm it shows the state its beat names, per the still check in `canon:pr-evidence`. A wrong still posts nothing.

## Posting

- Push the reel with `canon pr frames <number> --reel <reel> --pass "$(date -u +%Y%m%dT%H%M%SZ)" --json` and hold the record's `link`.
- Render it with `canon pr evidence <number> --reel <link> --json`, then post or edit its `body` the way `canon:pr-evidence` posts one. The verb renders and never posts.
- Film again after a push that changes a painted path or a path `reel-inputs` under `[painted]` in `canon/config/app.toml` names.
- Expect `canon pr lift` to carry a reel across pushes that change neither, and merges of the base moving no path the branch wrote, naming it `reelCarriedFrom`.
