---
title: Outside tools
description: The two tools canon's media skills reach but do not own, which skill uses each, how to install both through the canon-media bundle, and what keeps them current
category: Agent surface
---

# Outside tools

Two canon skills hand work to a tool canon does not ship. Plain `canon` installs neither, so a machine that never films the app or picks a design never pulls them in.

| Tool        | Used by       | What it does there                                         |
| ----------- | ------------- | ---------------------------------------------------------- |
| HyperFrames | `ui-film`     | Composes, captions, and renders the takes `ui-film` films  |
| Frameboard  | `design-pick` | Serves the board the design arms are drawn on and selected |

A skill checks that its tool is present and names the install when it is missing. It never installs or updates a tool itself. `ui-film` films the takes either way and stops at the handoff when HyperFrames is absent.

## Install both

The `canon-media` plugin carries no skills of its own. It depends on `canon`, `hyperframes`, and `frameboard`, so installing it installs all three. Add the three marketplaces first, since Claude Code resolves a dependency only from a marketplace you have added:

```bash
claude plugin marketplace add https://github.com/erclx/canon
claude plugin marketplace add heygen-com/hyperframes
claude plugin marketplace add erclx/frameboard
claude plugin install canon-media@canon
```

Inside a session, `/plugin install canon-media@canon` does the same once the marketplaces are added. Restart Claude Code, or run `/reload-plugins`, to load the skills.

To take one tool alone, install `hyperframes@hyperframes` or `frameboard@frameboard` from its own marketplace instead of the bundle.

## Keep them current

Neither tool is pinned. Claude Code's plugin manager owns each plugin's updates, and ships auto-update off for a third-party marketplace, so turn it on once per marketplace under `/plugin` in the Marketplaces tab. Updating by hand runs the same two steps per plugin that [target sync](sync.md) gives for canon.

- HyperFrames runs its CLI through the plugin's own launcher at the plugin's version, so updating the plugin moves the CLI with it
- `design-pick` uses a `frameboard` binary on your PATH when one is there, and otherwise runs `bunx -y frameboard` at the latest published release
- A standalone copy of the HyperFrames skills under `~/.claude/skills/` updates apart from the plugin and can lag its layout, so remove it once the plugin is installed
