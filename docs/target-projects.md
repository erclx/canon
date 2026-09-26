---
title: Target projects
description: Scaffold, add domains later, and sync upstream drift in a toolkit-managed project
category: Agent surface
---

# Target projects

How a project outside this repo consumes the toolkit across its lifecycle. Three phases: scaffold once, add a domain later when a new need appears, and sync when the upstream toolkit moves.

This doc stays at the narrative layer. For command flags and JSON shapes, see [agents](agents/index.md). For per-domain mechanics, see each `canon/context/<domain>.md`.

## Getting the skills

The skills reach a session through a marketplace install, once per machine. Every session on that machine carries them afterward, and the installed copy stays at the version it was installed at. Claude Code ships auto-update off for third-party marketplaces, so neither a push nor a release reaches that copy until someone refreshes it with `claude plugin marketplace update canon` followed by `claude plugin update canon@canon`, or turns auto-update on once under `/plugin`. The `canon` CLI moves on its own schedule through the registry, so a machine can hold current skills against a stale CLI or the reverse.

```bash
claude plugin marketplace add https://github.com/erclx/canon
claude plugin install canon@canon
```

The URL form clones over HTTPS. The `erclx/canon` shorthand resolves to SSH and fails on a machine with no key configured.

A machine that installed the plugin under its previous name re-registers by hand, once. The marketplace and the plugin both moved, so the old `enabledPlugins` entry and the old marketplace key name things that no longer resolve, and the plugin stops loading without reporting anything. `canon migrate rename` does not reach this: it takes a `--root` and rewrites inside one project, where the plugin registration is machine-level state outside every project.

Both stale keys come out explicitly, since installing under the new name writes a new entry and leaves the old one sitting there. Uninstall before removing the marketplace, so the plugin is cleared while the marketplace it came from still resolves.

```bash
claude plugin uninstall aitk@aitk
claude plugin marketplace remove aitk
claude plugin marketplace add https://github.com/erclx/canon
claude plugin install canon@canon
```

The `canon` CLI is separate. Twenty skills invoke it in a command position, and a marketplace install does not put it on `PATH`, so it installs from the registry as its own step.

```bash
bun install --global @erclx/canon
```

The package ships the catalogs the CLI reads, not only `src/`, so `canon init` resolves governance, tooling, and the seeds from wherever the package landed, and `canon standards <name>` reads the corpus from there too.

Pointing Claude Code at a checkout stays the development path, where a local skill edit overrides the installed copy for that session.

```bash
claude --plugin-dir <toolkit>/claude
```

## Scaffold

Two steps, in order:

1. Run the framework's own scaffold if the project needs one, such as `bun init`, `npm create vite`, or `npm create astro`. The toolkit does not wrap framework scaffolding.
2. Invoke `canon:target-setup` in Claude Code. The skill detects the stack, resolves flags, previews the full chain, and runs it end-to-end.

The chain is:

- `canon init` installs base tooling, Claude seeds, and governance rules into `.claude/rules/` in the same pass
- `canon tooling sync <stack> --write` adds stack-specific deps, scripts, and gitignore entries
- The agent reads `canon tooling reference <stack>` (plus parents) as its audit context, follows it to generate eslint, vitest, playwright configs and the stack's setup script, and extends `canon/context/ci.md` and `canon/context/development.md` per the reference's extend sections <!-- audit-ignore-citations: canon/context/ci.md, canon/context/development.md -->
- The `verify` phase runs the installed `package.json` scripts (lint, typecheck, check, test, build) and reports pass or fail
- The `indexes` phase bootstraps the `index.md` system over the project's own documentation folders, confirming candidate folders with the operator rather than running unattended

The chain stops at the project edge. `repo-metadata` and `git-commit` also ship, reaching a remote and the project's history respectively, and neither runs as part of it. The chain serves a fresh scaffold and names a destination for the three states it does not. An existing project goes to `canon:canon-operator`, which reads what the project already carries before naming a per-domain command. An install wanting the Claude layer without the tooling chain runs `canon claude init` for the seed docs and then `canon:target-setup indexes` for the index system. A language the toolkit ships no stack for is the one of the three the chain still runs for, on `base`, with the fallback marked in the preview so it can be declined there.

Run `canon:target-setup verify deep` by hand once the default depth passes, for the heavier server smoke, end-to-end, and screenshot pass, since the same flakiness reasons that keep those stages out of the default depth keep them out of this unattended chain too.

Keep the `## Scripts` table in `canon/context/development.md` current as scripts are added. Base tooling seeds that entry with the commands it installs, and each stack reference extends the table. `project-commands` reads it to start the app or run a check on request, so a command missing from the table cannot be run that way. A project whose entry outgrew one file and split into `canon/context/development/` keeps the table in `overview.md`, which is where the skill looks next. <!-- audit-ignore-citations: canon/context/development.md -->

### From scaffold to first feature

Scaffold installs tooling and seeds. It does not fill the planning docs or the design system. Complete those before the first feature session:

1. Fill `canon/REQUIREMENTS.md` and `canon/ARCHITECTURE.md`. The seed provides the files, the scope and decisions are yours to write.
2. For a UI project, invoke `canon:design-extract` to draft `canon/DESIGN.md`. With no UI code yet it takes the greenfield path and proposes tokens from the requirements and a `## Personality` section. Skip for non-UI projects.
3. Optionally invoke `canon:draft-diagram` to draft entries under `.canon/diagrams/` from the architecture and the requirements. One file per diagram kind, so a later refresh of one kind leaves the others untouched. It renders each diagram it writes to verify the layout, which downloads the Mermaid CLI on first use and takes about 15 seconds.
4. Start the feature loop. See [AI workflow](workflow/ai-workflow.md) for the per-feature sequence.

A machine without a renderer still gets the diagrams and is told which check was skipped.

Each diagram entry records the commit and date it was last verified against, and nothing maintains that record for you. The folder is redrawn on demand rather than swept on every ship, so `verified` carries the whole signal: an entry whose date sits far behind your branch is due a read, and no pass will name which one. Run `canon:draft-diagram` again when the code a kind is drawn from moves.

`canon/ARCHITECTURE.md` carries the same mechanism on the same ship. `canon:context-fold` anchors a decision it amends to the paths that decision cites, and reports an anchored decision whose cited path the branch touched.

### Stack decision

The default path is `base`. `canon init` on `base` installs base tooling configs, Claude seeds, and governance core rules, and scaffolds an empty `.claude/wiki/`. Most projects need nothing more.

Escalate only for real web apps. The `target-setup` skill reads `package.json` and the framework configs, then picks the matching tooling stack (`canon tooling list --json` names the current set) and the matching governance stack (`react`, `nextjs`, `astro`, `node`). A Next.js app lands on `nextjs`, which extends `react` with the App Router rule a Vite React app does not get.

In a monorepo the skill reads each folder holding a `package.json`, `pyproject.toml`, `go.mod`, `composer.json`, or `Cargo.toml` to depth two, skipping what git ignores. Each of those folders gets its own tooling stack and a `canon tooling sync <stack> <folder> --skip base` in the preview. Governance still installs once at the root, since a rule's `paths:` globs reach every subfolder, so a subfolder's language rules join the root install through `--add`.

`node-server` is named rather than detected. It carries the server-side security and persistence rules for a project writing request handlers or a persistence layer in TypeScript, and the detect step matches a runtime or a framework against stack names, so nothing there marks a project as a backend. Pass it deliberately with `canon init --stack node-server` or `canon gov install node-server <target>`.

Markdown-heavy projects, CLI tools, docs sites, research notebooks, and scripting repos stay on `base`. Escalation is a ceiling move, not a default.

A project the toolkit ships no stack for lands on `base` the same way, and the skill marks that resolution as a fallback in its preview rather than reporting it as a match. Configs, seeds, and gitignore entries land either way, and the JavaScript development dependencies, scripts, and hook activation land only where a `package.json` exists to carry them. A project outside that ecosystem declines at the preview and takes `canon:target-setup gov` for the governance layer alone, which is language-neutral. Go and PHP ship tooling stacks but no governance stack, so a project in either takes the `go` or `php` tooling stack, lands on `base` for governance, and picks up its language and testing rules through `--add`, for example `canon gov install base --add 130-go,335-testing-go .`

Run `canon tooling list --json` and `canon gov list --json` to see the current catalogs. Never hardcode stack names.

### Core domains and skips

`canon init` installs base tooling, Claude workflow, and governance, and scaffolds `.claude/wiki/`. Governance defaults to the `base` stack, so a bare init carries the rules that route a project. Pass `--stack <name>` to install a framework stack instead.

No standard is written into the project. Each governance rule's authority line names `canon standards <name>`, which answers from the corpus inside the CLI's own package, and every toolkit skill names the copy in its own plugin root. `canon markdown audit` needs no standard at all, its ban set and checkpoints shipping with the package as data.

No snippet is written into the project either. `claude/snippets` in the plugin cache symlinks to the toolkit's own `snippets/`, so a session reaches one at its `@` reference with no install step, the same live resolution `claude/standards` gives a rule's authority line.

`governance` and `wiki` are skippable:

- `--skip governance`: leave `.claude/rules/` empty, so no coding standard loads on a file match. The preview names any `--add` rules the skip drops, and the run prints the `canon gov install <stack> <path>` command to add rules afterward, carrying those extras so one paste restores what the skip declined.
- `--skip wiki`: skip the `.claude/wiki/` scaffold. A target that already carries a root `wiki/` keeps it, since the verb reports that folder rather than migrating it.

The plugin corpus carries runtime behavior rather than reference prose alone, because the pre-publish scan and the branch-slug transform each have a standard of their own, `publish.md` and `slug.md`, cited by the skills that run them.

## Add a domain later

When a new need appears after scaffold, install the one domain without re-running `canon init`.

- Governance rule for a newly adopted library: invoke `canon:target-setup gov`, or run `canon gov install <stack> --add <rule> <path>`
- Project-specific rule the toolkit does not ship: invoke `canon:create-rule`. It scaffolds a rule into `.claude/rules/project/` with a non-colliding number, and `canon gov sync` leaves it untouched. A rule placed under `.claude/rules/canon/` instead is deleted on the next sync, since that folder belongs to the toolkit.
- Index.md system for a markdown-heavy folder that emerged: invoke `canon:target-setup indexes`

Standards and snippets are not on that list, and there is nothing to add for either. Neither installs into a project, by default or by flag, so a session reads a standard with `canon standards <name>` and a snippet through its `@` reference off the live plugin symlink, both resolving against the toolkit rather than a project copy. A project holding a `.claude/standards/` or `.claude/snippets/` folder from an older toolkit is carrying a stale artifact nothing reads, and deleting it is safe.

Per-domain mechanics live in the corresponding `docs/<domain>.md`. The skill body in `claude/skills/<skill>/SKILL.md` covers detection and preview.

## Sync upstream drift

When the toolkit updates, a target pulls changes per domain. A project scaffolded before a layout move runs the one-time moves in [target migrations](target-migrations.md) first. [Target sync](target-sync.md) then covers reading what drifted, the catch-all and targeted entry points, verifying a sync in the sandbox, and running one from an agent session.

## Scenarios

[Target scenarios](target-scenarios.md) walks a markdown-heavy project, a web application, and a monorepo with several language roots from the first session through ongoing maintenance.

## Related

- [agents](agents/index.md): CLI flags, exit codes, and JSON output shapes
- [target migrations](target-migrations.md), [target sync](target-sync.md), [target scenarios](target-scenarios.md): the one-time moves, the recurring sync, and worked setups
- [AI workflow](workflow/ai-workflow.md): feature-development loop inside a toolkit-managed project
- [tooling](../canon/context/tooling/index.md), [governance](../canon/context/governance/index.md), [claude plugin](../canon/context/claude-plugin/index.md), [indexes](../canon/context/indexes.md), [snippets](../canon/context/snippets.md), [standards](../canon/context/standards/index.md): per-domain mechanics
- [sandbox](../canon/context/sandbox/index.md): scenario catalog for verifying domain flows
