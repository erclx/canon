---
description: Enforce exit and stream discipline in CLI command actions
paths:
  - 'src/**/*.ts'
---

# CLI output standards

## Process exit

- Set `process.exitCode` and return from a command action. Calling `process.exit()` there ends the process before a stdout write drains and truncates piped output at the 64K pipe buffer.
- Verify output through a pipe. Redirecting to a file hides the truncation, and the exit code is correct either way.
- Confine `process.exit()` to a helper with no caller to unwind through, such as a prompt inside a promise executor or a wrapper propagating a child process status. A command action always has a return path, so it never qualifies.
- Throw from a validation helper typed `never` rather than exiting, and catch at the action that called it. The action owns the exit code, and the `never` return keeps the caller exhaustive to the compiler.

## Streams

- Write diagnostics to stderr in every mode, including `--json`.
- Name the file and the field that failed on stderr. A JSON record carries an action and a reason, so an operator sees neither without it.

## Authority

- Follow `docs/agents/output-shape.md` for the framed shapes, the stream split, and the exit discipline behind them. It is the single source.
