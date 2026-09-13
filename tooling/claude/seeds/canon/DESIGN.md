# Design

Authoring guidance: the design standard.

## Personality

One paragraph. Voice, tone, and the feeling a user should have. The same content a design intake form asks for.

## Color

One row per role. Intent is a short phrase a human can picture. Value is a hex or a named system token.

| Role       | Intent                        | Value |
| ---------- | ----------------------------- | ----- |
| background | page canvas                   |       |
| surface    | cards, panels, raised blocks  |       |
| text       | primary body text             |       |
| muted      | secondary text, captions      |       |
| accent     | links, primary action         |       |
| success    | confirmations, positive state |       |
| warning    | cautions, pending state       |       |
| error      | failures, destructive action  |       |

## Typography

One row per role. Size and line height in pixels or rem. Family names use their product casing.

| Role    | Family | Weight | Size | Line height |
| ------- | ------ | ------ | ---- | ----------- |
| display |        |        |      |             |
| heading |        |        |      |             |
| body    |        |        |      |             |
| label   |        |        |      |             |
| code    |        |        |      |             |

## Spacing

Base unit and scale. The renderer draws a swatch per step.

| Step | Multiplier | Value |
| ---- | ---------- | ----- |
| xs   | 0.5        |       |
| sm   | 1          |       |
| md   | 2          |       |
| lg   | 3          |       |
| xl   | 5          |       |

## Borders

| Role    | Radius | Width | When used             |
| ------- | ------ | ----- | --------------------- |
| default |        |       | cards, inputs         |
| pill    |        |       | tags, status chips    |
| none    | 0      | 0     | edge-to-edge surfaces |

## Motion

One line. State whether motion is used at all, and if so, the default duration and easing.

## Iconography

One line. Style (outline, filled, duotone), source library, and whether custom icons are allowed.
