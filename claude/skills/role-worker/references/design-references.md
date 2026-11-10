---
title: Building against design references
description: How a worker opens a plan's design references and reference images before editing a surface, and where it takes sizes, spacing, and colors from
---

# Building against design references and images

Part of `role-worker`'s `## Where the session stands`. The session reads this file before the first edit to a surface a plan's `## Design references` or `## Reference images` names.

A plan's `## Design references` names the accepted design per surface, and `## Reference images` names images it was shaped against by main-root path. Either can appear alone. Open both before building, since a worker reading the dark image alone ships a light theme nobody saw.

- Open each cited folder's light and dark images and its frame HTML before the first edit to that surface
- Take sizes, spacing, and colors from the frame HTML rather than from the image
- Report a missing reference by its path rather than building without it
- Leave `None identified.` as it stands and build without a reference
