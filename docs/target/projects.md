---
title: Target projects
description: Scaffold, add domains later, and sync upstream drift in a toolkit-managed project
category: Agent surface
---

# Target projects

A project outside this repo scaffolds once, adds a domain later, and syncs when the upstream moves. For flags and JSON shapes see [agents](../agents/index.md).

## Getting the skills

Install the plugin once per machine. The installed copy stays at its version until you refresh it with `claude plugin marketplace update canon` and `claude plugin update canon@canon`, or turn on auto-update under `/plugin`. The URL form clones over HTTPS, and the `erclx/canon` shorthand resolves to SSH.

```bash
claude plugin marketplace add https://github.com/erclx/canon
claude plugin install canon@canon
```

A machine that installed the plugin under its previous name re-registers once, uninstalling before removing the marketplace.

```bash
claude plugin uninstall aitk@aitk
claude plugin marketplace remove aitk
claude plugin marketplace add https://github.com/erclx/canon
claude plugin install canon@canon
```

Skills invoke the `canon` CLI, which the marketplace install does not put on `PATH`.

```bash
bun install --global @erclx/canon
```

To develop against a checkout, run `claude --plugin-dir <toolkit>/claude`.

## Scaffold

1. Run the framework's own scaffold if the project needs one, such as `bun init` or `npm create vite`
2. Invoke `canon:target-setup` in Claude Code. It detects the stack, previews the chain with the opt-in rules `canon gov detect` proposes, and runs it on your confirmation.

The chain runs these phases:

- `canon init` installs base tooling, Claude seeds, and governance rules into `.claude/rules/`
- `canon tooling sync <stack> --write` adds stack dependencies, scripts, and gitignore entries
- The agent follows `canon tooling reference <stack>` and extends `canon/context/development/ci.md` and `canon/context/development/local-loop.md` <!-- audit-ignore-citations -->
- The `verify` phase runs the installed `package.json` scripts and reports pass or fail
- The `indexes` phase bootstraps `index.md` over the project's documentation folders, confirming candidates with you

An existing project goes to `canon:target-check` first, then to `canon:target-update` to apply the catch-up. For the Claude layer alone, run `canon claude init` and then `canon:target-setup indexes`. Run `canon:target-setup verify deep` by hand for the heavier smoke and screenshot pass.

Keep the `## Scripts` table in `canon/context/development/local-loop.md` current as scripts are added. A split entry keeps it in any entry directly under `development/`, grouping a long set into short tables under lead sentences. <!-- audit-ignore-citations: canon/context/development/local-loop.md -->

### From scaffold to first feature

Before the first feature session:

1. Fill `canon/REQUIREMENTS.md` with the problem, goals, and non-goals. The seed's 600-word cap gates under `canon context audit`.
2. For a UI project, write `canon/DESIGN.md` from the seed and name the stylesheet in its lead, or work the direction out with `canon:design-pick`
3. Optionally invoke `canon:draw-figure` for an architecture view. The Mermaid CLI downloads on first use.
4. Start the feature loop in [AI workflow](../workflow/ai-workflow.md)

### Stack decision

The default is `base`. Escalate only for a project writing code, and `target-setup` picks the tooling stack from the manifest and framework configs, and the governance stack for the root's language. Run `canon tooling list --json` and `canon gov list --json` for the catalogs.

- In a monorepo each manifest folder gets `canon tooling sync <stack> <folder> --skip base`. Governance installs once at the root, with subfolder languages through `--add`.
- Server security and persistence rules come from `canon gov detect`, or `--add security-server,database`
- A language with no stack lands on `base`, marked as a fallback in the preview. Decline it and run `canon:target-setup gov` for governance alone.

### Core domains and skips

`canon init` installs base tooling, the Claude workflow, and governance. Pass `--stack <name>` for a language stack.

Init then lists each markdown root that already passes the density limits in `canon/config/markdown.toml`, so those folders fail a push from the start. A root carrying a finding is named and left out, and `canon:document-repair` brings it to zero later. An existing config is kept as it is.

- `--skip governance` leaves `.claude/rules/` empty. The run prints the `canon gov install <stack> <path>` command that restores the rules it dropped.

## Add a domain later

Install one domain without re-running `canon init`.

- A rule for a newly adopted library: run `canon gov detect <path> --json`, then `canon gov install --add <rule> <path>`
- A project-specific rule: invoke `canon:create-rule`, which writes into `.claude/rules/project/`. A rule under `.claude/rules/canon/` is deleted on the next sync.
- An `index.md` system for a markdown-heavy folder: invoke `canon:target-setup indexes`

For a leftover `.claude/snippets/` see [target migrations](migrations.md).

## Sync upstream drift

A project scaffolded before a layout move runs the one-time moves in [target migrations](migrations.md) first. [Target sync](sync.md) covers reading drift and running a sync. [Target scenarios](scenarios.md) walks three worked setups.

## Related

- [AI workflow](../workflow/ai-workflow.md): the feature loop inside a managed project
- [tooling](../../canon/context/surfaces/tooling.md), [governance](../../canon/context/surfaces/governance.md), [claude plugin](../../canon/context/surfaces/plugin.md), [indexes](../../canon/context/context-model.md): per-domain mechanics
- [sandbox](../../canon/context/development/sandbox.md): scenario catalog for verifying domain flows
