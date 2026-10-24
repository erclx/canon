# Project

Frameboard is a local design board that coding agents draw on as plain HTML files, and you review and tweak.

## Context

- Before non-trivial work in a domain read `canon/context/<area>/<domain>.md`. Pick which from the index anchor below.

@canon/REQUIREMENTS.md
@canon/context/index.md

## Commands

- `bun run check`: the gate to run before committing, which `canon/context/development/local.md` breaks down

## Key paths

### Code

The source layers and the end-to-end suite that drives them.

- `src/cli/`: the `frameboard` command, its commander program and the bin entry rolldown bundles into `dist/cli.js`
- `src/server/`: the Hono app and the loopback server that serves the built client
- `src/client/`: the React board UI, its shadcn kit under `components/ui/`, and the token stylesheet
- `src/shared/`: code both the CLI and the server import, such as the package version
- `e2e/`: Playwright specs, the capture harness with its cases under `e2e/capture/`, and the evidence baseline

### Content

The design records the board UI is built against.

- `canon/DESIGN.md`: visual intent, pointing at the stylesheet that holds the values
- `canon/design/`: each surface's accepted design as light and dark PNGs beside its frame HTML, grouped by app part plus `foundations/`, captured by `bun run design:sync` from `.canon/board`
