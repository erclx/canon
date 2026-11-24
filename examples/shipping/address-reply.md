## Review response

Fixed the lifted-advisory send and the second prompt, and declined the double tap with the fact that settled it.

- **should-fix**, `src/alerts/queue.ts` line 41: fixed in `4c81d0e`. `send()` reads `lifted` again and drops the push.
- **minor**, `src/stations/save-button.tsx` line 22: declined. The browser resolves a second `requestPermission()` call to the pending prompt, measured on Chromium and Safari.
- **UI box 3**, `src/stations/save-button.tsx` line 31: fixed in `4c81d0e`. A dismissed prompt is remembered for the session, so the next save asks nothing.

🤖 Addressed by Claude Code

## Post-review findings

- **minor**, `src/alerts/queue.ts` line 58: filed a follow-up row for batching pushes per station, since a 40-follower station sends 40 requests in one second.

🤖 Addressed by Claude Code
