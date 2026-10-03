# Architecture

Authoring guidance: `standards/architecture.md`.

## Overview

The toolkit is a CLI plus a Claude Code plugin, built so an agent can drive every surface a human can. Content is authored once at a project-root folder and reaches a target either through a `canon` install command or live from the plugin root.

This file holds only decisions that fill one of five slots: stack and runtime, delivery, enforced boundaries, layout, and build principles. Every other decision lives in the `canon/context/<domain>/` entry it constrains, which is also where a reader goes for how rather than why.

This record holds at most 12 decisions, at most 150 words a decision, and at most 6 risk bullets, and the Canonical records stage in `bun run check` fails a push past any of the three. Every decision closes with a revisit sentence.

## Key technical decisions

### TypeScript on Bun, with shell only as a small wrapper

Every surface is TypeScript on Bun, and shell stays only as a wrapper under 100 lines, the line the [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html) draws. Domains migrate from `scripts/` to `src/` one verb at a time. `bin` runs `src/cli.ts` directly through its shebang, so nothing compiles and no `dist/` can drift from the source.

Node with a build step was the alternative and costs a publish pipeline. The trade is that a target needs Bun installed, since `Bun.Glob`, `Bun.TOML`, and `Bun.YAML` replace parser dependencies. A folder is named for its role, not its language. `canon/context/cli/overview.md` carries the migration state. Revisit when a target cannot run Bun, or Node runs shipped TypeScript with no build step.

### Two delivery paths rather than one

`canon` commands copy governance rules, tooling configs, and design files into a project, and the marketplace plugin loads skills live from `claude/`. Copied content is what a project edits and owns, so it lands as files under version control.

A skill is toolkit-owned process that goes stale the moment it is copied. A single channel was the alternative, and neither channel does the other's job. The cost is a citation crossing the split: a skill naming an installed path resolves only where that install ran. So a file only one skill reads travels inside that skill. Revisit when a plugin install can write files a project then owns, or a copied skill is re-synced on every session.

### Something other than the model resolving a file by path decides whether it installs

A domain installs as a file when something other than the model resolves it by path, and ships as a command when only a session's own judgment would open it. The harness glob-loads a rule, and a target's build tooling reads a config or `.claude/design/base.css` off its path, so each installs. A standard is opened by the model on purpose, so `canon standards` carries no install and no sync.

Deciding case by case lost to writing the criterion down. `canon/context/standards/resolution.md` carries the closed install channel. Revisit when Claude Code loads a document on demand from a catalog of its own.

### Skills call the CLI and never reimplement it

A plugin skill reads a catalog through `canon <domain> list --json` and acts through the CLI under `CANON_NON_INTERACTIVE=1`. Every domain owes a `list --json` verb, and no skill hardcodes a rule or stack name, which keeps one behavior in one place.

Restating catalogs in skill bodies was the alternative, and it drifts on its own cadence. The rule covers catalogs, not documents: a skill reads a standard by path off the `claude/standards` symlink, and a rule names `canon standards <name>`, since a rule loads with no skill context. Revisit when skills failing on a verb the installed binary lacks outnumber the drift restated catalogs would cause.

### Location enforces the plugin boundary

Toolkit-internal content lives under `internal/`, which nothing inside `claude/` reaches, and the marketplace sources the plugin from `./claude` rather than the root. `src/gate/boundaries.ts` follows symlinks across the shipped tree and fails on any file resolving under `internal/`.

Sourcing from the root was the alternative. The plugin installer runs a `bun install` it offers no way to skip into every cached version whose root holds a `package.json` and a lockfile, and this root holds both. Revisit when the installer lets a plugin skip that install, or an `internal/` file surfaces in a target as something the plugin offers.

### Three tiers of context, bounded by slots

`CLAUDE.md` and this file load eagerly, `.claude/rules/` load on glob match, and `canon/context/` is read on demand through its `index.md` catalog. One large `CLAUDE.md` grows without bound. Nested `CLAUDE.md` files load cheaply but announce nothing, so a session never learns they exist.

The eager tier is bounded by what it may hold, a slot, rather than by reach, since nearly every decision touches two domains. A gated cap holds where an ungated length ceiling did not. `canon/context/context-model/overview.md` carries the test sorting a fact between tiers. Revisit when Claude Code tells a session which nested memory files exist before it opens them.

### Whether a file is committed, and whether Claude Code reads it, decides which root it sits under

Two tests sort the project's roots in order. Whether a file is committed separates `.canon/`, every gitignored session record, from the rest. Whether Claude Code reads it by path then separates `.claude/`, holding `rules`, `skills`, `hooks`, and `settings.json`, from `canon/`, holding what the toolkit authors and commits. Both lines are mechanical, which is their value.

Sorting by what a folder is for was the alternative, and every new folder then needed a judgment and an ignore line. `canon/context/context-model/overview.md` carries what each root holds. Revisit when Claude Code reads its files from a root a project can configure.

### Build principles

- A hook, a gate stage, or a verb enforces what prose only states. Each one says what it does when its inputs are missing rather than reporting a pass.
- A standard governs an artifact's shape, and the skill driving it governs the procedure.
- A rule the model can talk itself out of moves into a verb.
- A safe behavior sits on the default path, not behind a flag.

The four share one premise, that a model follows a prose rule only when a session happens to read it. Each domain entry carries its instances. Revisit when a measured run shows a prose rule followed as reliably as a gate enforces it.

## Risks / open questions

- Skills and the CLI ship at two speeds. A skill merged to `main` reaches a `--plugin-dir` session at once, while the CLI reaches users only on release, so a skill calling an unpublished verb fails in a target, and `canon sync --check` reports the version gap but not the missing verb.
- A marketplace install is a cached copy, the same skew in the other direction, and nothing detects either.
- `800-prose`, the teach rule, and `605-worktrees` point at a plugin skill that a project installing governance alone does not have. Each rule tells the session to say so, which reports the gap without closing it.
- An exit code says nothing about a `canon` call here, since a shell profile may wrap the binary, so every task verb tells a caller to branch on the record's `reason`.
- Verification anchors are re-checked only when a diff touches the decision they mark.
- A Windows checkout without symlink support turns `claude/standards` into a plain file, so the plugin ships no standards and no stage notices.
