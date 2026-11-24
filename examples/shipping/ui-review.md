## UI review

1 failed · 0 need your eyes · 2 passed · 1 not driven
Driven at `9d47e2a` on https://surge-alerts.preview.tidewell.example, rendered by Chromium.

### Failed

**3. /stations/peniche, after saving Cascais: tap Save → no second prompt opens**
A second prompt opened on the Peniche save after the Cascais prompt was dismissed with Escape, since a dismissal leaves the permission at `default`.

![box 3](https://github.com/example-org/tidewell/blob/canon/frames/pr-212/ui-review/9d47e2a/03-second-prompt.png?raw=true)

### Not driven

**4. from a phone with the app closed: tap a surge notification for Cascais**: a closed app on a phone is off the page, so the driver cannot reach it, and the box is owed to the person who merges.

<details>
<summary>Passed (2)</summary>

| Box                                               | Proof                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1. /stations/cascais, 390: tap Save               | prompt opened over the page with the button reading `Saved`, `station-save-light-390` |
| 2. /stations/cascais, 390: tap Save, then decline | button read `Saved` after the decline and no banner rendered, `station-save-dark-390` |

</details>

<details>
<summary>Sweep and guessed wording</summary>

**Sweep**

- /stations/cascais, 390, dark: no console error, no overflow, no axe gate finding

</details>

🤖 Driven by Claude Code

<!-- review-ui: head=9d47e2a1c6f03b85e7a4d2c91f60b38e5a7c4d10 -->
