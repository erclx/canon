# Tooling web reference

> Extends: `base`. Apply base stack first.

## Overview

The web layer covers web-universal tooling shared across Vite + React, Astro, and any future web stack. It ships golden configs for ESLint, Vitest, Playwright, Tailwind v4, screenshots, VS Code integration, and CI. Framework-specific wiring (Vite plugins, Astro islands, Next.js config) lives in per-stack adapter folders that extend this layer.

## What ships as golden configs

Golden config files live in `tooling/web/configs/` and are copied into the target on `canon tooling sync web . --write`, replacing whatever sits at those paths. They are the source of truth. The reference covers rationale and tradeoffs. Configs show the concrete setup.

- `eslint.config.js`: flat config with `@eslint/js`, `typescript-eslint`, React hooks, import sort, check-file, vitest rules scoped to test files, `eslint-config-prettier` last.
- `src/test/setup.ts`: `@testing-library/jest-dom` import, `cleanup` after each test.
- `e2e/screenshot.ts`: capture template. A single `CASES` record at the top carries one entry per output file, each naming a section, a theme, and a route, and the loop below crosses every case with the `VIEWPORTS` array and writes `screenshots/<hostname>/<section>/<width>--<theme>.png`, keyed on `SCREENSHOT_BASE_URL`'s hostname so a local and a deployed run land in different folders. `VIEWPORTS` holds four breakpoint buckets named by width, 320, 768, 1280 and 1536, with 320 as the base a page has to hold without wrapping or clipping. A case flagged `evidence: true` additionally writes `evidence/<section>/<width>--<theme>.png`, with no hostname segment, at the viewports flagged `evidence` alone, which are 320 and 1280. Committing all four multiplies the tracked frames by the width count, so the flag is what keeps the tracked set at twice the sections rather than four times. A case may name `excludeViewports` to skip a width, for a route whose long-form prose reflows at 320 instead of breaking. `SCREENSHOT_FILTER` narrows a run to the cases whose label, `<section>/<width>--<theme>`, contains any comma-separated term, exits 1 when nothing matches and lists the labels that exist, and leaves the rest of the sweep alone. `--require-base-url` skips a flagged case entirely, so a production smoke run neither writes to the committed path nor counts an evidence route in its console-clean check, and exits 1 when that leaves zero cases run, so flagging every case cannot silence the production check without saying so. Per-project cases extend the one record. A route's widths and themes sit together under its section folder, so the filename carries both. A case may also name `sections`, one `{ name, selector }` per addressable part of the route, and each writes its own frame at `screenshots/<hostname>/<section>/<name>/<width>--<theme>.png` beside the whole-page one, plus `evidence/<section>/<name>/<width>--<theme>.png` where the case is flagged and the width carries `evidence`. The field is optional, so a case that names none captures the page alone as before, and a selector matching nothing is reported and skipped rather than raised, since `CASES` is a template a project rewrites and a target that syncs this file before editing its own list would otherwise capture nothing at all. Testing that every named section resolves belongs to the project that owns the selectors, beside its own page. A case may also name `mask`, a list of selectors whose boxes are painted over in every frame the case writes, whole-page and section alike, for a value that moves between runs with no code change, so a double capture still compares everything else. A mask selector matching nothing is reported and skipped the same way. Every case settles before anything is shot: the context is created with `reducedMotion: 'reduce'`, each named section is scrolled into view so an `IntersectionObserver` fires and a frame marked `loading="lazy"` loads, the page returns to the top, and fonts, images and same-origin frames are waited out on a bounded condition rather than on a second `networkidle`, which is a lifecycle event of the navigation and does not re-arm for a load a scroll started. A section frame drops the page's floating chrome, being whatever computes to `position: sticky` or `fixed`, because a section taller than the viewport is scrolled into view to be cut and a sticky bar otherwise rides that scroll into the middle of the frame. The whole-page frame is shot first and keeps its chrome. `--check-console-clean` collects `console`-level error messages per case and exits 1 with the list if any fired, turning the capture into a smoke check. `--require-base-url` exits 1 before launching a browser when `SCREENSHOT_BASE_URL` is unset, guarding a script meant to run against a real deployment from silently capturing `localhost`.
- `scripts/screenshot.sh`: sources `scripts/lib/preview-server.sh`, then runs the capture against the served preview.
- `scripts/lib/preview-server.sh`: sourced, never executed. Builds, serves on `PREVIEW_PORT`, blocks until the port answers, and traps the whole process group on exit, including the detached grandchild `lsof` finds. Both capture scripts source it so the startup lives once.
- `scripts/readme-screenshot.sh`: captures one case under `SCREENSHOT_FILTER` and copies its light and dark frames to `assets/evidence/readme/`. `README_FILTER` ships empty with `header/1280` as its example, and the script exits 1 until a project fills it, since a shipped default would capture the wrong part of the page in every project but one. Its copy reads from `screenshots/<hostname>/`, which is where the harness writes.
- `.github/workflows/readme-screenshot.yml`: refreshes that frame on a pull request and commits it back to the branch. The path list ships as `REPLACE_WITH_PROJECT_PATHS`, and the job's first step after checkout exits 1 while it stays, since a job that never fires leaves no run and no diff to notice. The workflow's own path is in the list so the installing pull request reaches that step. When a commit-back is right and when a report is, `governance/rules/tooling/700-ci-workflow.md` states the test.
- `.vscode/extensions.json` and `.vscode/settings.json`: editor wiring for ESLint, Tailwind, Playwright, Vitest.
- `.github/workflows/verify.yml`: `static-checks`, `unit-tests`, `build-verify`, and `e2e-tests` jobs.
- `scripts/verify.sh`: extends base verify with typecheck, lint, unit tests, and build in the full order. Its last stage runs `scripts/check-card-exclusion.sh` whenever that file is installed, which puts the social card route's build exclusion on the default path rather than behind a flag nobody passes. The stage tests for the script rather than for a framework, so this layer owns when the check runs and the stack shipping a card route owns what it reads. The astro reference carries the route itself.
- `scripts/worktree-port.sh`: prints a base port plus this working directory's offset. Called with no argument it prints the offset alone. It refuses a folder left under the worktrees directory after its worktree was removed, rather than printing a port for it.

## What stays in per-stack adapters

Framework glue lives in `tooling/vite-react/configs/` or `tooling/astro/configs/` because the merge helpers and config shapes differ:

- `vite.config.ts` or `astro.config.mjs`: the framework's config.
- `vitest.config.ts`: uses `mergeConfig` in Vite stacks, `getViteConfig` from `astro/config` in Astro.
- `playwright.config.ts`: `webServer` command differs per stack.
- `tsconfig.json`: `extends` target differs. Astro uses `astro/tsconfigs/strict`. Vite projects use scaffold defaults.

## File layout

- `src/` for app code, `e2e/` for Playwright, `scripts/` for shell, `src/test/setup.ts` for Vitest globals.
- Path alias `@` maps to `./src` in both tsconfig and the framework's build config.
- Tsconfig is unified at root with `noEmit: true` in Vite stacks. Astro uses the scaffold default from `@astrojs/check`.

## Ports

Two worktrees of one repository run the same stack, so a fixed port makes the second one attach to the first.

- Derive every served port from `scripts/worktree-port.sh`. Never write a port literal into a script string.
- Read `WORKTREE_PORT_OFFSET` in a config and add it to the stack's default port. Unset yields the default, so a plain clone keeps the port it has always served on.
- Draw the offset from a band of 50, hashed from the worktree folder name. Two worktrees can hash to one offset, so set `WORKTREE_PORT_OFFSET` by hand to break a tie.
- Expect a non-zero exit and no port from a folder left under `.claude/worktrees/` once its worktree is gone. Git reports the parent repository from inside one, so the helper cannot read it as a worktree and every base it serves would land on the main checkout's port. Both shapes refuse, and they reach differently. A folder whose own `.git` was deleted refuses only under that directory, since location is the only thing separating it from an ordinary subdirectory the base port is correct for. A folder whose `.git` names a pruned administrative directory refuses wherever it sits, because a pointer to nothing is broken regardless of where the folder is.
- Call it as `VAR=$(bash scripts/worktree-port.sh) && export VAR && <server>`, never as the shorter `VAR=$(bash scripts/worktree-port.sh) <server>`. An assignment prefix discards the exit status of its own substitution, so the shorter form starts the server with `VAR` set to the empty string, every config reads that back as an offset of zero, and the refusal lands on the port it was raised to protect. The assignment alone carries the status, which is what the `&&` reads.
- Set `WORKTREE_PORT_OFFSET` by hand to serve from such a folder anyway. That is the one override, and it is checked before any directory test.
- Force-replace `dev` and `preview` through `[scripts.override]`. Both stacks' scaffolds define those keys, and a plain `[scripts]` entry never replaces a key the scaffold already wrote.
- Set `strictPort` on every dev and preview server. A server that walks to the next free port serves where nothing is looking for it.
- Set Playwright `reuseExistingServer: false`. Reuse attaches to whatever answers on the port, which reports a pass against another branch's code and prints nothing to say so.

## Anti-patterns

Sticky negative knowledge. Do not relearn.

- Do NOT use `tsc -b` in a Vite project. Composite mode emits `.js` next to `.ts` and ESLint lints the emitted files. Use `tsc --noEmit`.
- Do NOT accept `eslint@^10` alongside `typescript-eslint@^8`. Chain breaks with `TypeError: Class extends value undefined` from `LegacyESLint`. Pin `eslint@^9` until `typescript-eslint@^9` with ESLint 10 support ships.
- Do NOT trust `vite-react`'s scaffolded `lint` script. It ships its own `"lint": "oxlint"` under a bare `.oxlintrc.json`, which runs a different rule set from the stack's ESLint config and never gates on it. `[scripts.override]` forces the stack's own eslint invocation back over it.
- Do NOT rely on bare-folder exclude globs like `exclude: ["e2e"]`. Use `"e2e/**/*"`.
- Do NOT ship Vitest with no-tests-fail. Fresh scaffolds have zero tests. Use `passWithNoTests: true` or equivalent until the project has at least one test.
- Do NOT put Playwright `trace` at the top level of `defineConfig`. It lives under `use`.
- Do NOT skip `skipLibCheck: true` in Vite + React tsconfig. `@testing-library/jest-dom` and Vite's `module-runner` produce type conflicts otherwise.
- Do NOT run `bunx shadcn@latest init` over a pre-existing `src/styles/global.css`. Shadcn silently overwrites it. Back up first or run shadcn init before writing custom global styles. Use flags `-t <template> -b <base> -p <primary> -y` to avoid interactive prompts.

## Tool pairing

- Unit tests: Vitest with jsdom, globals on, setup file at `src/test/setup.ts`, `@testing-library/react`, `@testing-library/user-event`.
- E2E: Playwright in `e2e/`. Chromium-only for Chrome extensions, all browsers for web apps.
- Tailwind: v4 via `@tailwindcss/vite`. Never the v3 integration.
- Prettier: `prettier-plugin-tailwindcss` last in plugins array. Astro also adds `prettier-plugin-astro` first.

## Prettier (extend)

- Base ships `.prettierrc` with `semi: false`, `singleQuote: true`. Web layer adds `jsxSingleQuote: true` and `prettier-plugin-tailwindcss` via the manifest.
- Per-stack overrides go in the stack's configs (Astro adds `prettier-plugin-astro` and the `.astro` parser override).

## lint-staged (extend)

- Add `**/*.{js,jsx,ts,tsx}` glob running `eslint --fix --max-warnings 0`, `prettier --write`, `cspell --no-must-find-files`.
- Extend the prettier glob to include `css`: `**/*.{json,css,md,mdc}`.
- Each file type runs cspell once via its own glob. No standalone cspell glob.

## CI docs (extend)

Extend `canon/context/ci.md` so the `## Checks` table reflects the web jobs. <!-- audit-ignore-citations: canon/context/ci.md -->

Append rows:

| Typecheck | `bun run typecheck` | framework-specific typecheck passes |
| Lint | `bun run lint` | ESLint passes with zero warnings |
| Tests | `bun run test:coverage` | Vitest passes with coverage thresholds |
| Build | `bun run build` | Production build succeeds |
| E2E | `bun run test:e2e` | Playwright passes against the built preview |

Under `## Running CI locally`, document that `bun run check:full` runs verify plus `test:e2e`.

## Development docs (extend)

Extend the `development` context entry under `canon/context/` so the `## Scripts` table lists every web script. Stack adapters add their `dev`, `build`, `preview`, `typecheck` rows.

Append rows:

| `bun run lint` | Run ESLint with zero warnings allowed. |
| `bun run lint:fix` | Auto-fix ESLint issues. |
| `bun run test` | Run Vitest in watch mode. |
| `bun run test:run` | Run Vitest once with verbose reporter. |
| `bun run test:coverage` | Run Vitest with coverage. |
| `bun run test:e2e` | Run Playwright E2E tests. |
| `bun run test:e2e:changed` | Run Playwright E2E tests for specs the import graph reaches from the current diff. |
| `bun run screenshot` | Build, preview, then capture screenshots. |
| `bun run readme-screenshot` | Build, preview, then capture the README frame into `assets/evidence/readme/`. |
| `bun run smoke:prod` | Capture against `SCREENSHOT_BASE_URL`, requiring it set and failing on any console error. |

`canon tooling verify <stack>` is the only automated caller of `bun run screenshot`, running it for any stack whose `package.json` declares the script and asserting that PNG files land under `screenshots/`. It counts them with a recursive find carrying no depth limit, so the section folders the seed writes satisfy the assertion without a change to it. Do not flatten the layout to protect that check. No ship chain captures a screenshot, so the output path the seed writes is a contract that one verifier reads rather than a default a ship step depends on.

`governance/rules/ui/440-surface-capture.md` is what asks a session to run the capture after a surface changes. It now fires on every component file too, reversing the route-and-page-only scope this reference once described, after a shipped batch of components carried no capture and a defect went unseen. The rule body states its own exemption for a component the production build strips out, so a reader chasing that case reads it there rather than here.

The sweep under `screenshots/` is ignored again, and only a flagged case's `evidence/` output tracks in git, so the first capture a scaffolded target runs after this change is the baseline it commits there. A case naming sections commits a folder per section under that baseline rather than one file per theme, which is what lets a pull request comparison land on the part of the page that moved instead of on one image of the whole of it. The count is the section list times the themes, so a list is worth sizing against how many frames each later change has to regenerate and a reviewer has to read.

## Gitignore (extend)

`[gitignore]` groups this stack edits, restated here per the manifest-to-reference symmetry:

- `"# Playwright" = ["test-results/", "playwright-report/", "blob-report/", "playwright/.cache/"]`
- `"# Screenshots" = ["screenshots/"]`

## Verify script

The web layer's `scripts/verify.sh` replaces the base version. Order: typecheck, lint, format, spelling, shell, unit tests, build, then the card exclusion check where one is installed. Stack adapters may override if their typecheck or build differs.

The card stage is conditional on `scripts/check-card-exclusion.sh` existing rather than on the stack, so a project with no card route runs one less stage and needs no override to skip it. A stack that ships a card route ships that script, and the check reads the build the stage before it produced.
