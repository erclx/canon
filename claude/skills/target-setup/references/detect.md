---
title: Detect and resolve
description: The catalog reads, evidence list, argument resolution, gap handling, and preview the install and gov phases share
---

# Detect and resolve

What the `install` and `gov` phases both do before they write anything. Stated once here rather than twice in the body, since the two phases differ in what they install rather than in how they read the project.

## Contents

- [Read the catalogs](#read-the-catalogs)
- [Detect](#detect)
- [Resolve arguments](#resolve-arguments)
- [Gap handling](#gap-handling)
- [Preview](#preview)

## Read the catalogs

Run in parallel. Never hardcode stack, rule, or standards names. The catalog is the source of truth.

Run from the target project's current directory. Do not cd into the toolkit source tree. The `canon` CLI is global.

```bash
canon gov list --json 2>/dev/null
canon tooling list --json 2>/dev/null
```

The `gov` phase needs only the first. Run both anyway on a bare invocation, since the chain reaches the tooling resolution a moment later.

## Detect

A monorepo keeps its languages in subfolders, so read the markers from every folder to depth two rather than from the root alone. Collect the language roots first:

```bash
git ls-files --cached --others --exclude-standard \
  | grep -E '(^|/)(package\.json|pyproject\.toml|go\.mod|composer\.json|Cargo\.toml)$' \
  | awk -F/ 'NF <= 3'
```

Every folder holding a marker is a language root, the repository root included when it holds one itself. Going through git keeps ignored trees such as `node_modules/`, `vendor/`, and `.venv/` off the list, since each carries markers of its own.

- Outside a git repository, fall back to `find . -maxdepth 3 \( -path '*/.*' -o -name node_modules -o -name vendor \) -prune -o -type f -print` filtered to the same five names
- Depth two reaches a service folder at depth one and a workspace package under `packages/<name>/`. Deeper, the walk finds fixtures and examples as false roots.

### Per root

Read these per language root in parallel, skipping any that do not exist:

- `package.json`: `dependencies` and `devDependencies`
- The root's own configs: `astro.config.*`, `next.config.*`, `vite.config.*`, `tailwind.config.*`, `tsconfig.json`, `pyproject.toml`, `go.mod`, `composer.json`, `Cargo.toml`

A non-JavaScript marker outranks a `package.json` in the same folder. A Go or Composer service often carries a `package.json` only to host scripts, so that folder is a Go or PHP root.

### Once, at the root

Read these once, from the repository root:

- `canon/REQUIREMENTS.md` if present
- Directory structure via `ls -1` of the project root and `src/` if present

## Resolve arguments

Governance installs once, at the repository root, and a rule's `paths:` globs already reach every subfolder. Tooling installs per folder, so resolve one governance stack for the whole repository and one tooling stack per language root.

### Governance stack

Match the repository root's detected language against stack names in the catalog. Governance stacks are per language, so a framework never names one, and its rules arrive as extras.

- If the root matched nothing, `base` is the stack, even when subfolders matched. No subfolder owns the repository, and picking one by order states a preference nobody gave.
- Mark it `fallback` in the preview only when no root matched anywhere

### Tooling stack

For each language root, pick the closest tooling stack from `canon tooling list --json`, such as `vite-react`, `astro`, or `nextjs`. It is distinct from the governance stack.

- Fall back to `base` for a root with no framework or language match, and carry that fallback into its preview row
- Map `next` in a root's dependencies, or a `next.config.ts`, `.js`, or `.mjs` there, to the `node` governance stack and the `nextjs` tooling stack
- The `next` dependency name alone matches no stack, and the Next.js rule arrives as an extra

### Extras

Run `canon gov detect <target> --stack <stack> --json` from the target and take its `proposals` array as the candidate extras. Each proposal names a `rule` and the `evidence` that matched it across every language root to depth two.

- The verb already leaves out every rule the picked stack resolves, so do not dedupe again
- Do not match a rule's `description` or `paths` by hand
- The verb proposes no language rule, since a stack reaches each one

A language root below the repository root whose language the stack does not carry contributes its language rule by name, read from `canon gov list --json`.

### Subfolder tooling and skips

A language root below the repository root takes its own `canon tooling sync <stack> <path> --skip base`, since `canon init` already lands `base` once at the root.

- Leave a root whose stack resolves to `base` out of the commands, since that sync lands nothing. A root `package.json` hosting only formatters and hooks is that case and adds no row.

## Gap handling

If a detected technology has no matching rule or stack, do not guess. Surface the gap.

On the full chain, either defer and author a rule in the toolkit before re-running, or proceed with the matched layer and list the gap in the final report. Rules and stacks are authored in the toolkit repository, never in the target project on the fly.

### The gov phase

On the `gov` phase, stop and present four options rather than picking:

1. Author a rule in the toolkit at `governance/rules/<domain>/<num>-<name>.md` per `${CLAUDE_SKILL_DIR}/../create-rule/references/rule.md`, commit, and re-run install, when every project should get it.
2. Invoke `create-rule`, which scaffolds the file into the target project at a non-colliding number. Take this when the rule is project-specific and no sync should overwrite it.
3. Install the matching non-`<tech>` rules and skip the tech-specific layer.
4. Abort.

`--skip-gaps` takes option 3 ahead of the prompt, which keeps the phase non-interactive. This skill authors no rule itself, since option 1 writes in the toolkit and option 2 hands the file to `create-rule`.

## Preview

Before executing, output:

- **Detected:** each technology with its evidence file, path included, so a subfolder marker reads as one
- **Stack:** picked governance stack and resolved rule count. Mark it `fallback` when no detected language matched a catalog name.
- **Tooling stack:** one row per language root, each with its path, picked stack, a `fallback` mark on the same test, and its own command. Omit these rows on the `gov` phase.
- **Extras:** each proposal with the evidence the verb returned, plus each subfolder language rule, listed in full as the list the operator confirms
- **Skip:** any `--skip` entries with reason
- **Target:** resolved target path
- **Commands:** the full chain that will run

### The root tooling row

On the repository root's row, name what `base` lands. Configs, seeds, and gitignore entries land in every case.

- The JavaScript development dependencies, scripts, and hook activation land wherever a `package.json` exists to carry them
- A project outside that ecosystem runs none of that second group and keeps the first

### Why mark it here

A resolved name and a fallback read alike once written, so mark the fallback in the preview rather than the report. The preview is the last point before the first write.

The extras list stays whole for a similar reason. `canon init --stack` takes one stack, so a second matched stack reaches the install only through this list, and a shortened list reads as that stack dropped.

### Confirm the extras

The extras are the one part of the preview the operator confirms before the install runs, since a proposal is evidence that a project might want a rule rather than proof that it does. Put the list through the structured question surface with three options.

- Take every proposal, the recommended first option
- Take none
- Name a subset, which the operator types as a comma-separated list

Pass what they kept to `--add`, and drop the flag when they kept nothing.

### Answering ahead

An `--extras` argument answers ahead of time and skips the question. `--extras <a>,<b>` takes the named rules, and `--extras none` takes none.

With neither and no one to answer, take every proposal and list each in the report. A proposed rule costs one file to delete, and stopping would break every headless setup.
