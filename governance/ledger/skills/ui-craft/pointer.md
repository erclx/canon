---
title: Pointer reference ledger
description: Sources for claude/skills/ui-craft/references/pointer.md, one row per bullet
---

# Pointer reference ledger

The field is web accessibility, and the authorities are the W3C, through WCAG 2.2 and the ARIA Authoring Practices Guide, MDN for popover behavior, and the platform guidelines from Apple and Android for native targets. These bullets were split from `keyboard.md`.

## Pointer actions

| Bullet                                | Source                                                                                                                                                                                                                                                                                                                                                     | Read                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Drag has a single-pointer path        | [Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html): "For any action that involves dragging, provide a simple pointer alternative"                                                                                                                                                                     | 2026-10-18, WCAG 2.2 |
| Outside press and focus leave dismiss | [Using the Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using): you can hide the popover "by clicking outside it", and [the APG disclosure navigation example](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/): "Moving focus out of the navigation region also closes an open dropdown" | 2026-10-23           |
| Pointer action on release             | [Understanding Pointer Cancellation](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html): one of "No Down-Event", "Abort or Undo", or "Up Reversal" holds for single-pointer functionality                                                                                                                                              | 2026-10-23, WCAG 2.2 |
| Gestures have a single-pointer path   | [Understanding Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html): "All functionality that uses multipoint or path-based gestures for operation can be operated with a single pointer without a path-based gesture"                                                                                                      | 2026-10-23, WCAG 2.2 |

## Pointer targets

| Bullet              | Source                                                                                                                                                                                                                                                                                                                              | Read                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 24 by 24 on the web | [Understanding Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): "at least 24 by 24 CSS pixels", except where "a 24 CSS pixel diameter circle is centered on the bounding box of each" and "the circles do not intersect"                                                               | 2026-10-18, WCAG 2.2 |
| Native figures      | [Apple accessibility guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility): a default "44x44 pt" control size on iOS and iPadOS, and [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps): "a focusable area, or touch target size , of at least 48dpx48dp" | 2026-10-18           |
