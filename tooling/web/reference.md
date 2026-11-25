# Tooling web reference

> Extends: `base`. Apply base stack first.

## Overview

The web layer covers the tooling shared across Vite + React, Astro, and Next.js. It sets lint, unit and end-to-end tests, Tailwind, screenshots, ports, and CI, and each framework stack adds its own wiring on top. A `src/` path below means the app folder a scaffold recorded, `web/` on a full stack project.

## oxlint

- Run the recommended, React, and test-scoped vitest rules, with `check-file` and `simple-import-sort` as JS plugins
- Pin oxlint exactly, since its JS plugin host is alpha and a minor release could break `check-file` or `simple-import-sort`
- Keep import sorting on `simple-import-sort`, because oxfmt's built-in sort orders differently and would rewrite every import block
- Expect sync to force-replace `lint` and `lint:fix`, so a target stops running ESLint. Astro keeps ESLint, which its own reference covers.
- Delete a leftover `eslint.config.js` or `eslint.config.mjs` and `bun remove` the ESLint packages by hand after that sync, since sync deletes nothing a stack stopped shipping

## Vitest

- Use jsdom, globals on, and `src/test/setup.ts`, which imports `@testing-library/jest-dom/vitest` and runs `cleanup` after each test
- Test components with `@testing-library/react` and `@testing-library/user-event`

## Playwright

- Keep end-to-end specs in `e2e/`, running Chromium alone for a Chrome extension and every browser for a web app

## Tailwind

- Use v4 through `@tailwindcss/vite`, never the v3 integration
- Add shadcn to a Vite + React or Next.js app through the sequence under `## Adding shadcn`, since a bare `init` reads the wrong template and waits on prompts

## Adding shadcn

Each app stack names its own stylesheet and template. An Astro site keeps its own components and takes no init.

| Stack        | Stylesheet            | Template | Alias in                          |
| ------------ | --------------------- | -------- | --------------------------------- |
| `vite-react` | `src/index.css`       | `vite`   | `tsconfig.json`, `vite.config.ts` |
| `nextjs`     | `src/app/globals.css` | `next`   | `tsconfig.json`                   |

Run it from the project root, checked against shadcn `4.23.0` on 2026-11-22.

1. Copy the stylesheet aside, so anything init drops can be reapplied.
2. Confirm the stylesheet imports `tailwindcss` and the `@/*` alias sits in every file the table names. Without the import, init stops on `No Tailwind CSS configuration found`.
3. Run `bunx shadcn@latest init -t <template> -b base -p nova --no-monorepo -y </dev/null` under the session's command timeout, since macOS ships no `timeout`.
4. Expect `components.json` reading `"style": "base-nova"`, `src/lib/utils.ts`, and `src/components/ui/button.tsx`, with the theme merged into the stylesheet below the Tailwind import.
5. Reapply any stylesheet line init removed, then run `bun run format`, since init writes in its own style.

`-b base` picks Base UI, the shadcn rule's default, and `-p nova` yields `base-nova`, a name `-p` refuses. Naming both pins new projects against a changed default, and the closed stdin and `--no-monorepo` keep a non-TTY run off a prompt.

## TypeScript and layout

- Keep app code in the app root, `src/` by default, Playwright in `e2e/`, shell in `scripts/`, and Vitest globals in the root's `test/setup.ts`
- Map the `@` alias to the app root in tsconfig and the framework's build config
- Keep the tsconfig at the root with `noEmit: true` in a Vite stack. Astro keeps the scaffold default from `@astrojs/check`.
- Typecheck with `tsc --noEmit`, never `tsc -b`, since composite mode emits `.js` next to `.ts` and the linter lints it

## Playwright installs in CI

- Expect the seeded workflows to install no system packages, since both hosted Ubuntu images ship Chrome and the libraries Chromium loads
- Expect each browser download bounded at 5 minutes, while the jobs carry no bound, since test and build time differs per project
- Add `bunx playwright install-deps chromium` before the browser install on a self-hosted runner, which carries none of those libraries
- Delete `scripts/install-playwright-deps.sh` from a target synced before this change, since sync never removes it and no seeded workflow calls it

## Design references

- Expect a seeded `canon/design/index.md`, a heading and a lead with no groups yet, copied only when missing so a project's own index is never replaced
- Expect `canon indexes regen canon/design` to list each `<group>.md` written beside a group folder, so no branch hand-edits a shared line of the index
- Expect `governance/rules/ui/design-reference.md` to install once a group folder sits under `canon/design/`, since the stub alone is no reference
- Expect `.gitattributes` to mark `canon/design/**` as linguist-documentation

## Site settings

- Keep the site's `name`, `description`, and `card` in the seeded `src/site.ts`, which every page's head reads, so the tab, the link preview, and the card agree across pages
- Expect `card` to default to `/og-image.png`, the name `canon:design-identity` writes the card under
- Expect no address in the file, since each framework holds it in its own site setting and a second copy drifts. Astro reads `ASTRO_SITE`.
- Expect only the astro stack to write head tags from the file, and to fail a built page missing one, per its reference

## Ports

- Derive every served port from `scripts/worktree-port.sh`, never a port literal in a script string, since two worktrees of one repository otherwise attach to one server
- Read `WORKTREE_PORT_OFFSET` in a config and add it to the stack's default port. Unset yields the default, so a plain clone keeps its port.
- Expect an offset from a band of 50 hashed from the worktree folder name, and set `WORKTREE_PORT_OFFSET` by hand to break a tie between two worktrees
- Set `strictPort` on every dev and preview server, and Playwright `reuseExistingServer: false`, since a walked or reused server passes against the wrong code
- Call the helper as `VAR=$(bash scripts/worktree-port.sh) && export VAR && <server>`, since an assignment prefix discards the substitution's exit and starts the server at offset zero

## Ports in a removed worktree

- Expect a non-zero exit and no port from a folder left under `.claude/worktrees/` once its worktree is gone, since git reports the parent repository from inside one
- Expect a folder whose own `.git` was deleted to refuse only under that directory, since location alone separates it from an ordinary subdirectory
- Expect a folder whose `.git` names a pruned administrative directory to refuse wherever it sits
- Set `WORKTREE_PORT_OFFSET` by hand to serve from such a folder anyway, since it is the one override and is checked before any directory test

## lint-staged (extend)

- Add `**/*.{js,jsx,ts,tsx}` running `oxlint --fix --max-warnings 0` and `oxfmt --no-error-on-unmatched-pattern`
- Extend the oxfmt glob to include `css`, giving `**/*.{json,css,md}`

## Verify script

- Expect `scripts/verify.json` to require `typecheck`, `lint`, `test:run`, and `build`, which base's `scripts/verify.ts` runs in its fixed order
- That order is typecheck, lint, format, shell where the `shell` stack declares it, unit tests, build, the canon checks stage, the card exclusion check, then the head tag check
- Expect `test:changed` to take the tied test files as Vitest filters from base's changed mode, so a Playwright spec among them matches nothing and passes
- Expect the card stage to run `scripts/check-card-exclusion.sh` whenever that file is installed, so a project with no card route runs one less stage with no override
- Expect the head tag stage to run `scripts/check-head-meta.sh` the same way, whenever that file is installed

## CI docs (extend)

- Extend the `## Checks` table in `canon/context/development/ci.md` with the web jobs <!-- audit-ignore-citations: canon/context/development/ci.md -->
- Document under `## Running CI locally` that `bun run check:full` runs verify plus `test:e2e`

| Check     | Command                 | What it asserts                             |
| --------- | ----------------------- | ------------------------------------------- |
| Typecheck | `bun run typecheck`     | framework-specific typecheck passes         |
| Lint      | `bun run lint`          | oxlint passes with zero warnings            |
| Tests     | `bun run test:coverage` | Vitest passes with coverage thresholds      |
| Build     | `bun run build`         | Production build succeeds                   |
| E2E       | `bun run test:e2e`      | Playwright passes against the built preview |

## Development docs (extend)

- Extend the `## Scripts` table in the `development` context entry under `canon/context/` with every web script
- Expect each framework stack to add its `dev`, `build`, `preview`, and `typecheck` rows

| Command                 | Purpose                            |
| ----------------------- | ---------------------------------- |
| `bun run lint`          | Run oxlint, no warnings allowed.   |
| `bun run lint:fix`      | Auto-fix oxlint issues.            |
| `bun run test`          | Run Vitest in watch mode.          |
| `bun run test:run`      | Run Vitest once, verbose.          |
| `bun run test:changed`  | Run the Vitest files it is passed. |
| `bun run test:coverage` | Run Vitest with coverage.          |

The browser rows follow.

| Command                     | Purpose                                 |
| --------------------------- | --------------------------------------- |
| `bun run test:e2e`          | Run Playwright E2E tests.               |
| `bun run test:e2e:changed`  | Run specs the diff's import graph hits. |
| `bun run screenshot`        | Build, preview, capture screenshots.    |
| `bun run readme-screenshot` | Capture the README frame.               |
| `bun run smoke:prod`        | Capture against a required base URL.    |
