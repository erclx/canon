---
title: Claude Design
description: Anthropic's hosted design product, its capabilities, and how it hands off to Claude Code
---

# Claude Design

[Claude Design](https://claude.ai/design) is Anthropic's first-party design product from the Anthropic Labs team. It turns text prompts and uploaded references into prototypes, wireframes, mockups, pitch decks, and one-pagers, then packages the result as a handoff bundle that Claude Code consumes in a single instruction. Released 2026-04-17 and powered by Opus 4.7. Source: Anthropic, which builds and hosts the product.

This page covers what Claude Design does, how to use it, and how it fits alongside Claude Code. For where it sits in the broader design tier framework, see [visual design workflow](../../docs/workflow/visual-design-workflow.md).

## Status

Research preview. Rolled out gradually to Claude Pro, Max, Team, and Enterprise subscribers starting 2026-04-17. On Enterprise plans, an admin enables it in Organization settings. No separate charge.

Metering is independent from Claude chat and Claude Code. Claude Design has its own weekly quota that sits alongside existing plan limits. Design activity does not draw from the `All models` or `Current session` buckets, and chat or code activity does not draw from the Claude Design bucket. The Usage page shows a dedicated `Claude Design` row.

Typical per-action cost on a Max 5x plan, measured in April 2026:

- Design system onboarding against a small repo: around 27 percent of the weekly Claude Design quota
- Three wireframe variations on a single prompt: around 13 percent
- One high-fidelity refinement pass: around 10 percent
- PDF plus PPTX export of one artifact: around 5 percent

A full design system plus one artifact through to handoff and export lands near 55 percent of the weekly quota. Budget the cycle accordingly, and prefer chat refinements over re-running onboarding, which is the most expensive single action.

Hosted web app only. No API, no MCP server, no desktop app, no local surface. This shapes how it slots into agent-driven workflows. See [limitations](#limitations) below.

## Capabilities

### Input surfaces

- Text prompts in the conversational editor
- Document uploads in DOCX, PPTX, XLSX
- Image uploads for visual references
- Codebase references, Claude reads repo files to pull in existing components and tokens
- Web capture for scraping live pages as style or layout references

### Output formats

- Internal share URL with org-scoped view-only or edit access
- Saved folder inside Claude Design for later iteration
- PDF export
- PPTX export
- Canva export that lands as a fully editable, collaborative Canva project
- Standalone HTML export for self-hosted prototypes
- Handoff bundle for Claude Code, see [Claude Code handoff](#claude-code-handoff)

### Artifact types

The project creation surface exposes four top-level tabs:

- `Prototype`, which branches into `Wireframe` for rough grey-box exploration and `High fidelity` for polished mockups with the design system applied
- `Slide deck` for pitch decks and presentations
- `From template` for starting from a saved project
- `Other` for one-pagers, marketing collateral, and free-form artifacts

Inside any prototype, Claude Design can render code-powered interactive experiences that run in the browser.

### Design system extraction

Setting up a design system is a separate step from creating an artifact. The entry point is a `Set up design system` button in the left rail, not part of the project creation form. The form accepts a company blurb, a GitHub repo URL, a local folder upload, an optional Figma file, and freeform notes.

Extraction reads prose surfaces alongside code. Style guides, CLAUDE.md files, shell UI libraries, and TypeScript UI modules all contribute. A repo with no frontend can still yield a usable design system if it carries explicit brand material in prose or shell scripts. A repo with neither falls back to generic defaults plus whatever the blurb implies.

Every subsequent project applies the extracted system by default, so output stays consistent without manual token entry. Re-running onboarding updates the stored system and costs another full onboarding pass against the quota.

### Refinement modes

- Conversational edits in the chat pane
- Inline comments pinned to canvas regions
- Direct manipulation with drag, resize, and property editing
- Custom adjustment controls for reusable tweaks like palette shifts or density changes

### Collaboration

Projects belong to an organization, not an individual. Team members get view-only or edit access per project. Comments and edits sync live.

## How to use it

### First run

Connect a codebase and any existing design files during onboarding. Claude Design extracts a design system and stores it against the organization. Without this step, output falls back to generic defaults and the handoff to Claude Code loses fidelity.

### Daily loop

Describe the artifact in one or two sentences. Claude Design typically inserts a clarification pass before generating, surfacing a `Questions` tab with a generated multiple-choice form covering variation count, vibe, layout, fidelity, color usage, and CTA copy. Answer the form, then Claude Design produces a first pass.

Refine with conversational edits for structural changes, inline comments for targeted fixes, and direct manipulation for spatial nudges. Export only after the artifact is review-ready, not during exploration.

First-pass fidelity is usable when the design system is rich and the prompt lines up with it. On an on-brand prompt against a fully onboarded design system, one high-fidelity pass can be shippable without iteration.

### Claude Code handoff

Handoff is a menu item under `Export`, alongside `Download project as .zip`, `Export as PDF`, `Export as PPTX`, `Send to Canva`, and `Export as standalone HTML`. Selecting it produces a short paste instruction of the form:

```plaintext
Fetch this design file, read its readme, and implement the relevant aspects of the design. https://api.anthropic.com/v1/design/h/<id>?open_file=<artifact>.html
Implement: <artifact>.html
```

The URL returns a gzipped tarball, roughly 60KB for a single-artifact project, no authentication required. That public-fetch model has a privacy implication: anyone with the URL can retrieve the bundle. Treat handoff links as shareable.

The tarball expands into a project folder with this shape:

- `README.md`, a meta-prompt written for coding agents that tells them to read the chat transcripts first, read the primary HTML top to bottom, follow imports, and ask before implementing if anything is ambiguous
- `chats/`, conversation transcripts preserving the Q&A iteration so the implementer sees the intent behind the output
- `project/<artifact>.html`, the primary design file
- `project/design_system/`, tokens and type scale bundled inline
- `project/wireframes/`, `project/screenshots/`, `project/wireframe.css`, supporting files

Claude Code fetches the URL, extracts the archive, reads the meta-prompt, scopes the work, and implements. On an on-brand artifact, first-turn output is usable. The meta-prompt tells agents not to render the HTML in a browser or screenshot it unless the user asks, because everything needed is spelled out in the source.

The design system travels inside the bundle, so an implementer does not need access to the Claude Design project or organization.

This is a one-way handoff. Code changes do not flow back to Claude Design, and designer edits after handoff do not propagate to an in-progress Claude Code session. Treat the handoff as a snapshot, not a sync.

## When to use Claude Design

Pick Claude Design when:

- The project has UI but no dedicated designer
- Stakeholders review visuals before code exists
- The team already pays for Claude Pro, Max, Team, or Enterprise
- Output needs to land in Canva, PDF, or PPTX for external distribution
- The handoff bundle to Claude Code is the intended implementation path

Skip Claude Design when:

- A dedicated designer owns the source of truth in Figma, Figma's MCP and Code to Canvas round-trip better
- The workflow needs an agent to draw on a canvas and read back what it drew, use Excalidraw with `mcp_excalidraw` instead
- The project is CLI-only or backend-only, prose in `DESIGN.md` is enough
- Output needs to live outside Anthropic's ecosystem for licensing or vendor reasons

## Limitations

- **No MCP, no API**: agents cannot read or write Claude Design projects programmatically. Hand-off is human-mediated through the UI copy instruction.
- **One-way sync**: the handoff bundle is a snapshot. Design edits after handoff do not update the in-progress implementation.
- **Hosted only**: projects live on Anthropic's infrastructure. No self-host path for air-gapped environments.
- **Research preview**: feature surface and quotas change without notice. Pin critical flows to stable export formats like PDF or PPTX.
- **Design system re-extraction**: updating the stored design system means re-running onboarding. There is no incremental token update surface.
- **Enterprise gating**: admins must enable the feature per organization. New users see nothing until that switch flips.

## Cost tradeoffs versus alternatives

Claude Design's per-action cost makes it a ceiling tool. On a Max 5x plan, one full design system plus one artifact through to handoff and exports lands near 55 percent of the weekly Claude Design quota. That caps usable cycles at roughly two per week. Daily iteration needs a cheaper companion to handle the bulk of prompt-to-prototype work.

Direct comparison against Stitch, Google's Gemini-powered design product, on the same landing-page prompt with no uploads:

|                           | Claude Design                                       | Stitch                                        |
| ------------------------- | --------------------------------------------------- | --------------------------------------------- |
| First-pass brand fidelity | On-brand after codebase onboarding                  | Generic, invents a design system              |
| Cost per generation       | 10 to 20 percent of the weekly quota                | 5 of 400 daily credits                        |
| Codebase extraction       | Deep, reads prose and shell scripts                 | None, context must be prose in the prompt     |
| Agent addressable         | No MCP, no API                                      | MCP at `stitch.googleapis.com/mcp`            |
| Handoff to Claude Code    | URL pointing to a gzipped tarball with chat history | Export to coding agents, details vary by mode |

Reach for Claude Design when codebase extraction or the richly annotated handoff tarball is the whole point. Use Stitch when visual iteration is agent-driven or frequent. For projects that only need prose design docs, the toolkit's tier 0 is still enough, see [visual design workflow](../../docs/workflow/visual-design-workflow.md).

## References

- [Introducing Claude Design by Anthropic Labs](https://www.anthropic.com/news/claude-design-anthropic-labs)
- [TechCrunch launch coverage](https://techcrunch.com/2026/04/17/anthropic-launches-claude-design-a-new-product-for-creating-quick-visuals/)
- [VentureBeat on the Figma comparison](https://venturebeat.com/technology/anthropic-just-launched-claude-design-an-ai-tool-that-turns-prompts-into-prototypes-and-challenges-figma)
- [Visual design workflow](../../docs/workflow/visual-design-workflow.md): tier framework that places Claude Design against Figma, Stitch, and Excalidraw
