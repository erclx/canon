---
title: Target scenarios
description: Worked setups for a markdown-heavy project, a web application, and a monorepo
category: Agent surface
---

# Target scenarios

Three worked setups, each from the first session through ongoing maintenance. [Target projects](projects.md) carries the lifecycle they walk.

## Markdown-heavy project

```bash
cd <your-project>
claude
```

In the session, invoke `canon:target-setup`. The skill detects no framework and resolves tooling to `base` and governance to `base`. The preview marks both stacks as fallbacks, since neither came from a match, then the chain runs `canon init`.

Ongoing: run `canon sync --check .` to see what has drifted, then invoke `canon:seed-sync` for seed drift or `canon sync .` for a catch-all refresh.

## Web application

```bash
bun create vite my-app && cd my-app
claude
```

Invoke `canon:target-setup`. The skill reads `package.json` and the Vite config, resolves tooling to `vite-react` and governance to `react`, and runs `canon init` with the resolved flags.

Ongoing maintenance:

- What has drifted: `canon sync --check .`
- Seed drift: invoke `canon:seed-sync`
- Catch-all sync: `canon sync .`
- Governance rule refresh only: `canon gov sync .`
- Layer a new rule on top, for example `260-shadcn` after adopting shadcn: `canon gov install react --add 260-shadcn .`

## Monorepo with multiple language roots

The repo root owns the shared `base` layer, and each language lives in its own subfolder.

```bash
canon init --stack react .
canon tooling sync vite-react ./frontend --skip base --write
canon tooling sync python ./backend --skip base --write
```

`--skip base` drops the `base` layer from each subtree sync, so husky, prettier, cspell, commitlint, and CI stay single at the repo root. Without it, every subtree re-drops husky, and since git honors only one `core.hooksPath` the extra hook dirs silently break. Each subtree still gets its own framework configs (eslint, vitest, tsconfig, vite), and its own stack reference reads through `canon tooling reference <stack>`.

A sync whose target sits below the git root knows it is writing into a subfolder:

- It withholds `.github/`, since GitHub reads workflows only at the repository root, and names each withheld file. Run the subtree from a job in the root workflow instead, with `working-directory` set to the subtree path the sync prints, such as `working-directory: frontend`.
- It writes a nested `cspell.json` that registers the subtree's word lists, so a root `cspell '**'` reads them for files under that folder. It leaves a spell config the subtree already has alone.
- It installs no dependencies and adds no scripts to a subtree without a `package.json`. It names what it skipped and ends on `run 'bun init' in <path>, then sync again`.
- The subtree's `scripts/verify.sh` skips the format, spell, and shell phases a subtree does not declare, since the root runs them, and still fails on a missing lint, typecheck, or test script.
