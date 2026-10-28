---
title: Claude plugin
description: The plugin skills shipped to target projects, the manifest and marketplace entry that deliver them, the canon claude CLI, and the seeds it lands in a target
---

# Claude plugin

## Overview

Owns everything the toolkit ships outward under the Claude domain, being the plugin skills in `claude/skills/`, the manifest and marketplace entry that deliver them, and the `canon claude` verbs that seed a target.

A skill loads live from the plugin root and stays toolkit-owned, while a seed is copied once and then belongs to the project. Skills call the CLI and never reimplement it, and the toolkit's internal skills sit outside the boundary.

## Layout

### `claude/`

The plugin root, the directory the marketplace entry sources. Everything under it reaches every installed cache.

- `.claude-plugin/plugin.json` is the manifest. Its `name` is `canon`, which namespaces each invocation as `/canon:<skill>`, and `release-please` writes its `version`.
- The root holds no symlink, since an installer copies what sits behind one into every cache. The Plugin boundary measure in `src/gate/boundaries.ts` fails on any file resolving under `internal/`.
- A script under a skill imports `node:` builtins only, because a cached plugin root carries no `node_modules`, and reads its base branch from `origin/HEAD`
- `poll.ts` routes on what `canon pr review-state` reads off a review's first line, `## Review` or `## UI review` and a `closed` form of each, so renaming one in a review skill silently stops routing
- `tsconfig.json` reaches `claude/skills/*/scripts/**/*.ts` through its own `include` entry, and the shell stages glob `claude` for `.sh` files alone

### `claude/skills/`

Owns the plugin skills, one flat kebab-case folder each with a `SKILL.md`. Discovery is by folder presence with no registration, and a skill nested under a category folder is not discovered.

- `REQUIREMENT.md` beside `SKILL.md` holds the skill's gap statement. A body change tests against it, and a `## Must` line moves in the same change as the body line implementing it.
- `references/` holds each artifact's shape reference, cited by a sibling as `${CLAUDE_SKILL_DIR}/../<owner>/references/<name>.md`, and a path resolving only here fails the Skill paths stage
- `role-orchestrator/scripts/` holds `poll.ts` and `watch.ts`, the one executable code the plugin carries, run in a target by that machine's `bun` and `gh`
- A new skill needs `metadata.family`, a routing case in `src/claude/cases/`, and a regenerated hero frame, per the Sync checklist in `.claude/skills/internal-claude/SKILL.md`
- A body writing shared scratch at the main worktree root names its route per `claude/skills/session-worktree/references/main-root-writes.md`, since `Edit` and `Write` refuse it from a linked worktree

### `.claude-plugin/`

Holds `marketplace.json`, the catalog an installer adds. Its `canon` entry sets `source` to `./claude`, resolved against the folder holding `.claude-plugin/`, and its `canon-media` entry sets `./plugins/canon-media`.

- The entries carry no version, since the manifest overrides it and a second copy would drift with nothing reporting it
- A root source exposes no skills and copies `.claude/` and the internal skills into each cache, since discovery reads `<plugin-root>/skills/`
- `**/.claude-plugin/*.json` is excluded from oxfmt because `release-please` serializes the manifest its own way, and the marketplace file is re-included because nothing else writes it
- `claude plugin validate --strict` accepts a manifest whose `source` points at nothing, so an install is the only proof of a shape

### `plugins/canon-media/`

Holds the opt-in bundle, a manifest with no skills that depends on `canon`, `hyperframes@hyperframes`, and `frameboard@frameboard`. Installing it installs all three, and plain `canon` gains no dependency.

- It sits outside `claude/` because everything there reaches every canon install's cache
- `release-please` writes its `version` beside canon's, since `--strict` validation fails a manifest with none
- The marketplace's `allowCrossMarketplaceDependenciesOn` lists `hyperframes` and `frameboard`, and an install still resolves them only after the user adds both marketplaces

### `src/claude/`

Owns the logic behind `canon claude`, with its verbs registered in `src/commands/claude.ts`.

- `seeds.ts` plans and applies the `init` copy, `seeds-list.ts` reads the same plan, and `settings.ts` merges the user-level config `setup` writes
- `gitignore.ts` reconciles a target's `.gitignore` against `tooling/claude/manifest.toml`, the only file `sync` writes
- The `skills-*.ts` modules read the shipped catalog for the `skills` verbs, being list, audit, families, headings, drift, reach, and rank
- `routing.ts` counts the bullets per `CLAUDE.md` section that name a path, and `plugin-update.ts` backs `plugin-update`
- `cases/` holds the routing corpus `skills rank` scores against, and `all.test.ts` fails until every shipped skill has a case

### `tooling/claude/`

Holds what `canon claude init` lands, and `claude` is excluded from `canon tooling` discovery.

- `seeds/` carries the `CLAUDE.md` seed, `.claude/settings.json`, its hook scripts, and the `canon/DESIGN.md` and `canon/REQUIREMENTS.md` starters
- `manifest.toml` declares the `.gitignore` section `sync` reconciles, one `.canon/` root entry plus two `.claude/` carve-outs
- `user/` holds what `setup` installs into `~/.claude/`, being the statusline script and the settings template
- `setup` is the only verb writing outside a target, and it refuses this repository's own `.claude/`
- The seeds install no `canon/context/` entry, since `tooling/base/seeds/canon/context/` owns that folder

### Other folders

The skills and rules around the plugin each own one slice.

- `web/card-src/` owns the social card route, Astro only since `srcDir` excludes it from a build, and it reads only properties `canon design css` emits, as an undefined one silently falls back
- `docs/workflow/` owns the skill map a coverage claim is measured against, one row per skill
- `.claude/skills/` owns the toolkit-internal `internal-*` skills, covered in `canon/context/workflow/internal-skills.md`
- `sandbox/claude/` owns the per-skill scenarios that provision a seeded project for a headless run
- `src/labels/` and `src/feedback/` own the verbs `git-pr`, `git-issue`, and `canon-feedback` call, labelling from `canon/config/pr-labels.toml` and filing or following up on a toolkit issue

## Gotchas

- A skill merged to `main` reaches a `--plugin-dir` session at once while its verb waits for a release, so a body calling an unpublished verb fails in a target and `canon sync --check` misses it
- Only `${CLAUDE_SKILL_DIR}` reaches the model already expanded, while `${CLAUDE_PLUGIN_ROOT}` arrives as a literal string and a bare `../../` resolves only on the model's inferred base
- A skill reading `canon sync --check --json` treats an absent key as unread rather than empty, since an older binary omits it and an empty read reports a clean target nothing measured
- A skill carrying `disable-model-invocation` is refused by the `Skill` tool too, so a chain step cannot delegate to it and must point at an unflagged body
- Nothing checks that `target-check`'s body, `references/domains.md`, and its requirement keep the same six domains, and `document-health` is absent from them by design
