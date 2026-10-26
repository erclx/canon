---
description: Run a command that may take more than about a minute in the background and resume on the harness wake, so the operator keeps the conversation
---

# Background standards

## Slow commands

- Start a command that may run past about a minute with `run_in_background: true`, since a foreground run holds the conversation. Revisit when a foreground Bash call stops blocking the turn.
- Treat a full check, a sandbox run, a capture or render, a build, and a wait on another session as slow.
- Keep a command expected to finish in seconds in the foreground, since each wake costs a turn.
- End the turn on one line naming what runs, when the next step needs that command's result.
- Keep working beside a server or a watch the session never waits on, since it never exits and its wake never comes.

## Waking

- Act on the wake the harness sends when an awaited command exits, never on a guess about when it is done. Revisit when a background Bash command stops waking the session at exit.
- Never wait with a foreground `sleep`, a foreground poll loop, or a scheduled prompt for one wait. The background run and its wake replace all three.
- Keep a skill's own wait as the skill states it, since the skill owns the verb and the timeout it waits on.
