---
title: Hosted preview check
description: How review-ui confirms a hosted preview was built from the head before driving it, and the act each reason of canon pr preview --check takes
---

# Hosted preview check

Step 3 of `review-ui`. The session reads this file when the hosted `preview` rung answers. A pass driving the local rung or a launch-named address skips it.

## Check the build

Check the hosted address was built from the head before driving it:

```bash
canon pr preview <number> --check --json
```

Branch on the record's `reason`. Only `fresh` continues, and this pass never mints.

| `reason`                            | Act                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `fresh`                             | Drive the hosted address                                                                      |
| `stale`, `no-build`                 | Stop, posting nothing. Name `built` and `tip`, and ask for `canon pr preview <number> --json` |
| `building`                          | Stop the same way and ask the dispatcher to wait, since a mint is running for the tip         |
| `no-deploy`, `unfenced`, `no-alias` | Stop on the hosted address, saying no fenced deploy exists to verify it against               |
| `unserved`                          | The deploy builds from nothing this pull request changed, so fall to the local rung           |

## An older binary

A `canon` that rejects `--check` predates the verb. Report that this pass needs a `canon` whose `pr preview` takes it, naming the installed `canon --version`, and stop rather than reading the missing flag as `fresh`.
