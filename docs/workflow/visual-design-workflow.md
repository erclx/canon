---
title: Visual design workflow
description: Tiered guide for design and wireframe authoring with Claude Code
category: Workflow
---

# Visual design workflow

Three tiers cover the range from prose-only design docs to a fully graphical design source of truth. Pick one per project based on how UI-heavy the work is, whether stakeholders review visuals, and whether a designer is involved. Tiers stack, so moving up does not invalidate work done at a lower tier.

The tier framework sits alongside [Claude Design](../../wiki/claude/claude-design.md), the one catalog page in this range. Stitch, Excalidraw, and the surrounding MCP and skill ecosystem are named inline below rather than catalogued separately. This page decides when to reach for what.

Two tools anchor tier 1 and tier 2. Stitch is the agent-addressable default through its MCP server at `stitch.googleapis.com/mcp`, with a free tier of 400 daily credits that covers daily iteration. [Claude Design](../../wiki/claude/claude-design.md), released 2026-04-17 and priced inside Claude subscriptions, is the ceiling tool reserved for codebase extraction and the richly annotated handoff bundle. Each covers a different job, they are not swappable.

## Tier 0: prose only

The default. `canon/DESIGN.md` holds visual intent as prose plus token tables for color, typography, spacing, borders, motion, and iconography. `.claude/WIREFRAMES.md` holds each surface's regions and states.

Claude Code reads both and writes the implementation. Works for CLI tools, internal dashboards, admin panels, and backend-focused projects.

### Seed shape

The toolkit seed in `tooling/claude/seeds/canon/DESIGN.md` ships a token-table template with a starting set of roles, and `standards/design.md` carries the same tables under `## Template` with placeholder rows. The column headers are what the renderer parses, so they stay verbatim in either, while the rows and values are the project's own.

The `canon:design-extract` skill drafts the file, sourcing tokens from a project's existing prose and CLI UI surfaces, or proposing them from `canon/REQUIREMENTS.md` and a `## Personality` paragraph when no UI code exists yet. `canon design render` writes an HTML plus CSS preview to `.canon/tmp/render/design/` for eyeballing the current system without leaving Claude Code. See `canon/context/design.md`.

A project wanting the toolkit's own values rather than its own runs `canon design install`, which copies one stylesheet to `.claude/design/base.css` carrying the token set as custom properties and two components built on them. That file is toolkit-owned and `canon design sync` refreshes it, so a project overrides a value in `.claude/design/project/` instead, which sync never touches. Nothing arrives without that install, and the two channels are independent: a record drafted by the extract skill is the project's own, and the installed stylesheet is the toolkit's.

A cell no source anchors ends in `? verify`, and the preview shows that marker beside the value rather than folding it in, so a swatch and a font sample stay built from the value alone. A confidence line above the sections names how many cells are anchored against how many are tagged, which is what tells a reader whether they are looking at a record of the code or a proposal about it. It reads the columns a source could anchor and leaves out the row names, so the ratio is not diluted by cells no tag could ever reach. The proposal path tags nearly all of them, so that count reads low on day one by design.

### Tools

- None beyond Claude Code itself
- Playwright CLI optional for verifying form submissions and interactive surfaces. See [`ui-test`](../../claude/skills/ui-test/SKILL.md).

### Skills

- `canon:sketch-design` to trace a design direction from reference images or URLs, before `design-extract`'s greenfield path proposes from a personality paragraph alone
- `canon:design-extract` to draft `canon/DESIGN.md`, from existing project signals or from requirements alone on day one
- `canon:ui-test` for e2e test generation after UI changes
- `canon:ux-audit` for UX gap detection on existing surfaces
- `canon:ux-measure` for what a running surface costs to paint, read against published thresholds
- `canon:draft-and-pick` for a call settled by looking, drafting several candidates onto one page and taking your pick
- `canon:ux-walkthrough` for a multi-finding inspection pass over a running app with the operator, drafting arms from the app's own markup and recording each pick for a builder
- `canon:draft-identity` to draft a project's logo mark and compose it into an icon sequence and a social card, through `draft-and-pick`'s own render-and-pick loop
- Anthropic's `frontend-design` plugin optional for light visual steering

### When to pick

- UI is not the core product
- Design decisions are few and can be written as sentences
- No designer on the project
- Stakeholders review code or behavior rather than mockups

## Tier 1: visual companion

ASCII and prose stay as source of truth. Add a visual render as a feedback surface for the agent and for human review.

- Stitch via MCP handles agent-driven generation of prototypes and design systems
- Excalidraw handles agent-driven wireframes when the round-trip canvas loop matters
- Claude Design joins only when codebase extraction or the annotated handoff bundle is worth the ceiling cost

All three produce derived artifacts, so human edits are review annotations rather than source changes.

### Seed shape

Same as tier 0 with two additions. `WIREFRAMES.md` opts into Excalidraw rendering via a top-of-file marker like `<!-- excalidraw: WIREFRAMES.excalidraw -->`. `DESIGN.md` stays human-maintained, and its content is what the toolkit provisions into Stitch via `create_design_system` when visual generation is needed.

Impeccable, if installed, keeps its own root `DESIGN.md` and `PRODUCT.md` in the Stitch DESIGN.md spec format. These are separate files from the toolkit's `canon/DESIGN.md` and are not synced with it. Treat impeccable's pair as its own source of truth for its commands, and the toolkit's `canon/DESIGN.md` as the source other toolkit skills read.

### Tools

- Stitch via MCP at `stitch.googleapis.com/mcp`, Google's Gemini-powered design product. Agent-addressable through `generate_screen_from_text`, `edit_screens`, and `generate_variants`. Default pick for agent-driven visual generation. Free tier of 400 daily credits.
- Excalidraw canvas server on localhost plus the community [`yctimlin/mcp_excalidraw`](https://github.com/yctimlin/mcp_excalidraw) MCP shim, for projects that need an agent to draw, read back, and revise a canvas. MIT-licensed, plaintext JSON scene format. `describe_scene` and `get_canvas_screenshot` let the agent verify its own layout before claiming it is correct.
- Playwright MCP ([`microsoft/playwright-mcp`](https://github.com/microsoft/playwright-mcp)) for browser-side verification, driven off the accessibility tree rather than screenshots.
- Chrome DevTools MCP ([`ChromeDevTools/chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp)) for live frontend debugging: performance traces, network inspection, and DOM and CSS inspection.
- Claude Design as the ceiling option for codebase extraction or polished handoff bundles. See [Claude Design](../../wiki/claude/claude-design.md).

### Skills

- Everything from tier 0
- A frontend design skill to steer visual quality. Pick one of [pbakaus/impeccable](https://github.com/pbakaus/impeccable), which bundles curated anti-pattern references and is the strongest default, [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), which maps product type to UI rules through a reasoning engine, or Anthropic's `frontend-design` plugin.

### When to pick

- UI is a meaningful part of the product but not the entire product
- Stakeholders want to see layout proposals before code exists
- Design decisions benefit from visual inspection
- A single contributor owns both design and implementation

### Stitch vs Excalidraw vs Claude Design in tier 1

The three tools solve non-overlapping halves of the visual companion problem.

Stitch via MCP generates polished prototypes from text and a provisioned design system, scripted from a Claude Code session. Output is human-facing and lives in Stitch. Free daily quota makes it the right pick for frequent iteration.

Excalidraw gives the agent a canvas it can read back over MCP. Output is agent-facing and persists as a JSON file in the repo. Pick it when Claude Code needs to iterate on wireframes autonomously, not when a human needs polished review artifacts.

Claude Design reads the raw codebase without prose curation and produces a polished handoff bundle with chat history. Weekly quota makes it expensive, so reserve it for the extraction pass or the final handoff moment, not daily iteration.

Most tier 1 projects pick one. Projects with a messy codebase and no curated `DESIGN.md` may want Claude Design once for the initial extraction, then move to Stitch for ongoing work.

## Tier 2: visual as source of truth

Design happens in a graphical tool. `canon/DESIGN.md` either regenerates from the graphical source or takes a secondary role as agent-facing summary. Implementation follows the graphical source, either through an MCP round-trip or a one-way handoff bundle. Fits teams with a dedicated designer or projects where design iteration outpaces code changes.

### Seed shape

`canon/DESIGN.md` becomes a generated artifact. A top-of-file note identifies the upstream source, either a Claude Design project ID or a Figma file URL. Manual edits in the seed carry a warning tag because they will not survive regeneration.

### Tools

- Figma desktop app with the official [Figma Dev Mode MCP](https://www.figma.com/blog/introducing-claude-code-to-figma/) for teams with a dedicated designer already on Figma. Bidirectional sync and Code to Canvas capture of a running Claude Code UI into editable Figma frames.
- Claude Design with its Claude Code handoff bundle for teams without an existing Figma investment and for solo founders or PMs driving design themselves. One-way handoff, no bidirectional sync. See [Claude Design](../../wiki/claude/claude-design.md).
- Stitch via MCP as a low-cost complement to either, used for bulk screen generation driven by Claude Code.
- Playwright and Chrome DevTools MCPs as in tier 1

### Skills

- Everything from tier 1

### When to pick

- UI is the product or a major differentiator
- A dedicated designer is on the project or will join
- Design review happens in the graphical tool rather than in code
- Design changes more often than implementation

### Figma vs Claude Design in tier 2

Figma wins when a dedicated designer already owns a Figma file, external collaborators expect Figma for review, or the workflow needs the agent to capture a running Claude Code UI and push it back as editable frames via Code to Canvas. Figma's MCP is bidirectional.

Claude Design wins when nobody on the team has a Figma workflow yet and the handoff bundle with chat history is the intended implementation path. Claude Design's handoff is one-way, and its quota limits daily iteration, so it is most useful for the initial extraction pass and the final handoff moment rather than day-to-day design work.

Either of the above pairs cleanly with Stitch via MCP for agent-driven screen generation between the two anchor moments.

## Decision guide

Four questions. Each yes weighs toward a higher tier.

- Is the UI the product rather than a thin interface over a backend?
- Do non-engineers review visual proposals before code exists?
- Is there a dedicated designer, or will there be one?
- Does design iterate independently of code?

Zero or one yes: tier 0. Two or three: tier 1. Four: tier 2.

Resist over-tiering early. Moving up is cheap because tiers stack. Moving down means abandoning tooling and confusing collaborators.

## References

- [Claude Design](../../wiki/claude/claude-design.md): first-party hosted design product and handoff bundle
- `canon/context/claude-plugin/skill-strategy.md`: how to decide between workflow and domain-knowledge skills
- [`microsoft/playwright-mcp`](https://github.com/microsoft/playwright-mcp): browser automation MCP used in tier 1 and tier 2
- [`ChromeDevTools/chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp): live frontend debugging MCP used in tier 1 and tier 2
- [`yctimlin/mcp_excalidraw`](https://github.com/yctimlin/mcp_excalidraw): community MCP server behind the tier 1 wireframe companion
