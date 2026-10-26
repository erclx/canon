# Vendored zoom notice

The files in this folder carry the zoom timing of [OpenScreen](https://github.com/siddharthvaddem/openscreen) at commit `ca8104c279da0d4b4481ec992ff103949e22c772`, under the MIT license below.

## What came from where

| File              | Source in OpenScreen, under `src/components/video-editor/videoPlayback/`                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `math-utils.ts`   | `mathUtils.ts`                                                                                           |
| `region-utils.ts` | `zoomRegionUtils.ts`, with `TRANSITION_WINDOW_MS` and `ZOOM_IN_TRANSITION_WINDOW_MS` from `constants.ts` |
| `spring.ts`       | `motionSmoothing.ts` and `zoomSpring.ts`                                                                 |

## What changed

- The file names are kebab-case, as this repository names every TypeScript file, and the code is reformatted to its style
- `math-utils.ts` keeps `clamp01`, `cubicBezier`, and `easeOutScreenStudio`, and drops the easings nothing here calls
- `region-utils.ts` keeps `computeRegionStrength`, the connected-pan easing, and the window and gap constants. It drops the dominant-region search, its cache, the 3D rotation, and the cursor-follow focus, since the camera here aims at clicks and holds its focus by its own rule.
- The zoom-out window is 700 ms rather than 1015.05 ms, and the connected pan runs 600 ms rather than 1000 ms, both on the operator's eye in groundwork track `193-ui-record`. <!-- canon-keep-retired --> The zoom-in window keeps OpenScreen's 1522.575 ms.
- `spring.ts` keeps the zoom spring's stiffness 320, damping 40, mass 0.92, its rest thresholds, the delta clamp, and the overshoot clamp from `stepAxis`. OpenScreen steps that spring through the `motion` package, and this solves it in closed form instead, so no dependency comes with it.

## License

```plaintext
MIT License

Copyright (c) 2025 Siddharth Vaddem

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
