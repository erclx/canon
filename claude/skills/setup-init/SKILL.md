---
name: setup-init
description: Detects a new project's type and runs `canon init` with a resolved stack in one shot. Use when bootstrapping a new project with the toolkit, or when asked to "init this project", "bootstrap the toolkit", "set up toolkit", or "one-shot install". Assumes the `canon` CLI is on PATH. Do NOT use when only installing governance rules. Use `setup-gov` instead.
---

# Init project

Orchestrates the onboarding chain. Detects project type, resolves per-domain arguments, previews the chain, then runs `canon init` with flags. The CLI holds the install logic. This skill only resolves and previews.

## Scope

- This skill and `canon init` run once on a fresh scaffold, never on an existing project. They do not guard against clobbering existing configs. When tempted to add guards, mode switches, or an existing-project branch, stop. Extend the per-domain `canon <domain> install` or `canon sync` paths instead.
- The chain folds `setup-indexes` in as its own final step, once the project-scoped work is written. It still does not provision Claude Code plugins: `setup-plugins` owns that, installing once per machine rather than into a project, so no project-scoped chain can carry it. Name it in the report so a clean result does not read as onboarding complete.

## Declined states

Three states reach this skill that the chain does not serve. Name the destination for each, so the refusal routes rather than ends. The first two stop the chain outright and the third runs it on a default the person may not want.

- **An existing project.** Stop and hand off to `canon-operator`. It reads what the target already carries before it names a command, which this chain never does, so any per-domain install picked here is a guess against configs nobody read. The Scope bullet above names the same commands as the authoring alternative, and this is the destination a person takes.
- **An install wanting the `.claude/` folder alone.** Stop. Run `canon claude init` for the seed docs, then invoke `setup-indexes` to bootstrap the `index.md` system over the project's own documentation folders. Neither needs the tooling sync this chain runs.
- **A language the toolkit carries no stack for.** The chain still runs, on `base`, with the fallback marked in the preview. A project that wants none of what `base` carries declines there and takes `setup-gov` for the governance layer, which is language-neutral. Say so at the preview rather than resolving it here, since the fallback is a working default and only the person can say whether it fits.

Do not add a stack, a mode switch, or an existing-project branch to satisfy one of these. Each destination already exists and routing to it costs a line.

## Read catalogs

Run in parallel. Never hardcode stack, rule, snippet, or standards names.

Run from the target project's current directory. Do not cd into the toolkit source tree. The `canon` CLI is global.

```bash
canon gov list --json 2>/dev/null
canon tooling list --json 2>/dev/null
```

## Detect

Read these from the project root in parallel, skipping any that do not exist:

- `package.json`: `dependencies` and `devDependencies`
- Root configs: `astro.config.*`, `next.config.*`, `vite.config.*`, `tailwind.config.*`, `tsconfig.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`
- `canon/REQUIREMENTS.md` and `canon/ARCHITECTURE.md` if present
- Directory structure via `ls -1` of the project root and `src/` if present

## Resolve arguments

- **Stack:** pick the closest governance stack by matching detected runtime or framework against stack names in the catalog. If nothing matches, fall back to `base` and carry the fallback into the preview.
- **Tooling stack:** pick the closest tooling stack from `canon tooling list --json` (e.g. `vite-react`, `astro`, `nextjs`). Distinct from the governance stack. Fall back to `base` if no framework match, and carry that fallback into the preview too.
- **Next.js:** map `next` in `package.json` dependencies, or a root `next.config.ts`/`.js`/`.mjs` file, to the `nextjs` tooling stack. The dependency name does not match the stack name by itself.
- **Extras:** identify technologies not already covered by the picked stack. For each, find a rule whose `description` or `paths` points at that technology and pass it via `--add`. Do not add a rule the stack already pulls in.
- **Skip (`--skip`):** `wiki` installs by default. Add `--skip wiki` only when the user explicitly wants it left out.

## Gap handling

If a detected technology has no matching rule or stack, do not guess. Surface the gap and either:

1. Defer to `setup-gov`. Author a rule in the toolkit, then re-run this skill.
2. Proceed with the matched layer, listing the gap in the final report.

Rules and stacks are authored in the toolkit repo, never in the target project on the fly.

## Preview

Before executing, output:

- **Detected:** each technology with its evidence file
- **Stack:** picked governance stack + resolved rule count. Mark it `fallback` when no detected runtime or framework matched a catalog name.
- **Tooling stack:** picked tooling stack. Mark it `fallback` on the same test, and name what `base` lands: configs, seeds, and gitignore entries in every case, plus the JavaScript development dependencies, scripts, and hook activation wherever a `package.json` exists to carry them. A project outside that ecosystem runs none of the second group and keeps the first.
- **Extras:** each `--add` rule with a one-line reason
- **Skip:** any `--skip` entries with reason
- **Target:** resolved target path
- **Commands:** the full chain that will run

A resolved name and a fallback read alike once written, so mark the fallback here rather than in the report. The preview is the last point before the first write, and the report runs after the files have landed.

## Execute

Run the chain in order, starting immediately after the preview. Each step's permission dialog is the confirmation gate, except step 5, which hands off to a skill that confirms its own folder list with the operator. Do not pause for additional confirmation elsewhere. Run from the target project's current directory.

Step 1: `canon init` installs base tooling, claude seeds, governance rules, and wiki.

```bash
CANON_NON_INTERACTIVE=1 canon init \
  --stack <stack> \
  --add <rules> \
  <target>
```

Omit any flag whose resolved value is empty.

Step 2: `canon tooling sync <tooling-stack> --write` installs stack deps, scripts, gitignore entries, seeds, golden configs, and drops the reference doc. The extends chain is walked, so syncing `vite-react` also pulls `web` and `base` configs. Skip if the tooling stack is `base` (already synced by `canon init`).

`--write` is required. A headless run without it reports what it would replace and exits 1, since golden configs overwrite whatever the target holds at those paths. Scaffolding into a fresh target has nothing to lose, so pass it directly rather than reading a report first.

```bash
CANON_NON_INTERACTIVE=1 canon tooling sync <tooling-stack> <target> --write
```

Monorepo with multiple language roots: run `canon init` once at the repo root so `base` (husky, prettier, cspell, commitlint, CI) lands single, then sync each subtree with `--skip base` so the shared layer is not re-dropped.

```bash
CANON_NON_INTERACTIVE=1 canon tooling sync vite-react ./frontend --skip base --write
CANON_NON_INTERACTIVE=1 canon tooling sync python ./backend --skip base --write
```

Without `--skip base`, each subtree re-drops husky, and git honors only one `core.hooksPath`, so the extra hook dirs silently break. Each subtree keeps its own framework configs, and its own stack reference reads through `canon tooling reference <stack>`.

Step 3: post-sync fixups. Golden configs arrive from sync, so no config generation is required. But a few items may need a one-time touch:

- **ESLint version pin.** If `bun create vite` installed `eslint@^10` and the manifest pins `eslint@^9`, sync does not override a present dep. Run `bun add -d eslint@^9` if `bun run lint:fix` fails with `Class extends value undefined`.
- **File naming.** `bun create vite`'s `App.tsx` violates the `KEBAB_CASE` rule. Rename to `app.tsx` and update the import in `main.tsx`.
- **Docs.** Run `canon tooling reference <tooling-stack>` and `canon tooling reference web` for any stack-specific follow-ups (Chrome extension overrides, setup script details).

Do not generate ESLint, Vitest, or Playwright configs. They ship as golden files. Generating from prose duplicates what sync already installed.

Step 4: invoke `setup-verify`. Runs the `package.json` scripts and reports pass/fail.

Step 5: hand off to `setup-indexes` to bootstrap the `index.md` system over the project's own documentation folders. The skill confirms candidate folders with the operator rather than running unattended, which is the one step in this chain that pauses for a conversation. A fresh scaffold usually has no markdown-heavy folder yet, so this step frequently hands off with nothing for `setup-indexes` to present, which is that skill's own outcome to define rather than a claim this chain makes for it.

## Report

After the chain, report:

- Domains installed with a check per domain
- Tooling stack synced (or skipped). Name the layers pulled via the extends chain.
- Any post-sync fixups applied (ESLint pin, filename renames)
- `setup-verify` outcome
- `setup-indexes` outcome (folders bootstrapped, or none found)
- Any domains or scripts that failed
- Any detection gaps surfaced during resolve
- Onboarding steps left to the caller: `setup-plugins` for Claude Code plugins

The chain stops at the project edge. `repo-metadata` and `git-commit` also ship, reaching a remote and the project's history respectively, and neither runs here.
