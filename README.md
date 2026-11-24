<div align="center">

<picture>
 <source media="(prefers-color-scheme: dark)" srcset="assets/brand/mark-color.svg">
 <img src="assets/brand/mark-color-light.svg" alt="canon" width="56" height="56">
</picture>

# canon

A Claude Code plugin and CLI that runs your agent's work from plan to merge, holds it to cited engineering practice, and sets up every repo the same way.

[![npm version](https://img.shields.io/npm/v/@erclx/canon)](https://www.npmjs.com/package/@erclx/canon)
[![CI status](https://img.shields.io/github/actions/workflow/status/erclx/canon/verify.yml?branch=main)](https://github.com/erclx/canon/actions/workflows/verify.yml)
[![License MIT](https://img.shields.io/npm/l/@erclx/canon)](LICENSE)

<picture>
 <source media="(prefers-color-scheme: dark)" srcset="assets/loops/readme.gif">
 <img src="assets/loops/readme-light.gif" alt="Claude Code's agent view in canon: sessions complete, take answers, and arrive, then a slash opens canon's skill menu" width="960">
</picture>

</div>

## Install, then set up a project

Three commands get you the plugin and the CLI. You need Bun, and Linux or macOS.

```bash
claude plugin marketplace add https://github.com/erclx/canon
claude plugin install canon@canon
bun install --global @erclx/canon
```

Then open a project in Claude Code and run `/canon:target-setup`, which brings it onto canon. The project starts with its stack's own tool, such as `bun init` or `npm create vite`, or with `/canon:target-scaffold` in an empty folder, and canon layers on top.

1. `/canon:target-setup` detects the stack, shows the whole chain, and writes nothing until you say yes. Then it runs `canon init`, checks what landed, and indexes the docs.
2. `/canon:target-check` reports, domain by domain, what the project holds against what canon now ships, and repairs nothing.
3. `/canon:target-update` upgrades the CLI and plugin after a release, previews the changelog and any migrations, and catches the project up on your go-ahead.

Three kinds of file land in your repo:

- Skills load live from the plugin, so there is no copy to drift
- Rules are files under `.claude/rules/` that load when you edit a matching path
- Configs and seeds are real files you own, laid down by `canon init` and kept current by `canon sync`

## Five roles, each in its own session

Give each step of a change its own session and a written record the next one reads. canon splits a change across a planner, a worker, and two reviewers, and you talk to the orchestrator that starts them.

- The orchestrator dispatches the rows on the task board
- A planner reads the code and writes one plan you approve
- A worker builds the plan and opens the pull request
- A code reviewer reads the diff from a fresh session
- A UI reviewer drives the visual checklist in the running app

## Every session leaves a structured record

Each plan, review, and handoff is a markdown file written to the same standard every time. Records live under `.canon/` in the main checkout.

- Before a build: intake, groundwork, the plan, its task, and the board
- Around a pull request: the code review, the UI review, and the screenshot evidence
- Across sessions: the drive log, the context entries, and the handoff a compaction would lose

## Skills that cite their sources

Each one teaches your agent an engineering practice, and every rule in it links to the guide it came from. Each skill loads when its kind of work starts.

| Skill                  | Loads                           | Cites                                     |
| ---------------------- | ------------------------------- | ----------------------------------------- |
| `code-craft`           | Before a new function or module | Google, What to look for in a code review |
| `test-craft`           | Before writing a test           | Ham Vocke, The Practical Test Pyramid     |
| `api-design`           | Before shaping a flag or output | Software Engineering at Google            |
| `ui-craft`             | When a rendered file changes    | W3C, Using ARIA                           |
| `systematic-debugging` | On a bug nobody has explained   | Jesse Vincent, superpowers                |

Each rule has its own source row in a ledger, and the skill audit fails when a skill's rules and its rows disagree in count.

## Rules your agent cannot ignore

Each one is backed by a check that stops the work when it's broken.

- Rules by path load when the agent opens a matching file, and each names the skill that owns that kind of file
- Hooks read each action before or after it runs, refusing some and reporting others back into the same turn
- The gate runs every stage before a pull request opens, and a stage that cannot read its input fails rather than passing
- A deny rule keeps the agent from merging, since a hook fails open on a timeout and a permission rule does not

## Every feature gets its own worktree

So several agents can build at once without touching each other's files. Each worker builds in its own worktree on its own branch, and every session reads and writes the one `.canon/` record in the main checkout, so no worktree keeps a copy of its own.

## See the interface evidence before you merge

Every pull request comes with a short film of the new screen working in the app.

- canon films the change in the running app and posts the reel beside the checklist a reviewer ticks
- canon drives the running app beside you and puts the options on a board for you to pick

## Come back to finished pull requests

Queue features on the task board before you leave. Canon builds and reviews them, and holds each merge for you. The orchestrator works the ready rows from now or from a set time, and stops at what only you decide.

## Audits for code an agent wrote

They list the files and functions past a line limit, so you know what to split before it gets worse. canon measures file, function, and comment length, and charts what shipped each week.

## For your agent

<!-- canon-readme-only: the landing page addresses the person, and the agent's surface lives in the docs it links -->

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
