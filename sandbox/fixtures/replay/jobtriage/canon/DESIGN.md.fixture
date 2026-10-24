# Design

Capture visual intent and the decisions behind it: the why behind how things look. Not a style guide, component spec, or framework reference. Update this doc when a visual decision is made or a rule changes.

What belongs:

- Tokens described as intent ("mid gray, muted text"), not computed values. Exact values live in code.
- Layout constraints and sizing rules not obvious from wireframes
- Visual rules a developer could get wrong without guidance
- Non-obvious omissions ("no motion", "no custom icons") that prevent scope creep

What does not belong:

- CSS classes, computed values, component filenames, and prop names. Those live in code.
- UX copy and interaction flows, which live in `canon/wireframes/`
- Anything that requires updating every time the code is refactored

Use tables for token systems, one row per token. Use short bullets for component rules, one decision per line. Plain English over technical notation. If a section could be removed and the developer would still build it correctly from wireframes and code alone, remove it.

The `canon design render` command reads the tables below and writes an HTML plus CSS preview to `.canon/review/design/`. Keep table headers and role names intact so the parser can find them.

## Personality

Spatial reasoning workspace. Reads as a daily-driver tool a senior engineer trusts, with the agent's work visible as structure on the canvas rather than narrated in prose. Chat sits in a left rail and the canvas fills the right. Light by default, dark fully supported. Neutral grayscale plus one accent for profile match edges, one red for failure states, one amber for deadline urgency. No marketing gradients, no decorative color. Density is recruiter-readable, not dashboard-dense. Card content stays calm. The canvas earns its surface by showing clusters, timelines, and match edges, not animation.

## Color

One row per role. Intent is a short phrase a human can picture. Value is a hex or a named system token.

| Role           | Intent                                                | Value                       |
| -------------- | ----------------------------------------------------- | --------------------------- |
| background     | page canvas, near-white in light, near-black in dark  | `--background`              |
| surface        | cards, panels, raised blocks                          | `--card`                    |
| text           | primary body text                                     | `--foreground`              |
| muted          | secondary text, helper, captions                      | `--muted-foreground`        |
| accent         | borders, dividers, subtle separators                  | `--border`                  |
| primary        | filled buttons, headline emphasis, profile match edge | `--primary`                 |
| destructive    | tool errors, validation alerts, live recording dot    | `--destructive`             |
| warning        | unsaved changes hint on the profile dialog            | amber-600 / amber-400       |
| match-strong   | profile-match score at or above 70%                   | emerald-600 / emerald-400   |
| match-consider | profile-match score 40 to 69%                         | amber-600 / amber-400       |
| match-pass     | profile-match score below 40%                         | `--muted-foreground`        |
| edge-strong    | profile-to-ad edge stroke at or above 70%             | emerald-500 oklch           |
| edge-consider  | profile-to-ad edge stroke 40 to 69%                   | amber-500 oklch             |
| edge-pass      | profile-to-ad edge stroke below 40%                   | `--muted-foreground`        |
| group-strong   | cluster boundary tone for "Strong fit" labels         | emerald-500/40 + 5% surface |
| group-consider | cluster boundary tone for "Consider" labels           | amber-500/40 + 5% surface   |
| group-pass     | cluster boundary tone for "Pass" / "Skip" labels      | `--muted-foreground/30`     |

Notes:

- Monochrome stays the rule for chrome. The match, edge, and group hues exist only on score-bound surfaces (percentage labels, edge strokes, cluster boundaries). The thresholds are shared across all three (see `web/src/features/canvas/match-tone.ts` and `views/layout.ts` `classifyTone`) so the agent's `groupAds` clusters and `connectProfileToAds` edges read consistently.
- Edge strokes pick a single mid-luminance oklch per tone (`MATCH_TONE_STROKE`) that has adequate contrast on both light and dark canvas backgrounds. Strokes also encode score via width (1 to 3.5px) and opacity (35 to 85%), so a strong-fit edge reads as a thicker, more saturated emerald line and a weak-fit edge reads as a thin, faint muted line.
- Dark mode is a token swap, not a re-tone. A light surface lifts. A dark surface still feels neutral.

## Typography

One row per role. Size and line height in pixels or rem. Family names use their product casing.

| Role    | Family           | Weight | Size | Line height |
| ------- | ---------------- | ------ | ---- | ----------- |
| display | Geist            | 600    | 18px | 1.4         |
| heading | Geist            | 500    | 16px | 1.4         |
| body    | Geist            | 400    | 14px | 1.5         |
| label   | Geist            | 500    | 14px | 1.4         |
| control | Geist            | 500    | 12px | 1.4         |
| code    | system monospace | 400    | 12px | 1.5         |

Notes:

- One sans family across the surface. The profile drawer textarea uses monospace so pasted markdown looks like a file, not prose.
- No display-size text. The largest rendered string is the page title at 18px. Nothing should outweigh the cards.
- `control` is reserved for dense affordances: canvas view tabs, status badges, chip captions, card metadata, and helper text under inputs. Do not use for prose paragraphs or primary action labels.

## Spacing

Base unit and scale. The renderer draws a swatch per step. Base unit is 4px (`gap-1`).

| Step | Multiplier | Value |
| ---- | ---------- | ----- |
| xs   | 0.5        | 2px   |
| sm   | 1          | 4px   |
| md   | 2          | 8px   |
| lg   | 3          | 12px  |
| xl   | 5          | 20px  |

Notes:

- Card-to-card gap is `md`. Card-to-trace gap is `md`. Section gap inside the chat column is `lg`. Page gutter on the chat column is `lg`.
- Maximum chat column width is 768px (`max-w-3xl`). The BYOK gate caps at 448px (`max-w-md`). These widths are deliberate density choices, not arbitrary.

## Borders

| Role    | Radius | Width | When used                       |
| ------- | ------ | ----- | ------------------------------- |
| default | 8px    | 1px   | cards, inputs, buttons, badges  |
| pill    | 999px  | 1px   | seed query chips, status pills  |
| none    | 0      | 0     | conversation column inner edges |

Notes:

- Border colour is the `accent` token (very low contrast against background). The shape carries hierarchy, not the line weight.
- Focus rings come from `--ring`. Do not redefine focus styles per component.

## Motion

Motion is reserved for state changes the user must register. Chevron rotation on collapsibles, fade on theme switch, and the typing indicator on the chat input stay as before. The canvas adds two: node fade-in when the agent places ads (150ms, default ease) and edge draw when the profile connects to a matched ad (200ms, default ease). View transitions on the canvas use React Flow's built-in fit-view animation at 250ms. No parallax. No decorative motion. No entrance animations on inline UI.

## Iconography

Lucide outline icons only. 1.5px stroke, 16px or 20px box. No custom icons, no filled variants, no third-party icon set. Functional icons (Switch provider, Profile, Theme toggle, Tool trace badges) carry an `aria-label` or accompany visible text. Decorative icons mark `aria-hidden`.
