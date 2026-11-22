import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(
  import.meta.dirname,
  '../../tooling/cloudflare/configs/scripts/wrangler-shape.sh',
)

// The comments the `hello-world` starter ships, naming keys it never sets.
const HELLO_WORLD = `/**
 * For more details on how to configure Wrangler, refer to:
 * https://developers.cloudflare.com/workers/wrangler/configuration/
 */
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "hello",
  "main": "src/index.ts",
  "compatibility_date": "2025-04-01",
  "rules": [{ "type": "Text", "globs": ["**/*.sql"] }]
  /**
   * Bindings, such as "d1_databases" or "pages_build_output_dir"
   */
  // "d1_databases": [{ "binding": "DB", "database_name": "commented" }],
}
`

let root: string

const put = (name: string, content: string): void => {
  writeFileSync(join(root, name), content)
}

const run = (): { status: null | number; stdout: string } => {
  const { status, stdout } = spawnSync('bash', [SCRIPT], {
    cwd: root,
    encoding: 'utf8',
  })
  return { status, stdout }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'wrangler-shape-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('wrangler-shape.sh', () => {
  describe('the shape', () => {
    it('reads a project with no Wrangler config as none', () => {
      expect(run().stdout).toBe('shape=none\nd1=\n')
    })

    it('reads the commented starter as a Worker with no D1 binding', () => {
      put('wrangler.jsonc', HELLO_WORLD)

      expect(run().stdout).toBe('shape=worker\nd1=\n')
    })

    it('reads a TOML config naming a build output as Pages', () => {
      put(
        'wrangler.toml',
        'name = "site"\npages_build_output_dir = "./dist" # main = "x"\n',
      )

      expect(run().stdout).toBe('shape=pages\nd1=\n')
    })

    it('reads a config declaring both an entry and a build output as both', () => {
      put(
        'wrangler.json',
        '{ "main": "src/index.ts", "pages_build_output_dir": "dist" }\n',
      )

      expect(run().stdout).toBe('shape=both\nd1=\n')
    })
  })

  describe('the D1 databases', () => {
    it('lists every database a JSONC config binds', () => {
      put(
        'wrangler.jsonc',
        `{
  "main": "src/index.ts",
  // one comment line
  "d1_databases": [
    { "binding": "DB", "database_name": "app-db", "database_id": "1" },
    { "binding": "LOGS", "database_name": "logs-db", "database_id": "2" },
  ],
}
`,
      )

      expect(run().stdout).toBe('shape=worker\nd1=app-db logs-db\n')
    })

    it('lists a database a TOML config binds', () => {
      put(
        'wrangler.toml',
        'main = "src/index.ts"\n\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "app-db"\n',
      )

      expect(run().stdout).toBe('shape=worker\nd1=app-db\n')
    })
  })

  it('exits zero whatever the shape, so a caller branches on the output', () => {
    put('wrangler.json', '{ "main": "a", "pages_build_output_dir": "b" }\n')

    expect(run().status).toBe(0)
  })
})
