---
title: Distribution
description: The marketplace entry, the install-shape traps it avoids, and the release wiring for the plugin manifest
---

# Distribution

`.claude-plugin/marketplace.json` at the repository root holds one entry whose `source` is `./claude`. The marketplace root is the directory holding `.claude-plugin/`, and a source resolves against that root rather than the manifest file.

Adding the marketplace and installing the one plugin is the whole install path. The `--plugin-dir` alias survives as the development path, where a local edit overrides the installed copy for that session.

## Install shape

### Why the source is `./claude`

Sourcing the repository root is the trap this shape avoids, and it was measured rather than reasoned about. Measured at `2022f604` on 2026-10-03.

- Skills are discovered at `<plugin-root>/skills/` unless the entry names them, and this repository keeps them a level down, so a root-sourced entry with no `skills` array exposes zero skills
- A root source costs 312M, because Claude Code runs a dependency install on any plugin with a package manifest and copies `.claude/` and the internal skills into the cache
- The installer runs a `bun install` it offers no way to skip, under a 60-second timeout, for any plugin root holding a `package.json` and a supported lockfile. This root holds both.
- Moving the source back to the root would also sweep 251 lines referencing `claude/skills` across `src/` and `scripts/`

The closest comparable project sources its root, which works only because its skills sit there. Revisit when the installer lets a plugin skip the install, or an `internal/` file surfaces in a target as something the plugin offers.

### Location enforces the plugin boundary

Toolkit-internal content lives under `internal/`, which nothing inside `claude/` reaches, and `src/gate/boundaries.ts` enforces it. The boundary does not keep internal files off a user's disk, since adding a git marketplace clones the whole repository.

The leak that first argued for the boundary, internal snippets surfacing in a target's catalog as if the plugin offered them, went with the retired snippets domain.

### The entry carries no version

`plugin.json` overrides the enclosing entry for both name and version. A version on the entry would drift on every release with nothing reporting it, and the release config writes only the plugin manifest.

### No symlinks in `claude/`

An installer dereferences any symlink under `claude/` and copies whatever sits behind it into every plugin cache, so a filterable subfolder behind the link still leaks. The retired `claude/standards` link shipped the standards corpus as real directories, at 964K with 55 skills against 760K without it.

- `internal/` holds internal content instead, and the Plugin boundary measure in `src/gate/boundaries.ts` walks the plugin tree with symlinks followed and fails on any file resolving under `internal/`
- The check pipeline does not follow symlinks. The index glob and the formatter were each tested against a linked directory, so none is double-walked and none produces drift failures.
- A native Windows checkout without symlink support materializes a link as a plain text file holding its target path, so a plugin carrying one ships a junk file and no stage notices

`claude/` carries no link today, so the Windows case binds the next one. `canon/context/sandbox/overview.md` treats Windows as a supported development environment, so this is a limitation to state rather than a case the pipeline can catch.

## Decisions

### The per-install subset lever

A marketplace entry's `skills` array adds to the conventional `<plugin-root>/skills/` scan rather than narrowing it. The documented restricting behavior is an artifact of the plugin root rather than a property of the field.

- An entry sourced at `./claude` naming four skill directories exposed all 59, and one naming a directory outside `skills/` exposed 60
- Where the resolved root has no `skills/` directory, the array becomes the only source, which both published examples of the field have in common
- Removing `plugin.json` from the subdirectory changes none of it, since the manifest governs name and version and leaves discovery to the root's layout

The shape that narrows here is a curated root holding one symlink per kept skill and no `skills/` directory, with the entry naming each path. Install dereferences the links, so the cache holds real directories at 104K against 964K for the full plugin.

- Measured at 64 skills, the full entry loaded all of them at roughly 8,300 always-on tokens, and a four-skill curated entry loads 4 at roughly 330
- The 8,300 is the 8,100 read at 63 skills scaled by total frontmatter bytes, not a fresh measurement

A curated entry drops every sibling a kept body cites. Install copies the named directories alone, so `${CLAUDE_SKILL_DIR}/../<skill>/references/<name>.md` resolves to nothing when the owner was not kept. The shared standards path reached 40 of the 64 bodies, so a curated entry has to answer each citation before it ships.

### The install ref reads as malformed

`claude plugin install canon@canon` is `<plugin>@<marketplace>` with both names set to `canon`, and the GitHub owner never enters the ref. It collides with the npm `@erclx/canon` form, where `@` marks an owner scope.

Renaming the marketplace to `erclx` would yield `canon@erclx` and was rejected, since it breaks the install string in every README, doc, and installed `settings.json`.

### A shape change and an installed cache

An installed plugin follows its marketplace where auto-update is on, which it is for the `canon` marketplace on the authoring machine. What remains is a shape change.

- A change to an entry's `skills` array reaches the reported inventory on refresh and never the cache, so `claude plugin details` can report a count the cache lacks
- `claude plugin update` reports the plugin current whenever the version key has not moved. Uninstall then install reconciles both.
- `claude plugin marketplace remove` leaves the cache directory behind, so nothing is reclaimed until the directory under `plugins/cache/` goes too

Publishing a shape change therefore strands anyone who has installed, unless the release moves the version the cache is keyed on. An entry resolving a `plugin.json` takes its key from that file's version, which `release-please` bumps, and an entry resolving no manifest is keyed on the source commit.

### Release

`plugin.json` carries `author`, `homepage`, `repository`, `license`, and `keywords` beside its name, version, and description. None change how the plugin loads. `claude plugin validate --strict` fails on missing attribution, and a stranger reads the manifest first.

- `release-please` writes `version` through `extra-files` in `release-please-config.json`, never by hand
- The manifest overrides the marketplace entry, so a shape declared at one version installs at another when they disagree, and `claude plugin tag` refuses to tag then
- Parity that depends on memory breaks on the first unwatched release. Release mechanics live in `canon/context/ci/releases.md`.

### Formatter exclusion for the manifests

`release-please` rewrites the whole manifest on each bump and expands `keywords` to one string per line, while oxfmt collapses any array that fits the print width. The two disagree at every release, so `ignorePatterns` in `.oxfmtrc.jsonc` excludes `**/.claude-plugin/*.json`.

- The `**/` prefix is load-bearing, since a pattern with an interior slash anchors to the config file's directory and would match nothing under `claude/`
- `claude plugin validate --strict` still gates the schema but runs author-side only, so CI checks neither format nor schema of these files
- A `!.claude-plugin/marketplace.json` negation follows the pattern, because the marketplace entry is hand-authored and written by nothing, and would otherwise sit outside the formatter and CI at once
- The negation must come after the pattern it undoes, because the last matching line wins

Version parity is a two-file problem. `package.json` and `plugin.json` are wired through `release-please`, and the entry carries no version to disagree. The validation stage in `bun run check` discovers manifests rather than naming them, so it reads `marketplace.json` with no entry of its own.

## Gotchas

### Skills and the CLI ship at two speeds

A skill merged to `main` reaches a `--plugin-dir` session at once, while the CLI reaches users only on release.

- A skill calling an unpublished verb fails in a target, and `canon sync --check` reports the version gap but not the missing verb
- A marketplace install is a cached copy, the same skew in the other direction, and nothing detects either

### What validation proves

Validation proves the manifest parses and nothing about whether it works. `claude plugin validate --strict` passes a manifest whose `source` points at a missing directory, so it would have accepted the zero-skill root-sourced shape.

An install is the only check that proves a shape, so `bun run check` covering this file does not retire the manual install.

### Reaching a shared reference

Delivering a shared reference and reaching it are separate problems. Each citing body names `${CLAUDE_SKILL_DIR}/../<skill>/references/<name>.md`, which lands on the owner skill beside it.

One path is enough, because no reference installs into a project and a citation has no project copy to fall back to. `draft-and-pick` citing `canvas-board`'s `canvas.md` is the concrete shape.

- Only `${CLAUDE_SKILL_DIR}` reaches the model already expanded to an absolute path. `${CLAUDE_PLUGIN_ROOT}` arrives as a literal string.
- A bare `../../` arrives unresolved and works only on the model's inferred base, which `claude/skills/create-skill/references/skill.md` bans
- Three probe skills in a project with no `.claude/` all reported the reference's sentinel, so content alone cannot separate expansion from a lucky guess. Ask a probe for the path it resolved.
- A guard on a reference's presence names the file under the plugin root rather than a directory in the target. `create-skill` carries that guard.

### The first executable in a skill

`role-orchestrator/scripts/` holds the poll and the watch as TypeScript, `poll.ts` and `watch.ts`, with the shared `repo.ts`, so the plugin carries code a target runs. `claude/skills/create-skill/references/skill.md` assigns `scripts/` to deterministic operations.

One other tracked non-markdown file, `review-ui/scripts/pw.sh`, sits beside them.

- `check:shell` and both shfmt stages glob `claude` for `.sh` files only, so they cover `review-ui/scripts/pw.sh` alone
- The type check reaches the scripts through the `claude/skills/*/scripts/**/*.ts` entry in `tsconfig.json`, which `include` needs because it names `src` alone otherwise
- oxfmt formats them with the rest of `claude/`, and the boundary walk reads every file, so it needs no entry

A shipped script executes in a target's environment, so it takes `bun` and `gh` from that machine and its base branch from `origin/HEAD` rather than assuming `main`. Its imports are `node:` builtins only, because a cached plugin root carries no `node_modules`.

A runbook can cite the script and a loop prompt cannot. `${CLAUDE_SKILL_DIR}` expands while a skill body renders, so a prompt pasted into a standalone turn carries the literal string. A block a session pastes holds a placeholder, and the prose above it says what to substitute.

### A verb refusal is a value

A shipped script calling a `canon` verb treats a refusal as ordinary, since a deleted branch makes `canon pr head` refuse for one open pull request. `run` in `repo.ts` returns the result of a command that failed or could not start rather than throwing.

- The next branch reads the record's own field and never the exit, which a shell function wrapping `canon` can flatten to zero
- The verb needs a fallback as well as a guard, because scripts ship with the plugin and verbs with the CLI
- `poll.ts` reads the pull request's own `headRefOid` when `canon pr head` returns nothing, the answer a target on an older binary gets

### Marketplace names

A marketplace name is one global slot per user. Adding a second marketplace under the same name replaces the first, and a local-path marketplace pointing at a worktree breaks when that worktree is removed.
