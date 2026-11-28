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
      expect(run().stdout).toBe('shape=none\nd1=\nstaging=false\nd1_staging=\n')
    })

    it('reads the commented starter as a Worker with no D1 binding', () => {
      put('wrangler.jsonc', HELLO_WORLD)

      expect(run().stdout).toBe(
        'shape=worker\nd1=\nstaging=false\nd1_staging=\n',
      )
    })

    it('reads a TOML config naming a build output as Pages', () => {
      put(
        'wrangler.toml',
        'name = "site"\npages_build_output_dir = "./dist" # main = "x"\n',
      )

      expect(run().stdout).toBe(
        'shape=pages\nd1=\nstaging=false\nd1_staging=\n',
      )
    })

    it('reads a config declaring both an entry and a build output as both', () => {
      put(
        'wrangler.json',
        '{ "main": "src/index.ts", "pages_build_output_dir": "dist" }\n',
      )

      expect(run().stdout).toBe('shape=both\nd1=\nstaging=false\nd1_staging=\n')
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

      expect(run().stdout).toBe(
        'shape=worker\nd1=app-db logs-db\nstaging=false\nd1_staging=\n',
      )
    })

    it('lists a database a TOML config binds', () => {
      put(
        'wrangler.toml',
        'main = "src/index.ts"\n\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "app-db"\n',
      )

      expect(run().stdout).toBe(
        'shape=worker\nd1=app-db\nstaging=false\nd1_staging=\n',
      )
    })
  })

  describe('the staging environment', () => {
    it('reports staging when a JSONC config declares env.staging', () => {
      put(
        'wrangler.jsonc',
        `{
  "main": "src/index.ts",
  "env": {
    // the copy that deploys first
    "staging": { "name": "app-staging" },
  },
}
`,
      )

      expect(run().stdout).toBe(
        'shape=worker\nd1=\nstaging=true\nd1_staging=\n',
      )
    })

    it('reports staging when a TOML config opens an env.staging table', () => {
      put(
        'wrangler.toml',
        'main = "src/index.ts"\n\n[env.staging]\nname = "app-staging"\n',
      )

      expect(run().stdout).toBe(
        'shape=worker\nd1=\nstaging=true\nd1_staging=\n',
      )
    })

    it('reports no staging for a key named staging outside env', () => {
      put(
        'wrangler.jsonc',
        '{ "main": "src/index.ts", "vars": { "staging": "no" } }\n',
      )

      expect(run().stdout).toBe(
        'shape=worker\nd1=\nstaging=false\nd1_staging=\n',
      )
    })

    it('reports no staging for a TOML table commented out', () => {
      put('wrangler.toml', 'main = "src/index.ts"\n# [env.staging]\n')

      expect(run().stdout).toBe(
        'shape=worker\nd1=\nstaging=false\nd1_staging=\n',
      )
    })
  })

  describe('the databases per environment', () => {
    it('splits a JSONC config into production and staging databases', () => {
      put(
        'wrangler.jsonc',
        `{
  "main": "src/index.ts",
  "d1_databases": [{ "binding": "DB", "database_name": "app-db" }],
  "env": {
    "staging": {
      "d1_databases": [{ "binding": "DB", "database_name": "app-db-staging" }],
    },
    "preview": {
      "d1_databases": [{ "binding": "DB", "database_name": "app-db-preview" }],
    },
  },
}
`,
      )

      expect(run().stdout).toBe(
        'shape=worker\nd1=app-db\nstaging=true\nd1_staging=app-db-staging\n',
      )
    })

    it('splits a TOML config into production and staging databases', () => {
      put(
        'wrangler.toml',
        `main = "src/index.ts"

[[d1_databases]]
binding = "DB"
database_name = "app-db"

[env.staging]
name = "app-staging"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "app-db-staging"

[[env.preview.d1_databases]]
binding = "DB"
database_name = "app-db-preview"
`,
      )

      expect(run().stdout).toBe(
        'shape=worker\nd1=app-db\nstaging=true\nd1_staging=app-db-staging\n',
      )
    })
  })

  describe('a JSON config the parser must read', () => {
    it('reads a config saved with a byte order mark', () => {
      put(
        'wrangler.jsonc',
        '﻿{ "main": "src/index.ts", "d1_databases": [{ "database_name": "app" }], "env": { "staging": { "d1_databases": [{ "database_name": "app-s" }] } } }\n',
      )

      expect(run().stdout).toBe(
        'shape=worker\nd1=app\nstaging=true\nd1_staging=app-s\n',
      )
    })

    it('fails the read rather than guessing the databases of a config that does not parse', () => {
      put(
        'wrangler.jsonc',
        '{ "main": "src/index.ts", "d1_databases": [{ "database_name": "app" ]\n',
      )

      const { status, stdout } = run()

      expect(status).toBe(1)
      expect(stdout).toBe('')
    })
  })

  it('exits zero whatever the shape, so a caller branches on the output', () => {
    put('wrangler.json', '{ "main": "a", "pages_build_output_dir": "b" }\n')

    expect(run().status).toBe(0)
  })
})
