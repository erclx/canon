---
title: Claude Code commands
description: Full built-in slash command reference
---

# Claude Code commands

Built-in slash commands available in every Claude Code session. Some commands depend on your plan, platform, or environment and may not appear for all users. Source: Anthropic, in the [Claude Code docs](https://code.claude.com/docs).

## Session management

- `/clear`: clear conversation history and free up context
- `/compact [instructions]`: compress conversation history with optional focus instructions
- `/resume [session]`: resume a conversation by ID, name, or open the session picker
- `/branch [name]`: create a branch of the current conversation
- `/rename [name]`: rename the current session
- `/rewind`: rewind the conversation to a previous point
- `/exit`: exit the CLI

## Code and files

- `/add-dir <path>`: add a working directory for file access in the current session
- `/diff`: open an interactive diff viewer for uncommitted changes
- `/copy [N]`: copy the last assistant response to clipboard, or the Nth-latest
- `/export [filename]`: export the current conversation as plain text
- `/security-review`: analyze pending changes on the current branch for security issues
- `/autofix-pr [prompt]`: spawn a web session to watch the current PR and push fixes when CI fails or reviewers comment

## Planning and tasks

- `/plan [description]`: enter plan mode
- `/goal [condition|clear]`: set a completion condition. Claude works each turn until a fast model confirms it holds, then clears. `clear` cancels an active goal
- `/ultraplan <prompt>`: draft a plan in a cloud session, review in browser, then execute remotely or teleport back. Team or Enterprise only
- `/bg [prompt]` or `/background [prompt]`: move the current session to a background agent, managed from agent view
- `/tasks`: list and manage background tasks
- `/btw <question>`: ask a quick side question without adding to conversation history

## Configuration

- `/config`: open the settings interface
- `/model [model]`: select or change the active model
- `/effort [low|medium|high|xhigh|max|auto]`: set the model effort level
- `/fast [on|off]`: toggle fast mode
- `/theme`: change the color theme
- `/color [color|default]`: set the prompt bar color for the current session
- `/keybindings`: open or create the keybindings configuration file
- `/statusline`: configure the status line
- `/terminal-setup`: configure terminal keybindings for Shift+Enter and other shortcuts

## Project setup

- `/init`: initialize the project with a `CLAUDE.md` file
- `/memory`: edit `CLAUDE.md` memory files or toggle auto-memory
- `/permissions`: manage allow, ask, and deny rules for tool permissions
- `/hooks`: view hook configurations for tool events

## Integrations

- `/mcp`: manage MCP server connections and OAuth authentication
- `/ide`: manage IDE integrations and show connection status
- `/plugin`: manage Claude Code plugins
- `/reload-plugins`: reload all active plugins to apply pending changes
- `/agents`: manage agent configurations
- `/remote-control`: make the current session available for remote control from claude.ai
- `/schedule [description]`: create, update, list, or run cloud [routines](routines.md)

## Information

- `/help`: show available commands
- `/context`: visualize current context usage
- `/cost`: show token usage for the session
- `/stats`: show daily usage, session history, and model preferences
- `/status`: show version, model, account, and connectivity
- `/usage`: show plan usage limits and rate limit status
- `/skills`: list available skills (see [skills](skills.md))
- `/debug`: enable debug logging for the session
- `/doctor`: diagnose the Claude Code installation and settings
- `/release-notes`: view the changelog
- `/insights`: generate a report analyzing your sessions, project areas, and friction points
- `/powerup`: walk through interactive lessons covering Claude Code features
- `/feedback [report]`: submit feedback about Claude Code

## Account

- `/login`: sign in to your Anthropic account
- `/logout`: sign out from your Anthropic account
- `/upgrade`: open the upgrade page to switch to a higher plan tier
- `/privacy-settings`: view and update privacy settings
- `/extra-usage`: configure extra usage when rate limits are hit
- `/passes`: share a free week of Claude Code with friends

## Platform and admin

- `/setup-bedrock`: configure Amazon Bedrock authentication, region, and model pins
- `/setup-vertex`: configure Google Vertex AI authentication, region, and model pins. Visible only when `CLAUDE_CODE_USE_VERTEX=1`
- `/install-github-app`: set up the Claude GitHub Actions app for a repository
- `/install-slack-app`: install the Claude Slack app
- `/chrome`: configure Claude in Chrome settings
- `/desktop`: continue the current session in the Claude Code desktop app
- `/mobile`: show a QR code to download the Claude mobile app
- `/teleport` (alias `/tp`): pull a web session into this terminal
- `/web-setup`: connect your GitHub account to Claude Code on the web
- `/stickers`: order Claude Code stickers
- `/sandbox`: toggle sandbox mode. Available on supported platforms only
- `/remote-env`: configure the default remote environment for web sessions
- `/voice`: toggle push-to-talk voice dictation
- `/claude-api`: load Claude API reference for your project's language. Auto-activates when code imports `anthropic` or `@anthropic-ai/sdk`

## Notes

MCP servers can expose prompts that appear as commands using the format `/mcp__<server>__<prompt>`. Skills bundled with Claude Code (like `/simplify`, `/loop`, and `/schedule`) also appear alongside built-in commands.
