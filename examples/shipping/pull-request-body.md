## Summary

Push a surge advisory to every follower of a saved station so a closed app still hears about a surge before it takes effect. An advisory used to reach only an open tab, and nine of fourteen beta testers keep the app closed.

Closes #198

## Key changes

**Send path**

- Add `lifted` to the advisory record in `src/alerts/feed.ts`, so a lift arrives as a field.
- Add `src/alerts/queue.ts`, which queues one push per follower with a time to live at the advisory's effective time.
- Cover the lifted and expired cases in `src/alerts/queue.test.ts`.

**Device side**

- Add `public/sw.js` to show a surge notification and open the station on a tap.
- Ask for notification permission on the first save in `src/stations/save-button.tsx`, saving the station whatever the answer.
- Cover the declined and repeated prompts in `src/stations/save-button.test.tsx`.

## Technical context

- The time to live does the expiry, so a lifted advisory needs no recall message and the queue keeps no delivery state.
- The prompt waits for the first save, since a prompt with no action behind it is the one most people decline.

## Testing

- [x] `bun test src/alerts/queue.test.ts` passes, 6 tests.
- [x] `bun test src/stations/save-button.test.tsx` passes, 4 tests.
- [ ] A push reaches a real phone during a live advisory, left to the operator, since it needs a live advisory on the feed.

## For the reviewer

- Confirm the save button keeps its shape and position on the station page in both themes, against the evidence comment.
- Confirm a tap on a notification for an unsaved station opens the station page.
