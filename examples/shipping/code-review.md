## Review

0 critical, 1 should-fix, 1 minor. Reviewed against project docs and the board.

**`src/alerts/queue.ts`**

- **should-fix** ([line 41](https://github.com/example-org/tidewell/blob/9d47e2a1c6f03b85e7a4d2c91f60b38e5a7c4d10/src/alerts/queue.ts#L41)): an advisory lifted after enqueue still sends, since the lift check runs only at enqueue.
  - The plan's review focus names this case, and `src/alerts/queue.test.ts` covers a lift before enqueue alone
  - Fix: read the advisory's `lifted` field again in `send()` and drop the push when it is set

**`src/stations/save-button.tsx`**

- **minor** ([lines 22-27](https://github.com/example-org/tidewell/blob/9d47e2a1c6f03b85e7a4d2c91f60b38e5a7c4d10/src/stations/save-button.tsx#L22-L27)): a double tap on Save calls `requestPermission()` twice before the first prompt resolves.
  - Fix: hold the pending request and return it to the second tap

<details>
<summary>Review focus, 3 checked</summary>

- A follower who declined notifications: `queue.test.ts` skips them and the batch still sends
- A tap on a notification for an unsaved station: `public/sw.js` opens `/stations/<id>` whatever the saved state
- An advisory lifted between enqueue and send: fails, raised above as the should-fix

</details>

🤖 Reviewed by Claude Code

<!-- review-pr: commit=9d47e2a1c6f03b85e7a4d2c91f60b38e5a7c4d10 read-at=2026-03-14T10:22:05Z -->

## Review closed

✅ 1 prior finding addressed at `4c81d0e`. Re-reviewed the 1 commit since the prior pass.

- **should-fix**, `src/alerts/queue.ts`: `send()` drops a push whose advisory was lifted after enqueue, and a test covers the case
- **minor**, `src/stations/save-button.tsx`: withdrawn, the browser resolves a second `requestPermission()` call to the pending prompt, so no second prompt opens

🤖 Reviewed by Claude Code

<!-- review-pr: commit=4c81d0e7b2a95f3e6d18c4a0b7e29f5d31c86a47 read-at=2026-03-14T13:48:51Z -->
