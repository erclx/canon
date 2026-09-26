---
title: Detect and resolve
description: The catalog reads, evidence list, argument resolution, gap handling, and preview the install and gov phases share
---

# Detect and resolve

What the `install` and `gov` phases both do before they write anything. Stated
once here rather than twice in the body, since the two phases differ in what
they install rather than in how they read the project.

## Read the catalogs

Run in parallel. Never hardcode stack, rule, or standards names. The
catalog is the source of truth.

Run from the target project's current directory. Do not cd into the toolkit
source tree. The `canon` CLI is global.

```bash
canon gov list --json 2>/dev/null
canon tooling list --json 2>/dev/null
```

The `gov` phase needs only the first. Run both anyway on a bare invocation,
since the chain reaches the tooling resolution a moment later.

## Detect

A monorepo keeps its languages in subfolders, so read the markers from every
folder to depth two rather than from the root alone. Collect the language roots
first:

```bash
git ls-files --cached --others --exclude-standard \
  | grep -E '(^|/)(package\.json|pyproject\.toml|go\.mod|composer\.json|Cargo\.toml)$' \
  | awk -F/ 'NF <= 3'
```

Every folder holding a marker is a language root, and the repository root is
one when it holds a marker itself. Going through git keeps ignored trees such as
`node_modules/`, `vendor/`, and `.venv/` off the list, since each carries
markers of its own. Outside a git repository, fall back to
`find . -maxdepth 3 \( -path '*/.*' -o -name node_modules -o -name vendor \) -prune -o -type f -print`
filtered to the same five names.

Depth two reaches a service folder at depth one and a workspace package under
`packages/<name>/` at depth two. Deeper, the walk starts finding fixtures and
examples as false roots.

Then read these per language root in parallel, skipping any that do not exist:

- `package.json`: `dependencies` and `devDependencies`
- The root's own configs: `astro.config.*`, `next.config.*`, `vite.config.*`, `tailwind.config.*`, `tsconfig.json`, `pyproject.toml`, `go.mod`, `composer.json`, `Cargo.toml`

A non-JavaScript marker outranks a `package.json` in the same folder. A Go or
Composer service often carries a `package.json` only to host scripts, so that
folder is a Go or PHP root rather than a JavaScript one.

Read these once, from the repository root:

- `canon/REQUIREMENTS.md` and `canon/ARCHITECTURE.md` if present
- Directory structure via `ls -1` of the project root and `src/` if present

## Resolve arguments

Governance installs once, at the repository root, and a rule's `paths:` globs
already reach every subfolder. Tooling installs per folder. So resolve one
governance stack for the whole repository and one tooling stack per language
root.

- **Stack:** pick the closest governance stack by matching the repository root's detected runtime or framework against stack names in the catalog. If the root matched nothing, `base` is the stack, including when subfolders matched, since no subfolder owns the repository and picking one by order would state a preference nobody gave. Mark it `fallback` in the preview only when no root matched anywhere.
- **Tooling stack:** for each language root, pick the closest tooling stack from `canon tooling list --json` (e.g. `vite-react`, `astro`, `nextjs`). Distinct from the governance stack. Fall back to `base` for a root with no framework or language match, and carry that fallback into its preview row.
- **Next.js:** map `next` in a root's `package.json` dependencies, or a `next.config.ts`/`.js`/`.mjs` file in that root, to the `nextjs` governance stack and the `nextjs` tooling stack. The dependency name does not match either stack name by itself.
- **Extras:** identify technologies not already covered by the picked governance stack, across every language root. A subfolder that matched a governance stack of its own contributes that stack's rules, read from `canon gov list --json`, and every root contributes its language rule. For each technology, find a rule whose `description` or `paths` points at it and pass it via `--add`. Dedupe against the picked stack's own rules. Do not add a rule the stack already pulls in.
- **Subfolder tooling:** a language root below the repository root takes its own `canon tooling sync <stack> <path> --skip base`, since `canon init` already lands `base` once at the root. Leave a root whose stack resolves to `base` out of the commands, since that sync would land nothing. A repository-root `package.json` hosting only formatters and hooks is that case, and it adds no row.
- **Skip (`--skip`):** `wiki` installs by default. Add `--skip wiki` only when the user explicitly wants it left out.

## Gap handling

If a detected technology has no matching rule or stack, do not guess. Surface
the gap.

On the full chain, either defer and author a rule in the toolkit before
re-running, or proceed with the matched layer and list the gap in the final
report. Rules and stacks are authored in the toolkit repository, never in the
target project on the fly.

On the `gov` phase, stop and present four options rather than picking:

1. Author a new rule in the toolkit at `governance/rules/<domain>/<num>-<name>.md` following `${CLAUDE_SKILL_DIR}/../../standards/rule.md`, commit, then re-run install. Take this route when the toolkit should ship the rule to every project.
2. Invoke `create-rule`, which scaffolds the file into the target project at a non-colliding number. Take this route when the rule is specific to this project and no sync should ever overwrite it.
3. Install the matching non-`<tech>` rules and skip the tech-specific layer.
4. Abort.

`--skip-gaps` takes option 3 ahead of the prompt, which is what keeps the phase
non-interactive. This skill authors no rule itself. Option 1 writes in the
toolkit repository, and option 2 hands the project-local file to `create-rule`.

## Preview

Before executing, output:

- **Detected:** each technology with its evidence file, path included, so a subfolder marker reads as one
- **Stack:** picked governance stack and resolved rule count. Mark it `fallback` when no detected runtime or framework matched a catalog name.
- **Tooling stack:** one row per language root, each carrying its path, its picked tooling stack, a `fallback` mark on the same test, and its own command. On the repository root's row, name what `base` lands: configs, seeds, and gitignore entries in every case, plus the JavaScript development dependencies, scripts, and hook activation wherever a `package.json` exists to carry them. A project outside that ecosystem runs none of the second group and keeps the first. Omit these rows entirely on the `gov` phase, which syncs no tooling.
- **Extras:** each `--add` rule with a one-line reason, listed in full. A second matched stack reaches the install only through this list, since `canon init --stack` takes one stack, so a shortened list reads as that stack dropped.
- **Skip:** any `--skip` entries with reason
- **Target:** resolved target path
- **Commands:** the full chain that will run

A resolved name and a fallback read alike once written, so mark the fallback
here rather than in the report. The preview is the last point before the first
write, and the report runs after the files have landed.
