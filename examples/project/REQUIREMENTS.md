---
reviewed: 2026-03-02
---

# Requirements

People on a shoreline need to know when the water turns and whether a surge is coming, and a printed chart or a weather app makes them hunt for it.

This record holds at most 600 words.

## Goals

- **One number fast.** Opening a station shows the next high and low tide before anything else, with its time zone beside it.
- **Hear about a surge.** Someone who saved a station hears about a surge advisory before it takes effect, whether or not the app is open.
- **Works at the water.** A station someone has opened before still shows its week of tides with no signal.
- **Compare stations.** A harbor pilot reads two stations' weeks side by side.

## Non-goals

- Forecast weather, wind, or swell. Tidewell shows tides and the advisories the tide service publishes, and links out for the rest.
- Predict tides itself. Every height and time comes from the published predictions.
- Accounts or sign-in. A saved station lives on the device. Revisit when people ask to carry saved stations between devices.
- A 12-hour clock (deferred), until a settings screen exists to hold the choice.

## Constraints

- Every screen works one-handed on a phone at 320 pixels wide.
- An advisory is never shown after the tide service lifts it.
