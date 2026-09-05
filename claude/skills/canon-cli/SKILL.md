---
name: canon-cli
description: Reference for what canon sync and install commands overwrite, merge, or leave untouched in a target project. Use before running `canon tooling`, `canon standards`, `canon claude sync`, or `canon init`, or when asked "will this overwrite my changes". Do NOT use to run the commands, only to know their effect.
---

# Toolkit CLI contract

What each `canon` sync or install command does to existing files in a target project. Consult before running one, then warn the user about anything destructive. This skill is reference only. It does not run commands.

## Overwrite contract

| Surface                                                  | Command              | Effect on existing files                                                    |
| -------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------- |
| Golden configs, listed in full below                     | `canon tooling sync` | Overwritten once `--write` is passed. Local edits are lost.                 |
| Dictionary seeds (`.cspell/*.txt`)                       | `canon tooling sync` | Merged and sorted. Existing terms preserved.                                |
| Other seeds (`cspell.json`, `.lintstagedrc`, state docs) | `canon tooling sync` | Copy-once. Dropped on first install, untouched after.                       |
| Standards                                                | none                 | Nothing installs. `canon standards <name>` reads and never writes.          |
| Seed docs and `CLAUDE.md`                                | `canon claude init`  | Skipped when present. Never overwritten.                                    |
| Seed docs                                                | `canon claude sync`  | Never touched. Only `.gitignore` is written.                                |
| Stack references                                         | none                 | Nothing installs. `canon tooling reference <stack>` reads and never writes. |
| `.gitignore`, deps, scripts                              | any sync             | Additive. Existing entries preserved. Deps re-pin on major skew.            |
| Generated `index.md`                                     | any sync or regen    | Rewritten from target state. Hand edits are lost.                           |

## What a tooling sync can overwrite

A golden config is any file a stack ships under `configs/`, and the category is wider than its name suggests. It carries the CI workflow, the git hooks, the end-to-end harness, the shell scripts under `scripts/`, and the editor settings, alongside the linters and compilers a reader expects. A stack inherits its parent's configs, so syncing `astro` also writes everything `web` and `base` hold.

Run `canon tooling sync <stack> <target> --check` for the list resolved against a real target. It reports every path and writes nothing. The list below is what the stacks hold as shipped, before any chain resolution.

<!-- generated:tooling-paths -->

### astro

- `astro.config.mjs`
- `eslint.config.js`
- `playwright.config.ts`
- `src/components/dev/scenarios.astro`
- `tsconfig.json`
- `vitest.config.ts`

### base

- `.editorconfig`
- `.github/pull_request_template.md`
- `.github/workflows/phase-label-gate.yml`
- `.github/workflows/verify.yml`
- `.husky/commit-msg`
- `.husky/post-merge`
- `.husky/post-rewrite`
- `.husky/pre-commit`
- `.husky/pre-push`
- `.prettierrc`
- `.shellcheckrc`
- `.vscode/extensions.json`
- `.vscode/settings.json`
- `commitlint.config.js`
- `scripts/verify.sh`

### python

- `.coveragerc`
- `.python-version`
- `mypy.ini`
- `pytest.ini`
- `ruff.toml`
- `scripts/verify.sh`

### vite-react

- `playwright.config.ts`
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`

### web

- `.github/workflows/verify.yml`
- `.vscode/extensions.json`
- `.vscode/settings.json`
- `e2e/home.spec.ts`
- `e2e/screenshot.ts`
- `eslint.config.js`
- `scripts/screenshot.sh`
- `scripts/verify.sh`
- `scripts/worktree-port.sh`
- `src/test/setup.ts`

<!-- /generated:tooling-paths -->

## Rules

- `canon tooling sync` writes nothing until `--write` is passed. A headless run without it reports and exits 1, so a script that forgets the flag fails rather than silently skipping the sync.
- Run `--check` first when the project carries local edits to any path above. The report names each file it would replace, which is the warning the user needs before the write.
- An interactive run still prompts. `--write` skips the prompt, and `--check` refuses to write even with a TTY.
- Seeds are user-owned. Dictionary `.txt` files merge and sort. Other seeds are copy-once, so re-seeding a structured file means deleting it and syncing again.
- No command writes a standard into a project. A `.claude/standards/` folder from an older toolkit is inert, and deleting it costs nothing.
- For section-level customizations of a seed doc, use the `claude-seed-sync` skill, not `canon ... sync`. It diffs per section and preserves edits.

## CLAUDE.md

- `CLAUDE.md` is a copy-once seed. No `canon` sync command ever updates it. Reconcile it with the `claude-seed-sync` skill, which diffs the preamble and each section and preserves customizations by default.

## Source of truth

- Full semantics live in the toolkit's own context entries. This skill is the target-session summary. When they disagree, the context docs win.
