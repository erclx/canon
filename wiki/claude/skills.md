---
title: Claude Code skills
description: Skills, plugins, invocation, and installation
---

# Claude Code skills

A skill is a reusable instruction set that extends Claude's behavior, defined in a `SKILL.md` file with YAML frontmatter and markdown content. Unlike built-in commands which execute fixed logic, skills let Claude orchestrate work with its tools: reading files, running commands, and adapting to context. A skill you define in `.claude/skills/` becomes a `/command` invoked the same way as any built-in, and [Claude Code commands](commands.md) lists the full set that ships built-in. Source: Anthropic, in the [Claude Code docs](https://code.claude.com/docs).

## Invocation

Invoke a skill manually with `/skill-name`. Plugin skills are namespaced: `/plugin-name:skill-name`. Skills can be user-invoked, auto-triggered, or both.

Auto-triggering is the default. Claude loads a skill when it matches the current request. Set `disable-model-invocation: true` in frontmatter to prevent this. The skill then only runs when you invoke it explicitly.

Skill descriptions load into context at session start so Claude knows what is available. Full skill content loads only when the skill is invoked.

The combined `description` plus `when_to_use` text is capped at 1,536 characters per skill in the listing. Front-load the key use case so it survives truncation. The total budget across all skills scales to about 1% of the context window. Override with the `SLASH_COMMAND_TOOL_CHAR_BUDGET` environment variable.

## Installation locations

Skills are discovered from multiple locations. Higher priority wins when names conflict:

- Enterprise (managed settings): all users in the organization
- Personal (`~/.claude/skills/<skill-name>/SKILL.md`): all your projects
- Project (`.claude/skills/<skill-name>/SKILL.md`): this project only
- Plugin (`<plugin>/skills/<skill-name>/SKILL.md`): where the plugin is installed

Nested `.claude/skills/` directories in subdirectories are discovered automatically, which works for monorepos where packages have their own skills.

## Frontmatter

All fields are optional. Only `description` is recommended.

```yaml
---
name: skill-name
description: what it does and when Claude should use it
when_to_use: extra trigger context appended to description
argument-hint: '[issue-number]'
disable-model-invocation: true # only the user can invoke
user-invocable: false # only Claude can invoke
allowed-tools: Read Grep Glob # pre-approve tools while skill is active
model: claude-opus-4-6 # override session model
effort: high # override session effort level
context: fork # run as a forked subagent, see subagents.md
agent: Explore # subagent type when context: fork
hooks: ... # skill-scoped hooks
paths: 'src/api/**/*.ts' # auto-load only when matching files are in scope
shell: bash # shell for inline `!command` blocks
---
```

The `description` field drives auto-trigger routing. Strengthen it with `when_to_use` for trigger phrases.

### String substitutions

Skill content supports placeholders that are substituted before Claude sees the prompt.

- `$ARGUMENTS`: full argument string passed after the slash command
- `$ARGUMENTS[N]` or `$N`: positional argument by zero-based index
- `${CLAUDE_SESSION_ID}`: current session ID
- `${CLAUDE_SKILL_DIR}`: directory containing this `SKILL.md`. Useful for referencing bundled scripts

Shell-execution blocks run at render time, so Claude sees the output rather than the command. Use `` !`command` `` for inline calls or open a fenced block with ` ```! ` for multi-line scripts. Disable shell execution with `disableSkillShellExecution: true` in settings.

## Plugins

A plugin is a packaged distribution of skills, hooks, agents, and MCP servers. Plugins live in their own directory with a `plugin.json` manifest and namespace their components to prevent conflicts.

Browse marketplaces with `/plugin`. Install with `/plugin install <name>@<marketplace>` or by listing them under `enabledPlugins` in settings. Use `/reload-plugins` to pick up changes after updates.

Marketplace plugins are cached under `~/.claude/plugins/cache/`. Skill discovery follows symlinks but does not traverse outside the plugin root.

Tune skill listing visibility with `skillOverrides` in settings. Each entry is one of `on` (default), `name-only` (hide the description), `user-invocable-only` (hide from Claude but keep `/name`), or `off`.

Plugin structure:

```plaintext
my-plugin/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── my-skill/
        └── SKILL.md
```

Skills in `my-plugin` are invoked as `/my-plugin:my-skill`.
