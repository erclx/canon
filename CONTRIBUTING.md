# Contributing

canon is a portfolio project. Issues are welcome. Pull requests are accepted by invitation only.

What follows is the local loop for an invited contributor, and for anyone running the CLI from a clone.

## Setup

Bun runs the CLI and every script. The [readme](README.md#development) covers the clone, install, and bootstrap path.

### The bootstrap step

`bun run bootstrap` writes one file outside the repository. It appends a block of Claude Code shell aliases to `~/.zshrc`, wrapped in `# >>> canon aliases >>>` and `# <<< canon aliases <<<` markers.

- A re-run recognizes its own block by the markers and skips, so the script never appends a second copy.
- Deleting the block between the markers removes the aliases.
- To skip the step, run `bun install` and `bun link` yourself instead.
- The [zshrc aliases](docs/workflow/zshrc-aliases.md) doc lists what the block defines.

## Verifying a change

`bun run check` is the gate. It fails on formatting drift, regenerates the generated files, and runs the stages the changed files call for. Run `bun run format` to fix the drift it reports.

The `pre-push` hook runs `bun run check`, so a push fails on formatting drift until `bun run format` runs and the result is committed. The [development notes](canon/context/development/local-loop.md) carry the full script table, what each stage gates on, and the rest of the hooks.

## Where to author

Author a skill's reference under `claude/skills/*/references/`, where it ships inside the plugin, and toolkit-only content under `internal/`. Neither installs into a target project as a copy.

- Neither carries a consumed copy under `.claude/`, so the file at its authoring root is the only one to edit and the only one to cite from a file staying in this repository.
- Governance rules split the same way, though through a different mechanism. Author under `governance/rules/`, which `canon gov install` writes into a target project's `.claude/rules/`.

## Commits

Conventional commits are enforced. The `commit-msg` hook runs commitlint against `@commitlint/config-conventional`, so a message that does not parse is rejected before it lands.

## Agents

The repository is agent-first. Every command has a non-interactive path and a JSON catalog, and each domain carries a skill an agent loads before editing that domain.

`CLAUDE.md` is the entry point for that layer. A pull request meets the same hooks and checks whether a person or an agent wrote it.
