# Contributing

canon is a portfolio project. Issues are welcome. Pull requests are accepted by invitation only.

What follows is the local loop for an invited contributor, and for anyone running the CLI from a clone.

## Setup

Bun runs the CLI and every script. The shell scripts need `zsh` or bash 4 or newer, so macOS needs `brew install bash` first. The [readme](README.md#development) covers the clone, install, and bootstrap path.

`bun run bootstrap` writes one file outside the repository. It appends a block of Claude Code shell aliases to `~/.zshrc`, wrapped in `# >>> canon aliases >>>` and `# <<< canon aliases <<<` markers.

The markers are how a re-run recognizes its own block and skips, so the script never appends a second copy, and deleting the block between them removes the aliases. Skip that step by running `bun install` and `bun link` yourself instead. The [zshrc aliases](docs/workflow/zshrc-aliases.md) doc lists what the block defines.

## Verifying a change

`bun run check` is the gate. It auto-formats, regenerates the generated files, and runs the stages the changed files call for. Use `bun run format` when a change needs formatting alone.

The `pre-push` hook runs `bun run check`, and that run can rewrite files. Check `git status` after a push and commit any diff as `style(<scope>):`.

The [development notes](canon/context/development/index.md) carry the full script table, what each stage gates on, and the rest of the hooks.

## Where to author

Standards author at `standards/` in the repository root. They do not install into a target project. A session reads a standard with `canon standards <name>`.

Neither carries a consumed copy under `.claude/`, so the file at its authoring root is the only one to edit and the only one to cite from a file staying in this repository.

Governance rules split the same way, though through a different mechanism. Author under `governance/rules/`, which `canon gov install` writes into a target project's `.claude/rules/`.

## Commits

Conventional commits are enforced. The `commit-msg` hook runs commitlint against `@commitlint/config-conventional`, so a message that does not parse is rejected before it lands.

## Agents

The repository is agent-first. Every command has a non-interactive path and a JSON catalog, and each domain carries a skill an agent loads before editing that domain. `CLAUDE.md` is the entry point for that layer. A pull request meets the same hooks and checks whether a person or an agent wrote it.
