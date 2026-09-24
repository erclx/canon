---
description: Enforce Go testing package, table-driven cases, and test helper patterns for Go tests
paths:
  - '**/*_test.go'
---

# Go testing tooling

## Layer

- Load the `canon:test-craft` skill to pick the layer a test belongs at before choosing the tooling below, and report it rather than proceeding silently when the skill does not resolve.

## Framework

- Use the standard `testing` package. Do not add an assertion library for what `t.Errorf` and `t.Fatalf` already state.
- Place a test beside the code it tests, in a `_test.go` file of the same package.
- Use an external `<pkg>_test` package when a test should see only the exported API.

## Table-driven cases

- Write cases as a slice of structs run through `t.Run`, over one test function per case.
- Give every case a `name` field and pass it to `t.Run`.

## Helpers and setup

- Call `t.Helper()` first in every test helper.
- Use `t.Cleanup` over `defer` for teardown a helper registers.
- Use `t.TempDir` and `t.Setenv` over hand-rolled temp directories or environment stashes.
- Use `net/http/httptest` over a real listener.

## Concurrency

- Do not synchronize with `time.Sleep`. Wait on a channel, a `sync.WaitGroup`, or a deadline.
- Run tests with `-race`.
- Mark a test `t.Parallel()` only when it shares no mutable state with another test.
