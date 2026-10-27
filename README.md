<div align="center">

<picture>
 <source media="(prefers-color-scheme: dark)" srcset="assets/brand/mark-color.svg">
 <img src="assets/brand/mark-color-light.svg" alt="canon" width="56" height="56">
</picture>

# canon

A CLI and Claude Code plugin that runs your agent's work from plan to merge, holds it to established engineering practice, and installs the same setup in every repo.

[![npm version](https://img.shields.io/npm/v/@erclx/canon)](https://www.npmjs.com/package/@erclx/canon)
[![CI status](https://img.shields.io/github/actions/workflow/status/erclx/canon/verify.yml?branch=main)](https://github.com/erclx/canon/actions/workflows/verify.yml)
[![License MIT](https://img.shields.io/npm/l/@erclx/canon)](LICENSE)

<picture>
 <source media="(prefers-color-scheme: dark)" srcset="assets/loops/launch.gif">
 <img src="assets/loops/launch-light.gif" alt="One change running through canon, from the groundwork that measured it through its plan, dispatch, build, and review to the merge" width="960">
</picture>

</div>

## Quick start

```bash
claude plugin marketplace add https://github.com/erclx/canon
claude plugin install canon@canon
bun install --global @erclx/canon
```

The skills land as `/canon:<name>`, and the CLI needs Bun on your path. canon runs on Linux and macOS.

Set up a repository with `canon init`, which lays down its rules, seeds, and configs.

## How a change runs

| 1. Plan                                                  | 2. Build                                                | 3. Review                                                   | 4. Merge                      |
| -------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------- |
| A planner reads the code and writes one plan you approve | A worker builds it on its own branch, held to the rules | A fresh session reviews the pull request and posts findings | You read the review and merge |

Each session works in its own worktree, so several changes run at once.

## What lands in your repo

| Part              | How it reaches you                                                             |
| ----------------- | ------------------------------------------------------------------------------ |
| Skills            | Loaded live from the plugin, so there is no copy to drift                      |
| Rules             | Files under `.claude/rules/` that load when you edit a matching path           |
| Configs and seeds | Real files you own, laid down by `canon init` and kept current by `canon sync` |

## For your agent

- Every command runs without a prompt, and data on stdout pipes clean
- `canon <command> --help` prints each command's flags, exit codes, and examples
- Rules load by path, so the agent gets the rule for the file it is editing

## Docs

- [AI workflow](docs/workflow/ai-workflow.md): the loop a feature runs
- [Operating model](docs/workflow/operating-model.md): planners, workers, and reviewers in parallel
- [Skill map](docs/workflow/skill-map.md): every skill by the moment you reach for it
- [Agents](docs/agents/index.md): flags, exit codes, and output shapes
- [Docs index](docs/index.md): every reference doc, updating canon among them

## Contributing

Issues are welcome. Pull requests are by invitation, so read the [contributing guide](CONTRIBUTING.md) before you open one. Released under the [MIT license](LICENSE).
