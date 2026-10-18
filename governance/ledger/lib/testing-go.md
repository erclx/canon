---
title: Go testing rule ledger
description: Sources for governance/rules/lib/testing-go.md, one row per bullet
---

# Go testing rule ledger

The field is Go testing, and the authorities are the `testing` and `net/http/httptest` package documentation at pkg.go.dev, the Go wiki at go.dev, and the race detector article. None of the pages read names a Go release beyond a 1.22 loop-variable note, so the rows record the read date alone.

## Layer

| Bullet                  | Source                                                                                              | Read       |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| Load `test-craft` first | House choice: a pointer to the skill that owns the choice of layer, claiming no practice of its own | 2026-10-18 |

## Framework

| Bullet                                | Source                                                                                                                                                                     | Read       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Standard `testing`, no assert library | [Go test comments](https://go.dev/wiki/TestComments): "Avoid the use of 'assert' libraries to help your tests", which "make it too easy to write imprecise tests"          | 2026-10-18 |
| External `_test` package              | [Package testing](https://pkg.go.dev/testing): a test file in a package with the "_test" suffix is black-box, where "the package being tested must be imported explicitly" | 2026-10-18 |

## Table-driven cases

| Bullet                           | Source                                                                                                                                  | Read       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Slice of structs through `t.Run` | [Table driven tests](https://go.dev/wiki/TableDrivenTests): "Each table entry is a complete test case with inputs and expected results" | 2026-10-18 |
| A `name` per case                | [Package testing](https://pkg.go.dev/testing): "Run runs f as a subtest of t called name", which is how a failure names its case        | 2026-10-18 |

## Helpers and setup

| Bullet                     | Source                                                                                                                                                        | Read       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `t.Helper()` first         | [Package testing](https://pkg.go.dev/testing): "Helper marks the calling function as a test helper function", skipped when printing file and line             | 2026-10-18 |
| `t.Cleanup` over `defer`   | [Package testing](https://pkg.go.dev/testing): Cleanup runs "when the test (or subtest) and all its subtests complete"                                        | 2026-10-18 |
| `t.TempDir` and `t.Setenv` | [Package testing](https://pkg.go.dev/testing): the directory is removed when the test finishes, and Setenv "uses Cleanup to restore the environment variable" | 2026-10-18 |
| `httptest` over a listener | [Package httptest](https://pkg.go.dev/net/http/httptest): "NewServer starts and returns a new Server listening on a local network loopback interface"         | 2026-10-18 |

## Concurrency

| Bullet                              | Source                                                                                                                                  | Read       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| No `time.Sleep` sync                | House choice: a sleep long enough on one machine is too short on a loaded runner, so the test fails with no defect in the code          | 2026-10-18 |
| `-race`                             | [Data race detector](https://go.dev/doc/articles/race_detector): "add the `-race` flag to the go command", as in `go test -race mypkg`  | 2026-10-18 |
| `t.Parallel()` without shared state | [Table driven tests](https://go.dev/wiki/TableDrivenTests): "Parallelizing table tests is simple, but requires precision to avoid bugs" | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### A default the toolchain already applies

- Cut "place a test beside the code it tests, in a `_test.go` file of the same package". The `go` tool finds tests only in `_test.go` files, and Claude writes them that way unprompted.

### Merged or reworded

- Gave the `t.Cleanup` bullet its reason, a `defer` in a helper firing as the helper returns.
