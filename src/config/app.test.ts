import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readAppTable } from '@/config/app'

const FIXTURE = join(import.meta.dirname, 'fixtures', 'app.toml')

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-app-config-'))
  mkdirSync(join(root, 'canon', 'config'), { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function write(name: string, text: string): void {
  writeFileSync(join(root, 'canon', 'config', name), text)
}

function valueOf(read: ReturnType<typeof readAppTable>): unknown {
  return read.kind === 'table' ? read.value : read
}

describe('readAppTable', () => {
  describe('the settled shape', () => {
    beforeEach(() => {
      copyFileSync(FIXTURE, join(root, 'canon', 'config', 'app.toml'))
    })

    it('should read each table from app.toml', () => {
      expect(valueOf(readAppTable(root, 'drive'))).toEqual({
        launch: 'bun run build && bun run preview',
        data: 'test/fixtures/boards/sample',
        personas: ['a developer in the browser'],
        access: '/api/open',
      })
      expect(valueOf(readAppTable(root, 'preview'))).toEqual({
        writes: ['test/fixtures/boards/sample'],
        keep: ['test/fixtures/boards/sample/.run'],
        seed: ['bun', 'scripts/seed.ts'],
      })
      expect(valueOf(readAppTable(root, 'health'))).toEqual({
        paths: ['/api/health'],
        'page-only': ['web'],
      })
      expect(valueOf(readAppTable(root, 'painted'))).toEqual({
        paths: ['src/client/**/*.ts'],
        exclude: ['src/client/**/fixtures.ts'],
      })
      expect(valueOf(readAppTable(root, 'device-classes'))).toEqual({
        default: ['desktop'],
        why: 'The board is a canvas',
      })
    })

    it('should name app.toml as the source and spell a key under its table', () => {
      const read = readAppTable(root, 'health')

      expect(read.kind === 'table' && read.source).toBe('canon/config/app.toml')
      expect(read.kind === 'table' && read.spell('paths')).toBe('health.paths')
    })
  })

  describe('the old files', () => {
    it('should rename health to paths in local.toml and spell it back', () => {
      write('local.toml', 'health = ["/ready"]\npage-only = ["web"]\n')

      const read = readAppTable(root, 'health')

      expect(valueOf(read)).toEqual({ paths: ['/ready'], 'page-only': ['web'] })
      expect(read.kind === 'table' && read.source).toBe(
        'canon/config/local.toml',
      )
      expect(read.kind === 'table' && read.spell('paths')).toBe('health')
      expect(read.kind === 'table' && read.spell('page-only')).toBe('page-only')
    })

    it('should rename the three painted.json keys', () => {
      write(
        'painted.json',
        '{"painted":["a/**"],"unpainted":["b/**"],"reelInputs":["bun.lock"]}',
      )

      expect(valueOf(readAppTable(root, 'painted'))).toEqual({
        paths: ['a/**'],
        exclude: ['b/**'],
        'reel-inputs': ['bun.lock'],
      })
    })

    it('should drop a key an old file already spells the new way', () => {
      write('local.toml', 'paths = ["/ignored"]\n')

      expect(valueOf(readAppTable(root, 'health'))).toEqual({})
    })

    it('should read app-drive.toml whole, targets included', () => {
      write(
        'app-drive.toml',
        'launch = "bun run dev"\n\n[targets.web]\nscripts = ["s"]\n',
      )

      const read = readAppTable(root, 'drive')

      expect(valueOf(read)).toEqual({
        launch: 'bun run dev',
        targets: { web: { scripts: ['s'] } },
      })
      expect(read.kind === 'table' && read.spell('targets.web.scripts')).toBe(
        'targets.web.scripts',
      )
    })

    it('should read preview.json as written', () => {
      write('preview.json', '{"writes":["data"],"port":4321}')

      expect(valueOf(readAppTable(root, 'preview'))).toEqual({
        writes: ['data'],
        port: 4321,
      })
    })

    it('should read the table inside device-classes.toml', () => {
      write(
        'device-classes.toml',
        '[device-classes]\ndefault = ["phone"]\nwhy = "x"\n',
      )

      const read = readAppTable(root, 'device-classes')

      expect(valueOf(read)).toEqual({ default: ['phone'], why: 'x' })
      expect(read.kind === 'table' && read.spell('default')).toBe(
        'device-classes.default',
      )
    })

    it('should read a device-classes.toml with no table as absent', () => {
      write('device-classes.toml', '# nothing yet\n')

      expect(readAppTable(root, 'device-classes')).toEqual({ kind: 'absent' })
    })

    it('should report an old JSON file that does not parse', () => {
      write('preview.json', '{nope')

      expect(readAppTable(root, 'preview')).toEqual({
        kind: 'unparsable',
        source: 'canon/config/preview.json',
        detail: 'does not parse as JSON',
      })
    })
  })

  describe('precedence', () => {
    it('should take a table in app.toml over its old file', () => {
      write('app.toml', '[health]\npaths = ["/new"]\n')
      write('local.toml', 'health = ["/old"]\n')

      expect(valueOf(readAppTable(root, 'health'))).toEqual({
        paths: ['/new'],
      })
    })

    it('should fall back per table, so a [drive] alone leaves preview.json read', () => {
      write('app.toml', '[drive]\nlaunch = "bun run dev"\n')
      write('preview.json', '{"writes":["data"]}')

      const preview = readAppTable(root, 'preview')

      expect(valueOf(preview)).toEqual({ writes: ['data'] })
      expect(preview.kind === 'table' && preview.source).toBe(
        'canon/config/preview.json',
      )
      expect(readAppTable(root, 'drive').kind === 'table').toBe(true)
    })

    it('should stop on an app.toml that does not parse, old file or not', () => {
      write('app.toml', '[health\n')
      write('local.toml', 'health = ["/old"]\n')

      expect(readAppTable(root, 'health')).toEqual({
        kind: 'unparsable',
        source: 'canon/config/app.toml',
        detail: 'is not valid TOML',
      })
    })
  })

  describe('absence', () => {
    it('should read no file as absent', () => {
      expect(readAppTable(root, 'drive')).toEqual({ kind: 'absent' })
    })

    it('should read an app.toml with every table commented out as absent', () => {
      write(
        'app.toml',
        [
          '# [drive]',
          '# launch = "bun run dev"',
          '',
          '# [preview]',
          '# writes = ["data"]',
          '',
          '# [health]',
          '# paths = ["/api/health"]',
          '',
          '# [painted]',
          '# paths = ["src/**"]',
          '',
          '# [device-classes]',
          '# default = ["desktop"]',
          '',
        ].join('\n'),
      )

      expect(
        (
          ['drive', 'preview', 'health', 'painted', 'device-classes'] as const
        ).map((table) => readAppTable(root, table).kind),
      ).toEqual(['absent', 'absent', 'absent', 'absent', 'absent'])
    })
  })
})
