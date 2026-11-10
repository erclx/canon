---
title: Board frame values
description: The inventory run a plan records when the feature builds a rendered surface from picked board frames, and the question a total past the record raises
---

# Board frame values

Applies to `plan-feature` Step 1 when the feature builds a rendered surface from picked board frames. A round of picked mocks can carry many more values than the design record, and nobody sees the spread until rows are planned on it.

When the feature builds a rendered surface from picked board frames, run `canon inventory run <subject> --frames <files>` for `color`, `font-size`, `radius`, `shadow`, and `duration`, with each picked frame's HTML path as `frameboard list --json` reports it.

- Record each total line under `## Current behavior`
- When a total passes what the record carries, add a question suggesting a system row planned ahead of the build
