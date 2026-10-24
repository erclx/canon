---
title: Adopted and declined
description: The authorities the ui-craft references draw on, and where the per-bullet source rows for each reference sit
---

# Adopted and declined

Every bullet in a reference has its own source row in a ledger outside the plugin, so this record names the authorities once and points at the rows. A reader arguing against one bullet opens its ledger, and a session extending a reference adds the row there in the same change.

## Authorities

Each field below names the source its references cite, and a house choice covers a threshold or a scope no source states.

- **Web accessibility.** The W3C's [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and the [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) back the accessibility, keyboard, pointer, and motion references.
- **CSS behavior.** [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS) and the CSS specifications back the focus ring, `color-scheme`, and overflow bullets.
- **Native targets.** Apple's and Android's platform guidelines back the native touch target figures in `pointer.md`.
- **Forms and copy.** The [GOV.UK Design System](https://design-system.service.gov.uk/) and its style guide back `forms.md` and the copy and casing sections of `copy.md`.
- **Usability research.** The [Nielsen Norman Group](https://www.nngroup.com/articles/) backs most of `states.md`, part of `controls.md`, and the link sections of `copy.md`.
- **Capture.** `capture.md` is a house procedure, with its reflow width taken from the WCAG reflow criterion `a11y.md` cites.

## Where the rows sit

The rows sit in the toolkit's own repository rather than the plugin, one ledger per reference and one table row per bullet under the H2 the bullet sits under. The toolkit's skill audit fails a reference whose bullets and rows disagree in count under any heading, and a target never carries the rows.

## Declined

Each ledger carries its own `## Declined` list, recording the bullets cut or reworded when the source rules were last rewritten. The move into this skill changed no bullet's wording, so it declined nothing.
