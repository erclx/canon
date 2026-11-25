---
title: The standing wait
description: How a worker keeps its branch current once both review families cover the tip, waiting on the base through canon pr review-state and rebasing through review-address when main moves under it
---

Once both review families cover the tip, nothing wakes the worker until the merge, yet a sibling merging under the branch leaves its green run testing a `main` that no longer exists. The worker holds one more wait, on the base rather than the reviews, so the rebase starts on its own side and no controller message is needed.

## Enter the wait

Run it in the background with the pull request number, and act on the wake.

```bash
canon pr review-state <number> --wait-standing 1200 --json
```

- Enter it when a `--wait` record reads `covered` and neither family reads open at the tip, so a review still owing a fix is answered first
- Enter it again after every push this session makes while the pull request is open, since the push moves the head the standing is read at
- Never run it beside a `--wait` on the same pull request, since the verb refuses the two together and one wake should carry one ending

## Route on the ending

Branch on the record's `reason` rather than on the exit, which a shell function wrapping `canon` can flatten to zero.

| `reason`    | Route                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| `stale`     | Invoke `canon:review-address`, whose staleness step rebases the branch, reading the `moved` paths first |
| `conflict`  | Invoke `canon:review-address` the same way, which rebases and resolves or halts on the hunk             |
| `closed`    | Stop. The role ends at the merge, and a closed pull request owes nothing                                |
| `timeout`   | Enter the wait again, sending nothing, since a fresh base is the state the wait holds on                |
| Any refusal | Send the controller the `reason` per the channel and stop, since an unread base is not a fresh one      |

Rebase on `stale` even where that step's own test prints nothing. The verb's `moved` can name a file the branch depends on without writing, which the test does not read, and the wait ends `stale` again until the branch updates.

## After the rebase

- A rebase that leaves the branch diff equal per path carries both closes, so `review-address` asks for no re-review, and the next standing wait reads `fresh`
- A rebase that changed what the branch writes asks for the re-review the channel states, and the standing wait starts again only once that `--wait` reads `covered`
- Drop a controller handback that lands after this wake's `review-address` run once the branch reads fresh. A pull request carrying review comments skips the guard that stops a fresh branch.
