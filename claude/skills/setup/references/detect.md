---
title: Detect and resolve
description: The catalog reads, evidence list, argument resolution, gap handling, and preview the install and gov phases share
---

# Detect and resolve

What the `install` and `gov` phases both do before they write anything. Stated
once here rather than twice in the body, since the two phases differ in what
they install rather than in how they read the project.

## Read the catalogs

Run in parallel. Never hardcode stack, rule, snippet, or standards names. The
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

Read these from the project root in parallel, skipping any that do not exist:

- `package.json`: `dependencies` and `devDependencies`
- Root configs: `astro.config.*`, `next.config.*`, `vite.config.*`, `tailwind.config.*`, `tsconfig.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`
- `canon/REQUIREMENTS.md` and `canon/ARCHITECTURE.md` if present
- Directory structure via `ls -1` of the project root and `src/` if present

## Resolve arguments

- **Stack:** pick the closest governance stack by matching detected runtime or framework against stack names in the catalog. If nothing matches, fall back to `base` and carry the fallback into the preview.
- **Tooling stack:** pick the closest tooling stack from `canon tooling list --json` (e.g. `vite-react`, `astro`, `nextjs`). Distinct from the governance stack. Fall back to `base` if no framework match, and carry that fallback into the preview too.
- **Next.js:** map `next` in `package.json` dependencies, or a root `next.config.ts`/`.js`/`.mjs` file, to the `nextjs` tooling stack. The dependency name does not match the stack name by itself.
- **Extras:** identify technologies not already covered by the picked stack. For each, find a rule whose `description` or `paths` points at that technology and pass it via `--add`. Dedupe against the stack's own rules. Do not add a rule the stack already pulls in.
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

- **Detected:** each technology with its evidence file
- **Stack:** picked governance stack and resolved rule count. Mark it `fallback` when no detected runtime or framework matched a catalog name.
- **Tooling stack:** picked tooling stack. Mark it `fallback` on the same test, and name what `base` lands: configs, seeds, and gitignore entries in every case, plus the JavaScript development dependencies, scripts, and hook activation wherever a `package.json` exists to carry them. A project outside that ecosystem runs none of the second group and keeps the first. Omit this line entirely on the `gov` phase, which syncs no tooling.
- **Extras:** each `--add` rule with a one-line reason
- **Skip:** any `--skip` entries with reason
- **Target:** resolved target path
- **Commands:** the full chain that will run

A resolved name and a fallback read alike once written, so mark the fallback
here rather than in the report. The preview is the last point before the first
write, and the report runs after the files have landed.
