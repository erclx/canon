import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(
  import.meta.dirname,
  '../../tooling/web/configs/scripts/readme-screenshot.sh',
)

let project: string
let bin: string

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'readme-screenshot-'))
  bin = join(project, 'bin')
  mkdirSync(join(project, 'scripts/lib'), { recursive: true })
  mkdirSync(bin)
  writeFileSync(
    join(project, 'scripts/readme-screenshot.sh'),
    readFileSync(SCRIPT, 'utf8').replace(
      "README_FILTER=''",
      "README_FILTER='home/1280'",
    ),
  )
  writeFileSync(
    join(project, 'scripts/lib/preview-server.sh'),
    'PREVIEW_PORT=0\n',
  )
})

afterEach(() => {
  rmSync(project, { force: true, recursive: true })
})

/** Stands in for `bun e2e/screenshot.ts`, writing one frame per named theme. */
const stubCapture = (themes: string[]): void => {
  const writes = themes
    .map((theme) => `touch "$dir/1280--${theme}.png"`)
    .join('\n')
  writeFileSync(
    join(bin, 'bun'),
    `#!/usr/bin/env bash\ndir=screenshots/localhost/home\nmkdir -p "$dir"\n${writes}\n`,
    { mode: 0o755 },
  )
}

const run = () =>
  spawnSync('bash', ['scripts/readme-screenshot.sh'], {
    cwd: project,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    timeout: 10_000,
  })

describe('readme-screenshot.sh', () => {
  it('copies the light frame alone when the case captured no dark theme', () => {
    stubCapture(['default'])

    const result = run()

    expect(result.status).toBe(0)
    expect(existsSync(join(project, 'assets/evidence/readme/light.png'))).toBe(
      true,
    )
    expect(existsSync(join(project, 'assets/evidence/readme/dark.png'))).toBe(
      false,
    )
  })

  it('copies both frames when the case captured a dark theme', () => {
    stubCapture(['default', 'dark'])

    const result = run()

    expect(result.status).toBe(0)
    expect(existsSync(join(project, 'assets/evidence/readme/dark.png'))).toBe(
      true,
    )
  })
})
