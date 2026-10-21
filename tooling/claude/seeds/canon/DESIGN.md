# Design

Authoring guidance: the design standard. Values live in `<your stylesheet>`, such as `src/styles/tokens.css` or a Tailwind `@theme` block. A project with none writes a stylesheet of its own and names it here.

## Overview

One paragraph. Voice, tone, and the feeling a user should have. The same content a design intake form asks for.

## Colors

Up to three rules a developer could get wrong.

One row per role, naming its custom property. Intent is a short phrase a human can picture.

| Role       | Property             | Intent                        |
| ---------- | -------------------- | ----------------------------- |
| background | `--color-background` | page canvas                   |
| surface    | `--color-surface`    | cards, panels, raised blocks  |
| text       | `--color-text`       | primary body text             |
| muted      | `--color-muted`      | secondary text, captions      |
| accent     | `--color-accent`     | links, primary action         |
| success    | `--color-success`    | confirmations, positive state |
| warning    | `--color-warning`    | cautions, pending state       |
| error      | `--color-error`      | failures, destructive action  |

## Typography

Up to three rules. How the roles divide between families, and any role that breaks the pattern.

## Spacing

One line. The base unit and how the scale steps.

## Shapes

One row per role, naming its radius property.

| Role    | Property           | When used          |
| ------- | ------------------ | ------------------ |
| default | `--radius-default` | cards, inputs      |
| pill    | `--radius-pill`    | tags, status chips |

## Motion

One line. State whether motion is used at all, and if so, the default duration and easing.

## Iconography

One line. Style (outline, filled, duotone), source library, and whether custom icons are allowed.
