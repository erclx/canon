---
title: Tooling
subtitle: Stacks and their layering, manifests, seeds and the seed gate, the served port and capture seed, and the end-to-end verify. Start with overview.
---

# Tooling

Stacks and their layering, manifests, seeds and the seed gate, the served port and capture seed, and the end-to-end verify. Start with overview.

- [Capture and ports](capture.md): The web stack's derived server port, the capture seed layout, evidence frames, the screenshot wrapper teardown, and render determinism
- [Manifests and layering](manifests.md): Manifest blocks and what each injects, which layer wins a duplicate, gitignore merging, the ignore-parity check, and subfolder and monorepo sync
- [Overview](overview.md): What the tooling domain owns, configs against seeds, the authority an overwrite needs, the diff verb, the application-code carve-out, and adding a stack
- [Seeds](seeds.md): Which files ship as seeds and which a config shadows, seed independence from the toolkit binary, capability seeding, install-order collisions, and the seed gate
- [Stacks](stacks.md): Per-stack decisions, being the toolchain stacks off base, script overrides, the astro scenario switcher, the lint conventions, and the astro, nextjs, and vite-react scaffold fixes
- [Testing](testing.md): The end-to-end tooling verify, which stack to verify a parent-layer edit through, resolving the checkout rather than PATH, browser installs, and the unit coverage
