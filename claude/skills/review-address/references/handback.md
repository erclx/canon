---
title: Hand-back addressees
description: Which reviewers a re-review request goes to after the review-address push, derived from canon pr review-state at the new head rather than from memory
---

# Hand-back addressees

Read from Step 6 of `review-address`, and from `role-worker`'s re-review bullets, once the reply posts after the push. A worker that picked its addressees from memory skipped the UI reviewer and left a UI pass behind the head with nobody driving it.

## Read the families at the new head

Read both families at the tip the push left, with no wait, since the request goes out now and the wait comes after it:

```bash
canon pr review-state <number> --json
```

Branch on each family's fields rather than on the exit, which a shell function wrapping `canon` can flatten to zero.

| Reading                                      | Addressee                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `review.isCovered` false                     | The code reviewer, since the open pass or the close sits behind the new head                             |
| `ui.isCovered` false                         | The UI reviewer, since a bound checklist owes a re-drive at the new head                                 |
| A family reading `isCovered` true            | Nobody for that family. A close carried across the push, or `ui.isBound` false leaves nothing to drive.  |
| Both families covered                        | Nobody. Say so in the turn, since a push both closes carried owes no pass.                               |
| A refusal, such as `gh-failed`, or no record | Every reviewer the launch or a dispatch named, UI reviewer included, saying the review state went unread |

A family the record shows is owed but whose reviewer is unnamed, or whose sessionId resolves to no live session, goes to the controller instead, naming the family and the new head.

## What each request carries

Each request carries what was addressed, the new head, and CI marked running, since the CI watch runs beside the review. Resolve each addressee from its sessionId at sending through `canon:session-relay`, never by name prefix.

- Send the UI reviewer the new head and the boxes the fixes touched, since it reads no diff and never hears the code verdict
- Read the record again before a second request after a later CI fix, since a push can uncover a family the first read found covered
