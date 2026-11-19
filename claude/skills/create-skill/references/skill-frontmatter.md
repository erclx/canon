---
title: Skill frontmatter reference
description: The frontmatter fields a skill carries, their limits, and which keys a claude.ai upload accepts
---

# Skill frontmatter reference

Checked against the [Claude Code skills](https://code.claude.com/docs/en/skills) and [skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) pages on `2026-11-19`.

## Fields

- **`name`** (required): kebab-case, matches folder name, no spaces or capitals, and at most 64 characters
- **Reserved words**: an upload to claude.ai or the API rejects `anthropic` and `claude` in a name.
- **Reserved in Claude Code**: outside a plugin, a skill folder named `synced` in any capitalization is skipped.
- **Reserved namespace**: outside a plugin, a skill folder or command file named `anthropic-skills` or starting with `anthropic-skills:` does not load.
- **`description`** (required): what it does + when to use it, under 1024 chars, no XML tags. That is the portable maximum.
- **Listing cap**: Claude Code truncates `description` plus `when_to_use` at 1,536 characters in its skill listing, so put the key use case first.
- **Listing budget**: past the whole listing's character budget, Claude Code drops descriptions starting with the least-invoked skills, so a new skill loses its description first.
- **Budget size**: the budget scales at 1% of the model's context window. `skillListingBudgetFraction` raises it, and `skillListingMaxDescChars` sets the per-entry cap.
- **Freeing budget**: `"name-only"` in `skillOverrides` lists a low-priority skill without its description, leaving room for the rest.
- **Past the budget**: no wording brings a dropped description back. Short of a setting, route a case that has to fire from its first use through a hook or a rule.
- **`disable-model-invocation: true`**: Claude will not auto-trigger, and the `Skill` tool also refuses the operator's request made in words. Set it only on a skill run by slash command alone.
- **Invocation side effects**: the same flag keeps the skill from being preloaded into a subagent and from running when a session-scoped scheduled task fires with it as the prompt.
- **`allowed-tools`**: tools Claude can use without asking permission during the turn that invokes the skill, cleared at the next message. It grants and never limits the tool set.
- **`metadata`**: optional key-value pairs (`author`, `version`, `mcp-server`). Claude Code drops a value that is not a map, and a key must not reuse a frontmatter field name such as `paths`.
- **`metadata.family`** (required under `claude/skills/`): the skill map group, as one key from `families` in `canon claude skills list --json`. A skill under `.claude/skills/` takes none.

Outside Claude Code, only `name`, `description`, `license`, `compatibility`, `metadata`, and `allowed-tools` pass an upload, and any other key is a hard error. Keys nested under `metadata` pass, which is why `family` nests there.

### Optional fields

Claude Code documents more optional fields. The skills page holds the detail, so this table keeps one line each.

| Field                      | Effect                                    |
| -------------------------- | ----------------------------------------- |
| `when_to_use`              | Trigger phrases appended to `description` |
| `argument-hint`            | Autocomplete hint for arguments           |
| `arguments`                | Named positional arguments                |
| `user-invocable`           | `false` leaves it to Claude alone         |
| `disallowed-tools`         | Tools removed while it is active          |
| `model`, `effort`          | Override both for the turn                |
| `context`                  | `fork` runs it in a subagent              |
| `agent`                    | Subagent type for `context: fork`         |
| `background`               | Whether a fork runs in the background     |
| `hooks`                    | Hooks registered for the session          |
| `paths`                    | Globs limiting automatic loading          |
| `shell`                    | `bash` or `powershell`                    |
| `license`, `compatibility` | Accepted, never acted on                  |

A skill wanting only the no-auto-trigger effect writes `Do NOT auto-trigger` in its description rather than setting `disable-model-invocation`.
