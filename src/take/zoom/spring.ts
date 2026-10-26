// Adapted from OpenScreen at ca8104c, MIT. See NOTICE.md beside this file.
// Source: getZoomSpringConfig, stepSpringValue, and clampDeltaMs in
// src/components/video-editor/videoPlayback/motionSmoothing.ts, and stepAxis in
// zoomSpring.ts. OpenScreen steps its spring through the `motion` package, and
// this solves the same damped spring in closed form instead, so a target
// inherits no dependency for one function.

export interface SpringState {
  value: number
  velocity: number
  initialized: boolean
}

export interface SpringConfig {
  stiffness: number
  damping: number
  mass: number
  restDelta: number
  restSpeed: number
}

export const ZOOM_SPRING: SpringConfig = {
  stiffness: 320,
  damping: 40,
  mass: 0.92,
  restDelta: 0.0005,
  restSpeed: 0.015,
}

export function createSpringState(initialValue = 0): SpringState {
  return { value: initialValue, velocity: 0, initialized: false }
}

export function clampDeltaMs(deltaMs: number, fallbackMs = 1000 / 60) {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return fallbackMs
  }

  return Math.min(80, Math.max(1, deltaMs))
}

/**
 * Advances one axis toward `target` by `deltaMs`. The first call snaps to the
 * target, a spring at rest stays there, and a step that would cross a moving
 * target lands on it with no velocity, which keeps a quick chase from wobbling
 * on a reversal.
 */
export function stepSpring(
  state: SpringState,
  target: number,
  deltaMs: number,
  config: SpringConfig = ZOOM_SPRING,
): number {
  if (!state.initialized || !Number.isFinite(state.value)) {
    state.value = target
    state.velocity = 0
    state.initialized = true
    return state.value
  }

  if (
    Math.abs(target - state.value) <= config.restDelta &&
    Math.abs(state.velocity) <= config.restSpeed
  ) {
    state.value = target
    state.velocity = 0
    return state.value
  }

  const before = state.value
  const [offset, velocity] = solve(
    state.value - target,
    state.velocity,
    clampDeltaMs(deltaMs) / 1000,
    config,
  )
  const after = target + offset

  const crossed =
    (before <= target && after > target) || (before >= target && after < target)
  if (crossed) {
    state.value = target
    state.velocity = 0
    return target
  }

  state.value = after
  state.velocity = velocity
  return after
}

/**
 * The displacement and velocity of a damped spring `seconds` after it sat at
 * `x0` from rest length moving at `v0`, for each of the three damping regimes.
 */
function solve(
  x0: number,
  v0: number,
  seconds: number,
  { stiffness, damping, mass }: SpringConfig,
): [number, number] {
  const omega = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))
  const t = seconds

  if (zeta < 1) {
    const omegaD = omega * Math.sqrt(1 - zeta * zeta)
    const decay = Math.exp(-zeta * omega * t)
    const b = (v0 + zeta * omega * x0) / omegaD
    const cos = Math.cos(omegaD * t)
    const sin = Math.sin(omegaD * t)
    const x = decay * (x0 * cos + b * sin)
    const v =
      decay *
      (-zeta * omega * (x0 * cos + b * sin) + omegaD * (b * cos - x0 * sin))
    return [x, v]
  }

  if (zeta === 1) {
    const decay = Math.exp(-omega * t)
    const b = v0 + omega * x0
    return [(x0 + b * t) * decay, (b - omega * (x0 + b * t)) * decay]
  }

  const root = Math.sqrt(zeta * zeta - 1)
  const r1 = -omega * (zeta - root)
  const r2 = -omega * (zeta + root)
  const c1 = (v0 - r2 * x0) / (r1 - r2)
  const c2 = x0 - c1
  const e1 = Math.exp(r1 * t)
  const e2 = Math.exp(r2 * t)
  return [c1 * e1 + c2 * e2, c1 * r1 * e1 + c2 * r2 * e2]
}
