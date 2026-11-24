# Feature: Surge alerts

Push a surge advisory to everyone who saved the station, with the app closed, and drop the push when the advisory lifts first. The groundwork track settled push over email on a 71 second worst case against a 38 minute floor, and the beta closes in three weeks.

Approved: operator, 2026-03-11, in planner-a

## Summary

- A saved station's followers hear about a surge advisory with the app closed
- A service worker shows the notification, and a send queue sets each push to expire at the advisory's effective time
- Trade-off: push alone, no email, since the people email reaches read it away from the shore

## Weight

- **Weight:** medium
- **Reason:** new logic in one module, the send queue, and a narrow contract change to the advisory feed record with both consumers named

## Current behavior

- `bun run feed:sample --station cascais`: one advisory record with `issued` and `effective` and no `lifted` field, so a lift reads as a missing record
- `bun test src/alerts`: 14 passing, none of them on a closed app, since no code path runs there

## Constraints

Measured against `a41c0e9` on 2026-03-11.

- Shared path: `feat/zone-labels` writes `src/tides/format.ts`, which the notification body reads, and this branch rebases if it merges second
- Hold: the advisory banner row waits on `src/alerts/feed.ts`, a contract this branch changes, so the banner may not conform to the new record until this merges
- Durable: ask for notification permission on a user action, never on first launch, per the groundwork decision

## Files to touch

### The send path

The files below carry an advisory from the feed to a queued push.

- `src/alerts/feed.ts`: add `lifted` to the advisory record, so a lift arrives as a field rather than a gap
- `src/alerts/queue.ts`: new, queue one push per follower and set its time to live at the advisory's `effective` time
- `src/alerts/queue.test.ts`: new, a lifted advisory sends nothing and an expired push is never retried

### The device side

The files below show the push and ask for it.

- `public/sw.js`: new, show a notification for a surge push and open the station on a tap
- `src/stations/save-button.tsx`: ask for notification permission on the first save, and save the station whatever the answer
- `src/stations/save-button.test.tsx`: a declined prompt still saves, and a second save asks nothing

## Design references

- `canon/design/station-page/`: built against, the save button keeps its shape and position, and only its first press changes

## Verification

- A lifted advisory sends nothing: `bun test src/alerts/queue.test.ts`
- A declined prompt still saves the station: `bun test src/stations/save-button.test.tsx`
- A push reaches a phone with the app closed: visual, on a real phone against the Cascais station during a live advisory

## Risks

### The advisory record has two readers

`src/alerts/feed.ts` is read by the banner and written by this branch's queue, so adding `lifted` changes what the banner sees. The banner ignores unknown fields today, and the held banner row picks the field up after this merges.

### A permission prompt nobody answers

A prompt dismissed without an answer leaves the permission at `default`, so the next save asks again. The save button reads the state before asking and asks once per session.

## Review focus

- An advisory lifted between enqueue and send: the queue must drop it rather than send a stale push
- A follower who declined notifications: the queue must skip them without failing the batch
- A tap on a notification for a station since unsaved: the app must open the station page and not an empty state

## Questions

1. Where does the permission prompt appear?
   - Suggested: on the first save, since a prompt with no action behind it is the one most people decline
   - Answer:
2. Does a push carry the surge height?
   - Suggested: yes, the height and the effective time, since the height is what someone acts on
   - Answer:

## Sources

- [RFC 8030](https://www.rfc-editor.org/rfc/rfc8030), backing the expiry on each push, "Once the TTL period elapses, the push service MUST NOT attempt to deliver the push message to the user agent."
