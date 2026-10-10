---
title: Distribution
description: The marketplace entry, the install-shape traps it avoids, and the release wiring for the plugin manifest
---

# Distribution

`.claude-plugin/marketplace.json` at the repository root holds one entry whose `source` is `./claude`. The marketplace root is the directory holding `.claude-plugin/`, and an entry's source resolves against that root rather than against the manifest file. Adding the marketplace and installing the one plugin is the whole install path. The `--plugin-dir` alias survives as the development path, where a local edit overrides the installed copy for that session.

Sourcing the repository root instead is the trap this shape exists to avoid, and it was measured rather than reasoned about. Skills are discovered at `<plugin-root>/skills/` unless the entry names them explicitly, and this repository keeps them a level down, so a root-sourced entry carrying no `skills` array exposes zero skills. It also costs 312M, because Claude Code runs a dependency install on any plugin carrying a package manifest and copies `.claude/` and the internal skills into the cache. The closest comparable project sources its root, which works only because its skills sit there.

The dependency install is the cost that still argues for the `./claude` source. The plugin installer runs a `bun install` it offers no way to skip, under a 60-second timeout, into every cached version of a plugin whose root holds a `package.json` and a supported lockfile, and this repository's root holds both. Moving the source back to the root would also sweep 251 lines referencing `claude/skills` across `src/` and `scripts/`. Measured at `2022f604` on 2026-10-03.

The `internal/` boundary does not keep internal files off a user's disk, since adding a git marketplace clones the whole repository with `internal/` in it. The leak that first argued for the boundary, internal snippets surfacing in a target's catalog as if the plugin offered them, went with the retired snippets domain.

`claude/standards` is a symlink to the root authoring source. A symlink inside a plugin that resolves elsewhere within the marketplace is dereferenced at install and its content copied, so the files arrive as real directories in the cache. The measured install is 964K with 55 skills, against 760K for the same shape without the symlinks.

The entry carries no version on purpose. `plugin.json` overrides the enclosing entry for both name and version, so a version on the entry would drift on every release with nothing reporting it, and the release config writes only the plugin manifest.

The check pipeline does not follow the two symlinks. The index walker's glob, the spell checker, and the formatter were each tested against a symlinked directory in isolation, so `standards/` is not double-walked and the links produce no drift failures.

## Distribution gotchas

Validation proves the manifest parses and nothing about whether it works. `claude plugin validate --strict` passes a manifest whose `source` points at a directory that does not exist, so it would have accepted the zero-skill root-sourced shape. An install is the only check that proves a shape, which is why `bun run check` covering this file does not retire the manual install.

### Reaching a standard

Delivering a standard and reaching it are separate problems. Each citing body names `${CLAUDE_SKILL_DIR}/../../standards/X.md`, which lands on the dereferenced symlink beside `skills/`. One path is enough, because no corpus installs into a project, so there is no project copy for a citation to fall back to. `git-commit` citing `versioning.md` is the concrete shape of the form.

Only `${CLAUDE_SKILL_DIR}` survives to the model as an already-expanded path. Measured across three probe skills in a project with no `.claude/`, the body arrived with that variable already expanded to an absolute path, while `${CLAUDE_PLUGIN_ROOT}` reached the model as a literal string and a bare `../../` arrived unresolved, working only because the model inferred a base, which is the inference `standards/skill.md` bans a bare relative path to avoid. All three probes reported the standard's sentinel, so the content read looked the same across them. Ask a probe for the path it resolved rather than the content it read, since content alone cannot separate expansion from a lucky guess.

A guard on a standard's presence names the file under the plugin root rather than a directory in the target. `create-skill` carries that guard.

### The first executable in a skill

`role-orchestrator/scripts/` holds the poll and the watch as TypeScript, `poll.ts` and `watch.ts`, with the `repo.ts` they share, so the plugin carries code a target runs as well as prose. It sits in `scripts/` rather than beside the runbook that invokes it, because `standards/skill.md` splits a skill folder by role and assigns `references/` to detail and `scripts/` to deterministic operations. One other tracked non-markdown file, `review-ui/scripts/pw.sh`, sits beside them.

The three shell stages no longer reach the TypeScript scripts. `check:shell` and both shfmt stages glob `claude` for `.sh` files only, so `review-ui/scripts/pw.sh` is all they cover there. The type check reaches the scripts through the `claude/skills/*/scripts/**/*.ts` entry in `tsconfig.json`, which `include` needs because it names `src` alone otherwise and an unchecked shipped program is the gap a rewrite exists to close. Prettier formats them with the rest of `claude/`. The boundary walk needs no entry of its own, since it reads every file rather than every markdown file.

A shipped script is not a shipped standard. It executes in a target's environment rather than being read there, so it takes its dependencies from that machine, being `bun` and `gh`, and its base branch from `origin/HEAD` rather than assuming `main`. Its imports are `node:` builtins only, because the plugin ships `claude/` alone and a cached plugin root carries no `node_modules`, so nothing under `src/` and no package resolves there. A second script inherits the type check and the obligation to assume nothing about the repository it lands in.

A runbook can cite it and a loop prompt cannot. `${CLAUDE_SKILL_DIR}` expands while a skill body renders, so a prompt pasted into a standalone turn carries the literal string instead of a path. A block a session is meant to paste therefore holds a placeholder and the prose above it says what to substitute.

A shipped script calling a `canon` verb has to treat a refusal as a value. A refusal is ordinary rather than exceptional, since a deleted branch makes `canon pr head` refuse for one open pull request, so `run` in `repo.ts` returns the result of a command that failed or could not start rather than throwing, and the next branch reads what came back. The branch is taken on the record's own field and never on the exit, which a shell function wrapping `canon` can flatten to zero.

The verb also needs a fallback rather than only a guard, since these scripts ship with the plugin and the verbs ship with the CLI. `poll.ts` reads the pull request object's own `headRefOid` when `canon pr head` returns nothing, which is the behavior the poll already had and the answer a target on an older binary gets.

### What a symlink costs

A symlink is an entry point that cannot filter. An installer dereferences `claude/standards` and copies whatever sits behind it into every plugin cache with no code in the path to stop it. A filterable subfolder such as `standards/canon/` still leaks through the symlink ahead of it.

Internal content lives at `internal/` instead, which nothing under `claude/` reaches. The Plugin boundary measure in `src/gate/boundaries.ts` walks the plugin tree with symlinks followed and fails on any file resolving under `internal/`, measuring what an install actually copies rather than trusting a filter upstream of it.

A native Windows checkout without symlink support materializes the link as a plain text file holding the path `../standards`. The plugin then ships a junk file and no standards, and no stage notices, because every catalog command reads the real directories at the repository root. `canon/context/sandbox/overview.md` treats Windows as a supported development environment, so this is a limitation to state rather than a case the pipeline can catch.

A marketplace name is one global slot per user. Adding a second marketplace under the same name replaces the first, and a local-path marketplace pointing at a worktree breaks when that worktree is removed.

## The per-install subset lever

A marketplace entry's `skills` array adds to the conventional `<plugin-root>/skills/` scan rather than narrowing it. An entry sourced at `./claude` naming four skill directories exposed all 59, and the same entry naming one skill directory outside `skills/` exposed 60. The documented restricting behavior is an artifact of the plugin root rather than a property of the field. Where the resolved root carries no `skills/` directory, the conventional scan contributes nothing and the array becomes the only source, which is what both published examples of the field have in common.

Removing `plugin.json` from the subdirectory changes none of it. The manifest governs name and version and leaves component discovery to the root's own layout, so whether that root carries `skills/` is what decides.

The shape that narrows in this layout is a curated root holding one symlink per kept skill and no `skills/` directory, with the entry naming each path. Measured when the plugin shipped 64 skills, the full entry loaded all of them at roughly 8,300 always-on tokens, and a four-skill curated entry loads 4 at roughly 330. The 8,300 is the 8,100 read at 63 skills scaled by total frontmatter bytes rather than a fresh measurement. Install dereferences the symlinks the way it does `claude/standards`, so the cache holds real directories at 104K against 964K for the full plugin.

What that shape drops is the standards fallback. Install copies the named skill directories alone, so no `standards/` sibling arrives, and a skill sitting one level under the curated root rather than two under the plugin root resolves `${CLAUDE_SKILL_DIR}/../../standards/X.md` to nothing. That reached 40 of the 64 bodies shipping at that measurement, which all lose their fallback at once, and a curated entry has to answer it before one ships.

### The install ref reads as malformed

`claude plugin install canon@canon` is `<plugin>@<marketplace>` with both names set to `canon`, and the GitHub owner never enters the ref. It reads as malformed against the npm `@erclx/canon` form, where `@` marks an owner scope, and the two identifier systems collide on one symbol. Renaming the marketplace to `erclx` would yield `canon@erclx` and was rejected, since it breaks the install string in every README, doc, and installed `settings.json`.

### What a shape change does to an installed cache

An installed plugin follows its marketplace where auto-update is on, which it is for the `canon` marketplace on the authoring machine, so a version lag is not the usual failure. What remains is a shape change.

A change to an entry's `skills` array reaches the reported inventory as soon as the marketplace refreshes and never reaches the cache: `claude plugin details` answers from the entry rather than from what an install materialized, so its reported count can outrun the cache directory's own contents. `claude plugin update` declines the work and reports the plugin already current whenever the version key has not moved. Uninstall followed by install reconciles both.

Publishing a shape change therefore strands anyone who has already installed, unless the release moves the version the cache is keyed on. An entry resolving a `plugin.json` takes its key from that file's version, which `release-please` bumps, so a shape change riding a release materializes and one shipped without a bump does not. An entry resolving no manifest is keyed on the source commit instead.

`claude plugin marketplace remove` leaves the cache directory behind. Removing a marketplace reclaims nothing until the directory under `plugins/cache/` goes as well.

## Release

`plugin.json` carries `author`, `homepage`, `repository`, `license`, and `keywords` beside its name, version, and description. None of the five change how the plugin loads. They exist because `claude plugin validate --strict` treats missing attribution as a failure, and because a manifest reaching an installer is the first thing a stranger reads about the project.

Its `version` is written by `release-please` through the `extra-files` wiring in `release-please-config.json`, never by hand. The manifest overrides the enclosing marketplace entry for both name and version, so a shape declared at one version installs at another when the two disagree, and `claude plugin tag` refuses to tag in that state. Parity that depends on someone remembering breaks on the first release nobody is watching, which is why the tool owns the field rather than a convention. The mechanics of the release itself live in `canon/context/ci/releases.md`.

Owning the field means owning the file's serialization. `release-please` rewrites the whole manifest on each bump and expands `keywords` to one string per line, while prettier collapses any array that fits the print width, so the two disagree at every release rather than once. `.prettierignore` excludes `**/.claude-plugin/*.json` to settle it, which leaves the release tool as the only formatter of the manifests it writes.

The `**/` prefix is load-bearing, since a pattern carrying an interior slash anchors to the ignore file's directory and `.claude-plugin/*.json` would match nothing under `claude/`. `claude plugin validate --strict` still gates the schema, though that stage is author-side only, so CI checks neither the format nor the schema of these files.

The class pattern overreaches by one file, so a `!.claude-plugin/marketplace.json` negation follows it. The exclusion earns its place for a file a release tool rewrites, and the marketplace entry is hand-authored, carries no version, and is written by nothing. Without the negation it would sit outside the formatter and outside CI at once, since the validation stage runs author-side only. The negation has to come after the pattern it undoes, because the last matching line wins.

Version parity is a two-file problem. `package.json` and `plugin.json` are wired through `release-please`, and the marketplace entry carries no version to disagree with them. The validation stage in `bun run check` discovers manifests rather than naming them, so it reads `marketplace.json` with no entry of its own.
