---
title: Menus reference ledger
description: Sources for claude/skills/ui-craft/references/menus.md, one row per bullet
---

# Menus reference ledger

The field is interaction design, and the authorities are Apple's Human Interface Guidelines on context menus, the Nielsen Norman Group's research on contextual menus, and the ARIA Authoring Practices Guide for the keyboard route. Apple's page was read through its JSON data endpoint. Frameboard is the field report, holding 10 commits that each added a menu after its surface shipped without one.

## Context menus

| Bullet                                                  | Source                                                                                                                                                                                                                                                                                                                      | Read            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| An item with two or more actions, every one of its kind | [Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus): "Support context menus consistently throughout your app". The two-action threshold is a house choice, since a menu holding one row repeats the item's own action                                                              | 2026-11-19      |
| Never the only path                                     | [Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus): "Always make context menu items available in the main interface, too", and [Contextual Menus](https://www.nngroup.com/articles/contextual-menus/): their commands should be "also available from the application’s main menu" | 2026-11-19      |
| Shift+F10 opens it                                      | [Developing a keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) lists "open context menu Shift + F10" beside the clipboard keys, and the [menu pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) carries the keys inside it                                                      | 2026-11-19, APG |
| Touch and hold opens it                                 | [Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus): people open one with "The system-defined touch or pinch and hold gesture"                                                                                                                                                     | 2026-11-19      |
