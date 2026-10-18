---
title: Go rule ledger
description: Sources for governance/rules/lang/go.md, one row per bullet
---

# Go rule ledger

The field is Go programming, and the authority is the Go project's own documentation at go.dev and pkg.go.dev, with the Code Review Comments wiki as the team's review guide. The package pages read name go1.27.2, and the wiki and layout pages name no release.

## Errors

| Bullet                       | Source                                                                                                                                                        | Read                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Wrap with `%w`               | [errors](https://pkg.go.dev/errors): "An easy way to create wrapped errors is to call fmt.Errorf and apply the %w verb to the error argument"                 | 2026-10-18, go1.27.2 |
| Match with `Is` or `As`      | [errors](https://pkg.go.dev/errors): `Is` "should be used in preference to simple equality checks", since it walks the wrapped chain                          | 2026-10-18, go1.27.2 |
| Never discard with `_`       | [Code Review Comments](https://go.dev/wiki/CodeReviewComments#handle-errors): "Do not discard errors using `_` variables"                                     | 2026-10-18           |
| `panic` for broken invariant | [Code Review Comments](https://go.dev/wiki/CodeReviewComments#dont-panic): "Don't use panic for normal error handling. Use error and multiple return values." | 2026-10-18           |

## Context

| Bullet                   | Source                                                                                                                                                             | Read                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| First parameter, `ctx`   | [context](https://pkg.go.dev/context): "The Context should be the first parameter, typically named ctx"                                                            | 2026-10-18, go1.27.2 |
| Never in a struct        | [context](https://pkg.go.dev/context): "Do not store Contexts inside a struct type", and "pass a Context explicitly to each function that needs it"                | 2026-10-18, go1.27.2 |
| No `nil`, `context.TODO` | [context](https://pkg.go.dev/context): "Do not pass a nil Context, even if a function permits it. Pass context.TODO if you are unsure about which Context to use." | 2026-10-18, go1.27.2 |

## Interfaces

| Bullet                             | Source                                                                                                                                                                                                                                                                                  | Read       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| In the consumer, only its calls    | [Code Review Comments](https://go.dev/wiki/CodeReviewComments#interfaces): "Go interfaces generally belong in the package that uses values of the interface type", and [Effective Go](https://go.dev/doc/effective_go#interfaces): "Interfaces with only one or two methods are common" | 2026-10-18 |
| Accept interfaces, return concrete | [Code Review Comments](https://go.dev/wiki/CodeReviewComments#interfaces): "The implementing package should return concrete (usually pointer or struct) types"                                                                                                                          | 2026-10-18 |

## Packages

| Bullet                       | Source                                                                                                                                                                                                               | Read       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `internal/` for private code | [Organizing a Go module](https://go.dev/doc/modules/layout): `internal` "prevents other modules from depending on packages we don't necessarily want to expose", and "keep packages in internal as much as possible" | 2026-10-18 |
| No side effects in `init`    | House choice: `init` runs on every import, tests included, in an order the reader cannot see from the call site, so a dependency it wires is hidden and cannot be swapped                                            | 2026-10-18 |
| No mutable package state     | House choice: a package-level variable is shared by every caller and every parallel test, so one test's write leaks into another and a data race needs no visible goroutine                                          | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### A convention Claude follows unprompted

The four casing bullets went under the plan's question 1, whose suggestion stood. `gofmt`, [Effective Go](https://go.dev/doc/effective_go#names), and Code Review Comments set each of them, and Claude writes them without the rule. The error-position bullet went on the same test.

- Cut "`MixedCaps` for exported names, never underscores", which Effective Go states as "the convention in Go is to use MixedCaps or mixedCaps rather than underscores".
- Cut "one short lowercase package name, not `util`, `common`, or `helpers`", which Effective Go and the wiki's "Avoid meaningless package names like util, common, misc" both state.
- Cut "do not repeat the package name in an exported identifier", which Effective Go shows with `bufio.Reader` over `BufReader`.
- Cut "keep initialisms in one case". No sampled session was run to test it, so the suggestion's condition for keeping it was never met.
- Cut "return an error as the last result value", a convention every Go signature Claude writes already follows.

### Merged or reworded

- Merged "keep an interface to the methods its consumer calls" into the consumer-placement bullet, since both state where an interface's method set comes from.
- Reworded the `errors.Is` bullet to ban `==` as well as string matching, since the package page sets `Is` against "simple equality checks".
- Gave the discard ban the wiki's own alternative, to handle, return, or panic.
- Gave the package-state ban an alternative, a struct the caller owns.
