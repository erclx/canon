---
title: Claude Design
description: Orientation and toolkit lessons for Anthropic's hosted design product and its Claude Code handoff
---

# Claude Design

[Claude Design](https://claude.ai/design) is Anthropic's hosted design product. It turns prompts, uploaded references, and a codebase into prototypes, wireframes, slide decks, and one-pagers, then exports them or hands them to Claude Code as a bundle. It is a research preview on paid Claude plans, and an Enterprise admin switches it on. The product has no Claude Code docs page and no `.md` form to fetch. Source: [Introducing Claude Design by Anthropic Labs](https://www.anthropic.com/news/claude-design-anthropic-labs). For where it sits among the design tiers, see [visual design workflow](../../docs/workflow/visual-design-workflow.md).

## Cost measured on a Max 5x plan

Claude Design meters its own weekly quota, apart from chat and Claude Code. Measured in April 2026:

- Design system onboarding against a small repo took about 27 percent of the weekly quota
- Three wireframe variations on one prompt took about 13 percent
- One high-fidelity refinement pass took about 10 percent
- A PDF plus PPTX export of one artifact took about 5 percent

A full design system plus one artifact through to handoff and export lands near 55 percent, which caps usable cycles at roughly two a week. Prefer chat refinements over re-running onboarding, the most expensive single action.

## What the handoff bundle holds

The Claude Code handoff is a menu item under `Export` that yields a short paste instruction carrying a URL. The URL returns a gzipped tarball with no authentication, so anyone holding the link can fetch the bundle. Treat handoff links as shareable.

The tarball expands to a `README.md` written as a meta-prompt for coding agents, `chats/` with the conversation transcripts, and a `project/` folder holding the primary HTML file, the design system tokens, and supporting wireframes and screenshots. The meta-prompt tells an agent to read the transcripts first and to skip rendering the HTML in a browser unless asked. The design system travels inside the bundle, so an implementer needs no access to the project.

## Limitations canon hit

- **No MCP and no API.** An agent cannot read or write a project, so the handoff is human-mediated through the UI.
- **One-way snapshot.** Code changes do not flow back, and design edits after handoff do not reach an implementation already under way.
- **Re-extraction is a full pass.** Updating the stored design system means re-running onboarding, with no incremental token update.
