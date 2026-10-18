# Tooling Go reference

> Extends: `base`. Apply base stack first.

## Overview

The go stack covers Go modules linted and formatted by `golangci-lint` v2, type-checked by `go vet`, and tested by `go test`. It ships a golden `.golangci.yml`, a go phase list for base's verify runner, and a copy-once smoke test.

## Scaffold checklist

1. Scaffold with `go mod init <module-path>`. The module path is the project's own identity, so this stack never ships a `go.mod`.
2. Keep `./...` out of `node_modules` with `go mod edit -ignore=./node_modules` (Go 1.25 or later). A root sync installs `node_modules/` in the module, and a package there can ship `.go` files.
3. Seed `package.json` with `bun init -y`, so the base layer's bun-side tools (husky, oxfmt, commitlint) have a target to install into.
4. Install base tooling with `canon tooling sync base . --write`.
5. Install go tooling with `canon tooling sync go . --write`.
6. Install the linter with `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest`. This stays manual, since manifest injection runs `bun add -D`, which cannot install a Go tool.
7. Run `bun run lint:fix`, then `bun run format`, then `bun run check`.

### The smoke test seed

The stack ships `smoke_test.go` at the module root as a copy-once seed. A module with no `.go` file fails the linter, `go vet`, and `go test` on an empty package list, so the seed lets `bun run check` pass on a fresh scaffold.

It declares `package main`. Delete or rename it once the root package takes another name, or the build reports two packages in one folder.

## golangci-lint

The config uses `version: '2'` and starts from `default: standard`.

- Enable `bodyclose`, `errorlint`, `gosec`, `misspell`, `noctx`, `revive`, `sqlclosecheck`, `rowserrcheck`, and `unconvert`.
- The two SQL linters report only on `database/sql` call sites, so they cost nothing without a database.
- Enable formatters `gofmt` and `goimports`, with `lint:fix` running `golangci-lint fmt` ahead of `golangci-lint run --fix`.
- Exclude `node_modules` from both linters and formatters. The `go.mod` `ignore` directive covers every Go tool, but `go.mod` belongs to the project and sync cannot write it.
- That exclusion keeps `golangci-lint run` from reporting, and `golangci-lint fmt` from rewriting, a vendored `.go` file in a module that never added the directive.

## verify.json

### Phases

The go phase list requires three phases and probes the tools first.

- Require Typecheck (`go vet`), Lint (`golangci-lint run`), and Unit tests (`go test -v`).
- Base's runner adds the four base phases where the folder declares their scripts, then the markdown bans stage.
- Probe `go` and `golangci-lint` first, and name the `go install` command when `golangci-lint` is missing.

### Left out and prepared

Two things stay out of the list, and one step runs before it.

- Keep `build` out, though the stack declares the script. `go build ./...` exits 1 with `no packages to build` on a module holding only a test file.
- A seeded `main.go` would assume every module is a binary rather than a library.
- Keep `-race` out of `test:run`. The race detector needs cgo and a C toolchain, so it belongs in CI rather than a local `bun run check`.
- The manifest's `[verify] prepare` runs checklist steps 3 and 6 for `canon tooling verify go`, being `bun init -y` and the `go install` when the binary is not on PATH.
- The scaffold writes no `package.json`, and a verify that reaches its end with none fails.

## CI

- Install Go with `actions/setup-go`, reading the version from `go.mod` through `go-version-file`.
- Install the linter with the same `go install` line as the scaffold checklist.
- Run `go test -race ./...` in CI.

## Anti-patterns

- Do not ship `go.mod` or `go.sum` from tooling. Both belong to the project, and a golden copy would overwrite its module path on every sync.
- Do not pin the linter through a `tools.go` file or a `tool` directive in `go.mod`. The module is project-owned, so the install stays in the checklist.
- Do not ship a `Dockerfile`, `.dockerignore`, or `compose.yaml` under tooling. Those are deployment choices and belong in the project itself.

## Development docs (extend)

Append these rows to the `## Scripts` table.

| Command             | Purpose                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| `bun run lint`      | Run `golangci-lint run`.                                                       |
| `bun run lint:fix`  | Format with `golangci-lint fmt`, then auto-fix with `golangci-lint run --fix`. |
| `bun run typecheck` | Run `go vet`.                                                                  |
| `bun run test`      | Run `go test`.                                                                 |
| `bun run test:run`  | Run `go test -v` (used by `verify`).                                           |
| `bun run build`     | Run `go build`.                                                                |

## CI docs (extend)

In `canon/context/development/ci.md`, add or change three rows. <!-- audit-ignore-citations: canon/context/development/ci.md -->

- The Typecheck row asserts `` `go vet ./...` passes ``.
- A Lint row asserts `` `golangci-lint run` passes ``.
- A Tests row asserts `` `go test -race ./...` exits 0 ``.
