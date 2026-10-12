---
title: Output shape
description: Two framed shapes every command renders into, how JSON and --names modes keep stdout clean, and the exit discipline that lets piped output drain
---

# Output shape

Every CLI command renders into one of two framed shapes. Data goes to stdout. UI and logs go to stderr.

Help output is the exception. It prints to stdout so it can be piped and grepped.

## Data shape (lists, runs, errors)

```plaintext
┌
│ canon <domain>
│
├ Section
│ ✓ item
│ ✓ item
└
```

Rules:

- `┌` opens the frame on stderr
- `│ canon <domain>` is the command banner, one per invocation
- `├ Section` headers introduce groups of items. `log_step` produces the blank `│` spacer before each.
- `└` closes the frame on stderr, wired via `trap close_timeline EXIT`
- Errors render as `│ ✗ message` inside the same frame. Never emit a lone error line without a frame.

## Help shape

```plaintext
┌
├ Usage: canon <domain> [command]
│
│  Commands:
│    ...
└
```

Help skips the banner. The `Usage:` line sits directly on `├`. Help writes to stdout because `--help` is documentation, not runtime UI. `--help --all` on a command prints each block unframed, one after another, and a help request naming an unknown subcommand, under a group that takes no operand of its own, writes its refusal to stderr and exits 1.

## JSON and `--names` modes

`--json` and `--names` keep stdout clean and machine-readable. The frame still renders on stderr (open, banner, close) so the stream discipline is consistent across modes. Consumers that only read stdout see pure data.

## Color

Escape sequences reach a destination that renders them and nowhere else. The question is asked per stream rather than once for the process, so a run piping its data while keeping a terminal on stderr still gets color on the frame.

Either condition alone turns color off:

- `NO_COLOR` is set to any non-empty value, whatever that value says
- The destination is not a terminal, which covers a pipe, a file, and a captured session

The frame survives both. `┌`, `│`, `├`, `└`, and the `✓ ! + - ✗` marks are structure rather than color, and they are what lets a captured run still read as one block. A caller wanting neither the frame nor the color reads `--json` instead.

Terminal control is a separate question this section does not cover. The cursor and key sequences an interactive prompt writes run only where a terminal already exists.

## Process exit

A command action sets `process.exitCode` and returns. Calling `process.exit()` there ends the process before a stdout write drains, which truncates piped output at the 64K pipe buffer while still reporting the right exit code. Redirecting to a file hides the truncation, so it surfaces only through a pipe, which is what a check has to use to catch it.

The rule reaches an error path that writes to stderr alone, where the truncation has nothing to cut. Scoping it to the stdout writers was the alternative and it makes the floor depend on a detail that moves, since an action grows a stdout write long after its error branches are written. An action always has a return path, so the requirement costs it a line.

The exit belongs to a helper that has no caller to unwind through. A prompt inside a promise executor and a wrapper propagating a child process status both qualify, and neither can hand a value back to a caller expecting one. A validation helper called from an action does not: it throws from a `never` return, which keeps its caller exhaustive to the compiler while the action catches and owns the code.

Diagnostics reach stderr in every mode, including `--json`. Name the file and the field that failed, because a JSON record carries an action and a reason and an operator reading stderr alone sees neither.
