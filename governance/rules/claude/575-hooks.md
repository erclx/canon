---
description: State the hook stdin guard and the silencing rule for .claude/hooks scripts
paths:
  - '.claude/hooks/**/*.sh'
---

# Hook standards

## Reading a payload

- Open a hook that reads a payload with a bounded `IFS= read -r -d '' -t 2 input`, exiting non-zero on an empty payload. An unbounded `cat` blocks forever against a hand run or an open socket, holding the session open with it.

## Silencing output

- Before silencing a hook's output, name the stage that catches the same failure. A hook that is the only enforcer of a rule makes its documented guarantee false when it discards that output.
- Where no other stage catches the failure, capture the output into a variable, exit 0 on success, and emit the error lines as `additionalContext`.
