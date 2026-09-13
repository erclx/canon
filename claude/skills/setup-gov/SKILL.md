---
name: setup-gov
description: Detects a project's stack from its files and installs matching toolkit governance rules into `.claude/rules/`. Use after scaffolding a new project, when asked to "install gov rules", "install governance", "set up governance", or when a target project has no `.claude/rules/` yet. Assumes the `canon` CLI is on PATH.
---

# Gov install

Automates `canon gov install` by inferring the stack and extras from the current project, then shelling out to the CLI with the resolved arguments.

## Scope

- Governance rules and nothing else. `setup-init` is the one-shot chain that installs governance beside tooling, standards, snippets, and the seeds.
- This is where `setup-init` sends a project whose language the toolkit carries no stack for. Rules install without the `base` development dependencies the tooling layer would drop on it. Resolve and stop exactly as below, since a language with no stack is the unmatched case `## Gap handling` already owns and arriving by that route changes none of it.

## Read the catalog

Run this first to load the current stacks and rules. Never hardcode names. The catalog is the source of truth.

```bash
canon gov list --json 2>/dev/null
```

## Detect the stack

Read these from the project root in parallel:

- `package.json`: dependencies and devDependencies
- Root config files: `astro.config.*`, `next.config.*`, `vite.config.*`, `tailwind.config.*`, `tsconfig.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`
- `canon/REQUIREMENTS.md` and `canon/ARCHITECTURE.md` if present
- Directory structure via `ls -1` of the project root and `src/` if present

## Match

Match the detected evidence to the catalog:

- Pick the closest stack. Match detected runtime or framework against stack names in the catalog.
- Identify additional technologies not already covered by the picked stack. For each, find a rule whose `description` or `paths` points at that technology, then add it via `--add`.
- Dedupe extras against stack rules. Do not add a rule the stack already pulls in.

## Gap handling

If a detected technology has no matching rule, stop and surface the gap. Do not guess.

Present four options:

1. Author a new rule in the toolkit at `governance/rules/<domain>/<num>-<name>.md` following `${CLAUDE_SKILL_DIR}/../../standards/rule.md`, commit, then re-run install. Take this route when the toolkit should ship the rule to every project.
2. Invoke `create-rule`, which scaffolds the file into the target project at a non-colliding number. Take this route when the rule is specific to this project and no sync should ever overwrite it.
3. Install the matching non-<tech> rules and skip the tech-specific layer.
4. Abort.

This skill authors no rule itself. Option 1 writes in the toolkit repository, and option 2 hands the project-local file to `create-rule`.

## Preview

Before executing, output:

- **Detected:** each technology with the file that evidenced it
- **Stack:** picked stack name and total resolved rule count
- **Extras:** each `--add` rule with a one-line reason
- **Target:** resolved target path
- **Command:** the exact shell command to run

## Execute

Run with `CANON_NON_INTERACTIVE=1` so no CLI picker prompts appear. Claude Code's tool permission dialog is the confirmation gate.

```bash
CANON_NON_INTERACTIVE=1 canon gov install <stack> --add <extras> <target>
```

## Response

After execution, report:

- Rule count installed
- Target path
- Any rules that failed to resolve (the CLI warns on missing rule files)
