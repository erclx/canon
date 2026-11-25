// Writes one group's suites to GITHUB_OUTPUT as run and files, the whole group
// with no scope. Usage: e2e-groups.ts <group> [scoped file...]

import { appendFileSync } from 'node:fs'

/**
 * Balanced by the mean time of each suite on a CI runner rather than by count,
 * since one suite runs for half a second and another for four minutes. Outside
 * `timed`, a group takes the name of its longest suite.
 */
export const E2E_GROUPS = {
  // Assertions here read real-time pacing, so no other suite may join them
  timed: [
    'src/take/film-drag.e2e.test.ts',
    'src/take/film-glide.e2e.test.ts',
    'src/take/film-step.e2e.test.ts',
  ],
  reel: ['src/take/reel.e2e.test.ts'],
  motion: [
    'src/take/film-canvas.e2e.test.ts',
    'src/take/film-contextmenu.e2e.test.ts',
    'src/take/film-input.e2e.test.ts',
    'src/take/film-scrollbars.e2e.test.ts',
    'src/take/motion.e2e.test.ts',
  ],
  slow: [
    'src/browser/swipe.e2e.test.ts',
    'src/capture/render.e2e.test.ts',
    'src/capture/sections.e2e.test.ts',
    'src/driver/drive.e2e.test.ts',
    'src/inventory/frames.e2e.test.ts',
    'src/inventory/walk.e2e.test.ts',
    'src/take/film-fullscreen.e2e.test.ts',
    'src/take/film-network.e2e.test.ts',
    'src/take/film-slow.e2e.test.ts',
    'src/take/stills.e2e.test.ts',
    'src/tooling/screenshot-mask.e2e.test.ts',
    'src/tooling/screenshot-reflow.e2e.test.ts',
  ],
} as const satisfies Record<string, readonly string[]>

function isGroup(name: string): name is keyof typeof E2E_GROUPS {
  return Object.hasOwn(E2E_GROUPS, name)
}

export function groupFiles(
  group: string,
  scoped: readonly string[],
): readonly string[] {
  if (!isGroup(group)) throw new Error(`e2e-groups: unknown group ${group}`)
  const files: readonly string[] = E2E_GROUPS[group]
  if (scoped.length === 0) return files
  return files.filter((file) => scoped.includes(file))
}

/**
 * `run` answers on its own key, so a leg skips on an explicit answer and never
 * on an output that failed to arrive.
 */
export function groupOutput(
  group: string,
  scoped: readonly string[],
): { readonly run: string; readonly files: string } {
  const files = groupFiles(group, scoped)
  return { run: String(files.length > 0), files: files.join(' ') }
}

function main(group: string, scoped: readonly string[]): void {
  const lines = Object.entries(groupOutput(group, scoped))
    .map(([key, value]) => `${key}=${value}\n`)
    .join('')
  const out = process.env.GITHUB_OUTPUT
  if (out !== undefined) appendFileSync(out, lines)
  console.error(lines)
}

if (import.meta.main) main(process.argv[2] ?? '', process.argv.slice(3))
