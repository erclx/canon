---
title: Adopted and declined
description: The authorities the ui-craft references draw on, and where the per-bullet source rows for each reference sit
---

# Adopted and declined

Every bullet in a reference has its own source row in a ledger outside the plugin, so this record names the authorities once and points at the rows. A reader arguing against one bullet opens its ledger, and a session extending a reference adds the row there in the same change.

## Authorities

Each field below names the source its references cite, and a house choice covers a threshold or a scope no source states.

- **Web accessibility.** The W3C's [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and the [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) back the accessibility, keyboard, pointer, and motion references.
- **CSS behavior.** [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS) and the CSS specifications back the focus ring, `color-scheme`, overflow, cursor, and hover query bullets.
- **Native targets.** Apple's and Android's platform guidelines back the native touch target figures in `pointer.md`.
- **Forms and copy.** The [GOV.UK Design System](https://design-system.service.gov.uk/) and its style guide back `forms.md` and the copy and casing sections of `copy.md`.
- **Page copy.** The [GOV.UK writing guidelines](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/), the [Microsoft Writing Style Guide](https://learn.microsoft.com/en-us/style-guide/welcome/), and the Nielsen Norman Group's research on how people read a page back `page-copy.md`.
- **Interaction design.** [Ben Shneiderman](https://www.cs.umd.edu/~ben/)'s direct manipulation paper and the motion system of [Material Components](https://github.com/material-components/material-components-android) back the reader-paced section of `motion.md`.
- **Web performance.** Google's [web.dev](https://web.dev/) guidance on layout shift backs the held-size bullet in `motion.md`.
- **Web architecture.** The W3C [Technical Architecture Group](https://www.w3.org/2001/tag/)'s Identifying Application State finding backs the state held in the address in `states.md`.
- **Menus.** Apple's [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) and the Nielsen Norman Group's research on contextual menus back `menus.md`, with the ARIA Authoring Practices Guide for its keys.
- **Usability research.** The [Nielsen Norman Group](https://www.nngroup.com/articles/) backs most of `states.md`, part of `controls.md`, and the link sections of `copy.md`.
- **Engine coverage.** [axe-core 4.14.0](https://github.com/dequelabs/axe-core/blob/v4.14.0/doc/rule-descriptions.md) gates text contrast (WCAG 1.4.3) in the one theme and state a page is read in.
- **Engine gaps.** That engine has no rule for 1.4.11 non-text contrast or for `prefers-reduced-motion`, so a ring, a hover, a second theme, and motion rest on the component test in `a11y.md`.
- **Capture.** `capture.md` is a house procedure, with its reflow width taken from the WCAG reflow criterion `a11y.md` cites. Its keyboard pass for a change that moves rests on WCAG 2.1.1 Keyboard.

## Where the rows sit

The rows sit in the toolkit's own repository rather than the plugin, one ledger per reference and one table row per bullet under the H2 the bullet sits under. The toolkit's skill audit fails a reference whose bullets and rows disagree in count under any heading, and a target never carries the rows.

## Declined

Each ledger carries its own `## Declined` list, recording the bullets cut or reworded when the source rules were last rewritten. The move into this skill changed no bullet's wording, so it declined nothing.
