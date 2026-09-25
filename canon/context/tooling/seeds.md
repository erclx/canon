---
title: Seeds
description: Which files ship as seeds and which a config shadows, seed dictionaries, seed independence from the toolkit binary, capability seeding, install-order collisions, and the seed gate
---

# Seeds

## Overview

A seed is a file a target owns once installed, so sync writes it once and never overwrites it. This file covers which files seed, how the seed tree is kept honest, and where two seed sources collide. `canon/context/tooling/overview.md` states the config and seed boundary.

## Decisions

### Base's workflow and template are seeds

Base's `verify.yml` and PR template ship as seeds, since a polyglot target adds jobs to the workflow and lines to the template, and a config overwrite deletes them. Detecting a target's copy as a superset of the golden file and skipping the overwrite was the alternative, and it loses because containment over YAML breaks the first time the golden file renames a step. The cost is that a later change to either base file reaches no installed target, since `canon tooling diff` compares seeds for presence only.

A seed at a path any stack in the chain ships as a config is shadowed. `configPaths` in `src/tooling/manifest.ts` returns that set, and `scan` and `injectSeeds` both read it, so a web chain reports `.github/workflows/verify.yml` once, as a config, and the seed never writes a copy the config then overwrites.

Per-stack `ci.md` and `development.md` seeds are not shipped, because seeds are never overwritten. Stack references carry `## CI docs (extend)` sections telling the agent which rows to append instead.

### Spelling dictionaries sit with the file that spells the word

A word a new seeded config spells lands in that stack's own seeded dictionary, not this checkout's. The root `cspell.json` ignores `tooling/**`, so only a target that installs the stack and runs its own `check:spell` meets an unrecognized word there, and the sandbox scenario for that stack fails its spell check until the word is added.

The reverse holds too. The root `cspell.json` checks `canon/context/`, so naming a stack-specific word in an entry's prose needs that word in the root `.cspell/tech-stack.txt` as well as in the stack's seed.

`canon/context/tooling/testing.md` names the words each stack's seed carries for the verify run.

### Seed prose never names the toolkit binary

`tooling/*/seeds/**/*.md` prose may not name the toolkit CLI token literally, not even in a line explaining what an installed rule's own command citation refers to. `scripts/core/check-seed-independence.sh`, gated in `bun run check`'s Seed independence stage, greps every seed markdown file for the string and fails the run on a hit, since a scaffolded project may not have the CLI installed. Seed prose describing an optional capability states the capability rather than the binary, such as "a markdown-bans audit tool".

The check skips the token where a `/` follows, since that spelling is the tracked surface root the seed installs rather than the binary. A seeded `.sh` hook that calls the CLI on purpose sits outside the walk by extension, with no exemption list to maintain.

### Capability seeding

Whether a hook, a workflow, or a husky script installs turns on presence in its domain's seed or config source. `scripts/core/check-capability-seeding.sh` walks `.claude/hooks/`, `.github/workflows/`, and `.husky/` by filename against `tooling/claude/seeds/.claude/hooks/`, every `tooling/*/configs/.github/workflows/` and `tooling/*/seeds/.github/workflows/`, and `tooling/base/configs/.husky/`. It fails a source absent from every destination unless the file carries a `canon-no-seed:` comment naming why. A maintained exclusion list was the alternative, and it puts the reason a lookup away from the file it explains.

A second pass confirms every seeded hook name appears in a `command` string in the seeded `settings.json`, since a hook nobody wires in fails the same way as one that never shipped. `src/gate/` and the `scripts/core/check-*.sh` scripts are exempt by kind, because a target never receives this checkout's own build. Measured at `141885c2` on 2026-09-02.

The check stops at filename presence and never compares content, since a seed and its hook diverge by design. `standards-audit.sh` resolves `src/cli.ts` from this checkout while a seeded target resolves an installed binary, and `tooling/base/configs/.husky/post-merge` reads the records-push block's fields off its own `root`. Measured at `64a4297b` on 2026-09-07, against eleven tracked hooks: seven byte-identical to their seed, one diverging by design, and three carrying no seed.

### The seed gate

The seed tree is held to the standards it seeds by a `check` stage, not by a rule path. Widening the `paths` globs on the claude rules was the alternative, and it fires only when a session happens to edit a seed, which leaves a seed nobody touches wrong indefinitely.

The merge gate runs `context audit <root> --gate` against each `tooling/<stack>/seeds/` carrying a `.claude/` or a `canon/`, discovered per run through `scripts/core/list-seed-roots.sh` rather than listed, so a new stack is covered without an edit to the stage. A stack seeding only tracked surfaces carries `canon/` alone, which a `.claude/` test would drop.

The gate reaches only what the index-plus-entry contract covers, which is `tooling/base/seeds/canon/context/`. The claude tree seeds four folders holding an `index.md` and no entries, so the gate measures their indexes alone. `ARCHITECTURE.md`, `DESIGN.md`, and `REQUIREMENTS.md` sit under no audited folder, and reaching them needs an audit keyed to a document standard rather than a folder, which no command has.

A seed exempts itself from the section check with `stub: true` in its frontmatter, and both install paths strip the field so no target receives it. The exemption exists because a standard may sanction omitting a section and no measure separates that from a file that forgot it, the false-positive class a comment in `src/context/audit.ts` records. No seed sets the marker, since every skeletal seed still declares each section its standard requires, and marking one that passes would switch off a live check for nothing.

Stripping is duplicated across the two install paths because the seed trees are: `injectSeeds` in `src/tooling/inject.ts` for the stacks and `applySeeds` in `src/claude/seeds.ts` for the claude tree. Both narrow to `.md`, so hook scripts and `settings.json` copy byte for byte, and `src/seed-marker.ts` holds the one reader and the one stripper they share.

## Gotchas

### Two seed sources can write one destination

`canon init` runs base tooling before the Claude domain, and `pendingSeeds` skips any destination that already exists. A Claude-domain seed for a destination the base stack's `tooling/base/seeds/canon/context/` already fills is inert on the normal path and lands, empty, only on a bare `canon claude init`. Grep `tooling/*/seeds/.claude/` for the same destination before adding a file, since the resolution is by domain order in `src/commands/init.ts` rather than by intent.

The base stack owns `canon/context/index.md` and the claude tree ships none, though it seeds three sibling indexes. Base owns it because it seeds the entries listed, and two trees writing one path let install order pick the content. Without one the tree is not auditable, since `resolveFolders` skips a folder lacking it.

### A new claude seed folder needs its array entry

`planSeeds` in `src/claude/seeds.ts` iterates a literal `SUBDIRS` array rather than listing the tree, so a folder added under `tooling/claude/seeds/.claude/` or `tooling/claude/seeds/canon/` is invisible to `canon init`. The sandbox still shows it, because `inject_seeds` in `scripts/manage-sandbox.sh` copies the whole tree with `cp -r`, so the sandbox is the path that looks right. Pair every seed-folder addition with the `SUBDIRS` entry, an assertion in `scripts/core/install-check.sh`, and a run of `canon claude init` into an empty repository. The array order is also the install and timeline order, which `src/claude/seeds-list.test.ts` asserts.

### Splitting a seeded domain strands target-facing citations

The citation gate resolves every context-entry path against this repository's root, including lines instructing a target about its own tree, so those pass only while the toolkit's layout matches the layout it seeds. Splitting a seeded domain into a folder breaks every citation naming the domain's flat, target-facing path, since `tooling/base/seeds/` seeds a flat file and retargeting to the split path ships a path resolving nowhere in a scaffolded project.

Classify every citation site by whose tree it names before splitting a seeded domain. Keep the flat spelling on a target-facing line and suppress it with `<!-- audit-ignore-citations -->`, or reword to drop the path where a marker would ship into a file a target reads daily. The CI entry sits in this position, since it seeds a similarly flat file.
