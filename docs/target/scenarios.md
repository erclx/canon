---
title: Target scenarios
description: Worked setups for a markdown-heavy project, a web application, and a monorepo
category: Agent surface
---

# Target scenarios

Three worked setups from the first session through maintenance. [Target projects](projects.md) carries the lifecycle they walk.

## Markdown-heavy project

```bash
cd <your-project>
claude
```

Invoke `canon:target-setup`. It detects no framework, resolves tooling and governance to `base`, marks both as fallbacks in the preview, and runs `canon init`. Later, run `canon sync --check .` to see drift, merge seed drift by hand, or run `canon sync .` for a catch-all refresh.

## Web application

```bash
bun create vite my-app && cd my-app
claude
```

Invoke `canon:target-setup`. It reads `package.json` and the Vite config, resolves tooling to `vite-react` and governance to `node`, proposes the rules the manifest matches, and runs `canon init`.

- Check drift with `canon sync --check .` and sync everything with `canon sync .`
- Refresh governance alone with `canon gov sync .`
- Layer a rule on top, such as `canon gov install node --add shadcn .`

## Monorepo with multiple language roots

The repo root owns the shared `base` layer, and each language lives in a subfolder.

```bash
canon init --stack node --add react .
canon tooling sync vite-react ./frontend --skip base --write
canon tooling sync python ./backend --skip base --write
```

`--skip base` keeps husky, oxfmt, commitlint, and CI at the root. Every subtree still receives `scripts/verify.ts` and `scripts/verify.json`, and its own framework configs.

A sync into a subfolder withholds `.github/`, so run the subtree from the root workflow with `working-directory` set to the path the sync prints. Run `bun scripts/verify.ts` in the subtree, since the `check` script lives at the root.

- A subtree with no `package.json` gets a minimal one holding the folder's name, version `0.0.0`, and `type: module`, then the install runs into it
- An existing file is never rewritten, and one that is not valid JSON ends the sync on `package.json is not valid JSON: fix it in <path>, then sync again`
