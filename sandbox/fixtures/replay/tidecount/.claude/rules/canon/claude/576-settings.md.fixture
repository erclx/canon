---
description: State the autoContinueAtUsageLimit inversion and the autoCompactWindow cap for .claude/settings.json and its seeded copy
paths:
  - '.claude/settings.json'
  - 'tooling/claude/seeds/.claude/settings.json'
---

# Settings standards

## Session budget settings

- Never set `autoContinueAtUsageLimit` in this file. Its scope is user or managed, and a repository file setting it while no user, `--settings`, or managed value does makes Claude Code read the setting as off, so writing `true` here turns the behavior off for every operator carrying no value of their own.
- Treat `autoCompactWindow` as capped at the model's own context window. A value above that cap is inert on a session running a smaller window and bites only on one running the larger, so name the window a recorded value is meant for.
- Record why a session budget setting is left unset in the project's own development notes rather than in this file. JSON carries no pointer, so a session reading the settings file alone concludes the setting is unconfigured and sets it again.
