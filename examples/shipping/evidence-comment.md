## Evidence

**Preview:** https://surge-alerts.preview.tidewell.example · **Local preview:** http://127.0.0.1:4316

**Reel** filmed at `9d47e2a`:<br><img src="https://github.com/example-org/tidewell/blob/canon/frames/pr-212/reel-390.webp?raw=true" width="390" alt="reel filmed at 9d47e2a">

**Reel covers:** the first save, the declined prompt, and the second save asking nothing

**Base:** [`3b91f04`](https://github.com/example-org/tidewell/commit/3b91f04c2a6e7d18f5c0a9e4b27d6c13f8e05a92) · **Head:** [`9d47e2a`](https://github.com/example-org/tidewell/commit/9d47e2a1c6f03b85e7a4d2c91f60b38e5a7c4d10)

<details open>
<summary>station-save (4)</summary>

**390 · dark**

<img src="https://github.com/example-org/tidewell/blob/9d47e2a1c6f03b85e7a4d2c91f60b38e5a7c4d10/canon/evidence/station-page/station-save-dark-390.png?raw=true" width="390" alt="station-save-dark-390 head">

<details>
<summary>Base</summary>

<img src="https://github.com/example-org/tidewell/blob/3b91f04c2a6e7d18f5c0a9e4b27d6c13f8e05a92/canon/evidence/station-page/station-save-dark-390.png?raw=true" width="390" alt="station-save-dark-390 base">

</details>

**390 · light**

<img src="https://github.com/example-org/tidewell/blob/9d47e2a1c6f03b85e7a4d2c91f60b38e5a7c4d10/canon/evidence/station-page/station-save-light-390.png?raw=true" width="390" alt="station-save-light-390 head">

<details>
<summary>Base</summary>

<img src="https://github.com/example-org/tidewell/blob/3b91f04c2a6e7d18f5c0a9e4b27d6c13f8e05a92/canon/evidence/station-page/station-save-light-390.png?raw=true" width="390" alt="station-save-light-390 base">

</details>

**1440 · dark**

<img src="https://github.com/example-org/tidewell/blob/9d47e2a1c6f03b85e7a4d2c91f60b38e5a7c4d10/canon/evidence/station-page/station-save-dark-1440.png?raw=true" width="1000" alt="station-save-dark-1440 head">

<details>
<summary>Base</summary>

<img src="https://github.com/example-org/tidewell/blob/3b91f04c2a6e7d18f5c0a9e4b27d6c13f8e05a92/canon/evidence/station-page/station-save-dark-1440.png?raw=true" width="1000" alt="station-save-dark-1440 base">

</details>

**1440 · light**

<img src="https://github.com/example-org/tidewell/blob/9d47e2a1c6f03b85e7a4d2c91f60b38e5a7c4d10/canon/evidence/station-page/station-save-light-1440.png?raw=true" width="1000" alt="station-save-light-1440 head">

<details>
<summary>Base</summary>

<img src="https://github.com/example-org/tidewell/blob/3b91f04c2a6e7d18f5c0a9e4b27d6c13f8e05a92/canon/evidence/station-page/station-save-light-1440.png?raw=true" width="1000" alt="station-save-light-1440 base">

</details>

</details>

## What to look at

<!-- pr-checklist:start -->

**Save button**

- [ ] /stations/cascais, 390: tap Save → the permission prompt opens over the page, and the button reads Saved behind it → matches `canon/design/station-page/` in light and dark
- [ ] /stations/cascais, 390: tap Save, then decline the prompt → the station still reads Saved, and no banner nags about notifications
- [ ] /stations/peniche, after saving Cascais: tap Save → no second prompt opens

**Notification**

- [ ] from a phone with the app closed: tap a surge notification for Cascais → the station page opens at the advisory (local only)

**Shipping without a test:**

- A tap on a notification opens the station → end to end (Playwright)

<!-- pr-checklist:end -->

<!-- pr-evidence: head=9d47e2a1c6f03b85e7a4d2c91f60b38e5a7c4d10 -->
