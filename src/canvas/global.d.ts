/**
 * The screen color sampler, which only Chromium ships. TypeScript's DOM
 * library carries no type for it, so a window without it reads as undefined.
 */
interface EyeDropperResult {
  readonly sRGBHex: string
}

interface EyeDropperSampler {
  open(options?: { readonly signal?: AbortSignal }): Promise<EyeDropperResult>
}

interface Window {
  readonly EyeDropper?: new () => EyeDropperSampler
}
