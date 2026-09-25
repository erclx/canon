---
name: bash-script
description: Generates production Bash scripts with a visual timeline UI, state-based interactive prompts, and strict error handling. Use when asked for "a human-facing shell tool", an interactive bash script, or a DevOps tool with framed terminal output. Do NOT use for a non-interactive automation, CI, or pipeline script, that is `bash-cli-script`.
---

# Bash script

Generate production-ready Bash scripts for DevOps and CLI workflows. Enforce strict formatting with a visual timeline UI and state-based interactivity.

Load `${CLAUDE_SKILL_DIR}/references/patterns.md` for the timeline lifecycle, logging, help-screen, and full-script code templates, and `${CLAUDE_SKILL_DIR}/references/prompts.md` for the `ask()` and `select_option()` templates when the script prompts. `${CLAUDE_SKILL_DIR}` expands to this skill's own directory, so the path resolves from any project. Copy those definitions verbatim, keeping only the colors and functions the script actually uses.

## Guards

- A request for a script with no human at the terminal stops and routes to `bash-cli-script`. CI jobs, cron entries, agent-run tasks, and any script whose output is consumed by a pipe render no timeline, so generating one costs the frame and returns nothing.

## Script setup

- Start with `#!/usr/bin/env bash`, `set -e`, and `set -o pipefail`.
- Bash 4+ features (namerefs, associative arrays) are allowed.
- Implement a visual help screen via `show_help` if the script accepts arguments.
- Do not rely on unset variables. Use `${VAR:-default}`.

## Visual timeline

- Maintain a vertical timeline (`│`) from `┌` to `└` throughout all output.
- Write all frame output (`┌`, `│`, `├`, `└`, log lines, prompts) to stderr via `>&2`. Write data (JSON, lists, piped values) to stdout. `--help` is the exception and prints to stdout.
- Open the timeline once at the start of `main()` via `open_timeline "Title"`, before any logic, prompts, or checks.
- Close the timeline via `trap close_timeline EXIT`, registered immediately after `open_timeline`.
- On success, disable with `trap - EXIT`, then print `└\n` and the success message manually.
- On cancellation and error, never print `└` manually. The trap owns those exits.
- Use state transitions for interactive prompts: `◆` active, `◇` inactive.
- Do not add diamonds (`◆` or `◇`) to non-interactive log functions.
- On cancellation, show `◇ ... Cancelled`, exit 1, and make no `log_error` call. Both `ask()` and `select_option()` handle escape cancellation identically.
- Guard interactive prompts against non-TTY stdin with `[ -t 0 ]` and render a framed `log_error` when a TTY is required but absent. Never let `read` block silently on piped input.

## Code style

- Decompose by responsibility: each function does one thing, `main()` orchestrates only.
- Name functions verb-first: `validate_input`, `deploy_service`, `install_dependencies`.
- Do not use global variables except exports from `ask()`.
- Do not define unused color variables.
- Comment only a fact the reader cannot recover from the code, and follow the code-comment rule in `.claude/rules/` when the project installs it.
- Use sentence case for section headers and log messages. Proper nouns and product names retain their casing.
- Quote variables inside parameter expansions: `"${file#"$dir"/}"` not `"${file#$dir/}"`.
- Quote variables in test brackets: `[ "$i" -eq "$cur" ]` not `[ $i -eq $cur ]`.
- Guard commands that return non-zero on valid empty results: `grep ... || true`, `diff ... || true`.

## Output hygiene

- Show external tool output by default (git, npm, gh).
- Include context in error messages: `log_error "npm install failed: check package.json"`.
- Do not echo command names before running them. Output speaks for itself.
- Do not log "Starting..." and "Finished..." around every action.
- Do not log intermediate variable assignments.
- Use `log_add` for item writes (files created, entries added, keys written).
- Use `log_info` for status confirmations only ("up to date", "check passed").
- Use `log_warn` for drift, skipped states, or recoverable issues.
- Never use `log_info` for file or entry writes.

## Icon usage

Interactive prompts only:

- `◆` (green): active user input required
- `◇` (grey): completed input, transition via `\r\033[K` to rewrite the `◆` line in place
- `❯` (green): selected option in a menu
- plain text (grey): unselected option in a menu

Non-interactive logs:

- `├` section branch (`log_step`)
- `✓` (green): success (`log_info`)
- `!` (yellow): warning (`log_warn`)
- `✗` (red): error (`log_error`)
- `+` (green): add item (`log_add`)
- `-` (red): remove item (`log_rem`)

## Validation

Before responding, verify:

- File starts with `#!/usr/bin/env bash`, `set -e`, `set -o pipefail` and uses exactly 2 spaces for indentation.
- Timeline opens via `open_timeline "Title"`, which writes `┌` and `│ Title` to stderr.
- Timeline closes via `trap close_timeline EXIT` registered immediately after `open_timeline`. Success paths use `trap - EXIT` then manual `└\n` (to stderr) then the success message. Cancellation and error paths never print `└` manually.
- `open_timeline` and `close_timeline` are defined and write to stderr via `>&2`.
- All frame output (`│`, `├`, `└`, log lines, interactive prompts) writes to stderr via `>&2`. Stdout carries data only. `--help` is the exception.
- Interactive prompts (`ask`, `select_option`) guard with `[ -t 0 ]` and call `log_error` if stdin is not a TTY.
- The timeline (`│`) appears in all log functions, and interactive prompts use `◆` → `◇` transitions.
- `ask()` uses `\r\033[K` to rewrite the `◆` line in place, with no `\033[1A` cursor-up sequences.
- `ask()` drains trailing escape bytes with `read -rsn2 -t 0.001 _ || true` before cancelling.
- All log messages use sentence case (proper nouns and product names exempt).
- Only defined color variables are used in the script.
- Cancellation shows a single `◇ ... Cancelled` line without a subsequent `log_error`.
- Escape key in `ask()` triggers `◇ ... Cancelled` and exits, consistent with `select_option()`.
- Functions follow single responsibility: each does one thing, `main()` delegates to helpers.
- Logging is concise: no "Starting.../Finished..." bloat, no intermediate variable logging.
- `log_add` is used for all file, entry, and key writes.
- `log_info` is used for status confirmations only, not writes.
- Every section header uses `log_step`, including the first one after the title block.
- File ends with exactly one empty line.
