import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MeasureContext } from '@/gate/measures'
import { readmeCitations } from '@/gate/measures'
import {
  README_ONLY_MARKER,
  README_PARAPHRASE_MARKER,
} from '@/web/readme-citations'

describe('readmeCitations', () => {
  let root: string

  const refuse = () => {
    throw new Error('readmeCitations runs no command')
  }

  const context = (): MeasureContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
  })

  const write = (path: string, content: string): void => {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-readme-citations-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('reports unmeasured when copy.ts is absent', async () => {
    write('README.md', 'canon keeps one authoritative copy.\n')

    const report = await readmeCitations(context())

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toContain('is absent')
  })

  it('reports unmeasured when README.md is absent', async () => {
    write(
      'web/src/content/copy.ts',
      '// README.md: "authoritative copy"\nexport const hero = {}\n',
    )

    const report = await readmeCitations(context())

    expect(report.unmeasured).toContain('is absent')
  })

  it('passes when every quoted phrase still appears in README.md', async () => {
    write(
      'README.md',
      'canon keeps one authoritative copy for every project.\n',
    )
    write(
      'web/src/content/copy.ts',
      '// README.md: "keeps one authoritative copy"\nexport const hero = {}\n',
    )

    const report = await readmeCitations(context())

    expect(report.failure).toBeUndefined()
    expect(report.emissions[0]?.text).toContain(
      'verified against the current text',
    )
  })

  it('fails when a quoted phrase drifted out of README.md', async () => {
    write('README.md', 'canon does something else now.\n')
    write(
      'web/src/content/copy.ts',
      '// README.md: "keeps one authoritative copy"\nexport const hero = {}\n',
    )

    const report = await readmeCitations(context())

    expect(report.failure).toContain('One README.md citation')
    expect(report.emissions[0]?.text).toContain('no longer appears')
  })

  it('fails on a leftover bare line-number citation', async () => {
    write('README.md', 'canon keeps one authoritative copy.\n')
    write(
      'web/src/content/copy.ts',
      "// README.md:23, the reader's problem\nexport const hero = {}\n",
    )

    const report = await readmeCitations(context())

    expect(report.failure).toContain('One README.md citation')
    expect(report.emissions[0]?.text).toContain('bare line number')
  })

  it('passes a paraphrase marked with a reason and no quoted phrase', async () => {
    write('README.md', 'canon lists six domains across the corpus.\n')
    write(
      'web/src/content/copy.ts',
      `// README.md: ${README_PARAPHRASE_MARKER}: condensed from a bullet list\nexport const catalog = {}\n`,
    )

    const report = await readmeCitations(context())

    expect(report.failure).toBeUndefined()
  })

  it('fails on a README section no quoted phrase cites and no marker covers', async () => {
    write(
      'README.md',
      '## Install it\n\nRun one command.\n\n## Contributing\n\nIssues are welcome.\n',
    )
    write(
      'web/src/content/copy.ts',
      '// README.md: "Install it"\nexport const install = {}\n',
    )

    const report = await readmeCitations(context())

    expect(report.failure).toContain(README_ONLY_MARKER)
    expect(report.emissions[0]?.text).toContain('README.md:5')
    expect(report.emissions[0]?.text).toContain('Contributing')
  })

  it('passes on the shipped README and landing copy', async () => {
    const report = await readmeCitations({
      ...context(),
      root: fileURLToPath(new URL('../../', import.meta.url)),
    })

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toBeUndefined()
  })
})
