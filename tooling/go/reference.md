# Tooling Go reference

> Extends: `base`. Apply base stack first.

## Overview

The go stack covers Go modules linted and formatted by `golangci-lint` v2, type-checked by `go vet`, and tested by `go test`. It ships a golden `.golangci.yml`, a Go-aware `verify.sh`, and a copy-once smoke test.

## Scaffold checklist

1. Scaffold with `go mod init <module-path>`. The module path is the project's own identity, so this stack never ships a `go.mod`.
2. Seed `package.json` so the base layer's bun-side tools (husky, prettier, cspell, commitlint) have a target to install into: `bun init -y`.
3. Install base tooling: `canon tooling sync base . --write`
4. Install go tooling: `canon tooling sync go . --write`
5. Install the linter: `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest`. The manifest declares no `[dependencies.dev]`, because manifest injection runs `bun add -D`, which cannot install a Go tool. This step stays manual.
6. Run `bun run lint:fix` then `bun run check`.

The go stack also ships `smoke_test.go` at the module root as a copy-once seed. A module with no `.go` file fails `golangci-lint run`, `go vet`, and `go test` on an empty package list, so the seed is what lets `bun run check` pass on a fresh scaffold. It declares `package main`, so delete or rename it once the root package takes another name, or the build reports two packages in one folder.

## golangci-lint

- Use config `version: '2'`.
- Start from `default: standard`.
- Enable `bodyclose`, `errorlint`, `gosec`, `misspell`, `noctx`, `revive`, `sqlclosecheck`, `rowserrcheck`, and `unconvert`. The two SQL linters report only on `database/sql` call sites, so they cost nothing in a module without a database.
- Enable formatters `gofmt` and `goimports`. `lint:fix` runs `golangci-lint fmt` ahead of `golangci-lint run --fix`.
- Exclude `node_modules` from both linters and formatters. At a root sync the base layer's `node_modules/` sits inside the module, `./...` walks it, and a package there can ship a `.go` file, which `golangci-lint run` then reports and `golangci-lint fmt` rewrites. `go vet` and `go test` still walk it, since `./...` has no exclusion of its own.

## verify.sh

- Run Typecheck (`go vet`), Lint (`golangci-lint run`), and Unit tests (`go test -v`), plus the four base phases wherever the folder declares their scripts.
- Keep `build` out of `verify.sh`. `go build ./...` exits 1 with `no packages to build` on a module holding only a test file, and a seeded `main.go` would assume every module is a binary rather than a library.
- Keep `-race` out of `test:run`. The race detector needs cgo and a C toolchain, so it belongs in CI rather than in a local `bun run check`.

## CI

- Install Go with `actions/setup-go`, reading the version from `go.mod` through `go-version-file`.
- Install the linter with the same `go install` line as the scaffold checklist.
- Run `go test -race ./...` in CI.

## Anti-patterns

- Do not ship `go.mod` or `go.sum` from tooling. Both belong to the project, and a golden copy would overwrite its module path on every sync.
- Do not pin the linter through a `tools.go` file or a `tool` directive in `go.mod`. The module is project-owned, so the install stays in the checklist.
- Do not ship a `Dockerfile`, `.dockerignore`, or `compose.yaml` under tooling. Those are deployment choices and belong in the project itself.

## Development docs (extend)

Append to the `## Scripts` table:

| `bun run lint` | Run `golangci-lint run`. |
| `bun run lint:fix` | Format with `golangci-lint fmt`, then auto-fix with `golangci-lint run --fix`. |
| `bun run typecheck` | Run `go vet`. |
| `bun run test` | Run `go test`. |
| `bun run test:run` | Run `go test -v` (used by `verify`). |
| `bun run build` | Run `go build`. |

## CI docs (extend)

In `canon/context/ci.md`, the Typecheck row's assertion reads: `` `go vet ./...` passes ``. Add a Lint row whose assertion reads: `` `golangci-lint run` passes ``. Add a Tests row whose assertion reads: `` `go test -race ./...` exits 0 ``.
