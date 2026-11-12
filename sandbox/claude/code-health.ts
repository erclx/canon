import { scenario, type StageContext } from '@/sandbox/scenario'

/**
 * Every seed is built from one-line strings joined at write time, so this file
 * holds no multi-line literal for `canon code audit` to read as embedded code.
 */
function lines(...rows: string[]): string {
  return `${rows.join('\n')}\n`
}

/** File length: a module past the file limit, built from short functions. */
function seedLongFile(ctx: StageContext): void {
  const rows = ['// Formatters for every report column.', '']
  for (let i = 0; i < 420; i++) {
    rows.push(
      `export function formatColumn${i}(value: number): string {`,
      `  const scaled = value * ${i + 1}`,
      '  return scaled.toFixed(2)',
      '}',
      '',
    )
  }
  ctx.write('src/report/columns.ts', lines(...rows))
}

/**
 * Function length and the long block read: one command function past the
 * function checkpoint, holding a CSV parse loop that carries its own rule.
 */
function seedLongFunction(ctx: StageContext): void {
  const rows = [
    "import { readFileSync } from 'node:fs'",
    '',
    'export interface Row {',
    '  readonly name: string',
    '  readonly amount: number',
    '}',
    '',
    'export function runImport(path: string, dryRun: boolean): Row[] {',
    "  const text = readFileSync(path, 'utf8')",
    '  const rows: Row[] = []',
    "  for (const raw of text.split('\\n')) {",
    '    const line = raw.trim()',
    "    if (line === '' || line.startsWith('#')) continue",
    '    const cells: string[] = []',
    "    let cell = ''",
    '    let quoted = false',
    '    for (const char of line) {',
    "      if (char === '\"') {",
    '        quoted = !quoted',
    '        continue',
    '      }',
    "      if (char === ',' && !quoted) {",
    '        cells.push(cell)',
    "        cell = ''",
    '        continue',
    '      }',
    '      cell += char',
    '    }',
    '    cells.push(cell)',
    '    const [name, amount] = cells',
    "    rows.push({ name: name ?? '', amount: Number(amount) })",
    '  }',
  ]
  for (let i = 0; i < 110; i++) {
    rows.push(`  if (rows.length > ${i * 10}) console.log('checkpoint ${i}')`)
  }
  rows.push('  if (dryRun) return []', '  return rows', '}')
  ctx.write('src/cli/import.ts', lines(...rows))
}

/** Comments: a long block describing three routes, plus a degradation term. */
function seedComments(ctx: StageContext): void {
  const rows = ['/*']
  for (const route of ['GET /items', 'POST /items', 'DELETE /items/:id']) {
    rows.push(` * ${route}`)
    for (let i = 0; i < 8; i++) {
      rows.push(` *   Step ${i + 1} of the ${route} handler checks one field.`)
    }
  }
  rows.push(
    ' */',
    'export const routes = {',
    "  list: () => 'items',",
    '  // TODO: validate the body before saving',
    '  create: (body: string) => body,',
    '  remove: (id: string) => id,',
    '}',
  )
  ctx.write('src/server/routes.ts', lines(...rows))
  ctx.write(
    '.claude/rules/code-comments.md',
    lines(
      '# Code comment standards',
      '',
      '## Degradation vocabulary',
      '',
      'Do not write a comment carrying any of these terms.',
      '',
      '- `TODO`, `FIXME`, `HACK`, `XXX`',
    ),
  )
}

/** Inline code: a whole HTML page held in a template literal. */
function seedEmbeddedPage(ctx: StageContext): void {
  const tick = '`'
  const placeholder = ['$', '{name}'].join('')
  ctx.write(
    'src/email/welcome.ts',
    lines(
      'export function welcome(name: string): string {',
      `  return ${tick}<!doctype html>`,
      '<html>',
      '<head><title>Welcome</title></head>',
      '<body>',
      `<h1>Welcome, ${placeholder}</h1>`,
      '<p>Your account is ready.</p>',
      '</body>',
      `</html>${tick}`,
      '}',
    ),
  )
}

/** Folder layout: a handlers folder past the checkpoint holding helpers too. */
function seedMixedFolder(ctx: StageContext): void {
  const handlers = ['users', 'orders', 'invoices', 'refunds', 'carts', 'tags']
  for (const name of handlers) {
    ctx.write(
      `src/handlers/${name}.ts`,
      lines(
        "import { respond } from './respond'",
        '',
        `export function handle${name[0].toUpperCase()}${name.slice(1)}(): string {`,
        `  return respond('${name}')`,
        '}',
      ),
    )
  }
  const helpers: Record<string, string[]> = {
    'respond.ts': [
      'export function respond(body: string): string {',
      '  return body',
      '}',
    ],
    'money.ts': [
      'export function cents(value: number): number {',
      '  return Math.round(value * 100)',
      '}',
    ],
    'dates.ts': [
      'export function isoDay(date: Date): string {',
      '  return date.toISOString().slice(0, 10)',
      '}',
    ],
    'types.ts': ['export interface Page {', '  readonly size: number', '}'],
    'slug.ts': [
      'export function slug(text: string): string {',
      '  return text.toLowerCase()',
      '}',
    ],
  }
  for (const [file, rows] of Object.entries(helpers)) {
    ctx.write(`src/handlers/${file}`, lines(...rows))
  }
}

/** A markdown-led folder past the checkpoint, which belongs to document-health. */
function seedGuides(ctx: StageContext): void {
  for (let i = 1; i <= 11; i++) {
    ctx.write(
      `docs/guides/guide-${i}.md`,
      lines(`# Guide ${i}`, '', `Step ${i} of setup.`),
    )
  }
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      ctx.write(
        'package.json',
        lines('{', '  "name": "health-fixture",', '  "private": true', '}'),
      )
      seedLongFile(ctx)
      seedLongFunction(ctx)
      seedComments(ctx)
      seedEmbeddedPage(ctx)
      seedMixedFolder(ctx)
      seedGuides(ctx)

      ctx.git('add', '.')
      ctx.commit('feat(project): initial project scaffold')

      ctx.log.step('Scenario ready: code health across five axes')
      ctx.log.info(
        'Context: a project whose source has rotted one way per axis:',
      )
      ctx.log.info('  1. src/report/columns.ts runs past the file limit')
      ctx.log.info(
        '  2. src/cli/import.ts holds runImport past the function checkpoint, with a CSV parse loop inside',
      )
      ctx.log.info(
        '  3. src/server/routes.ts opens on a comment block describing three routes, and carries a TODO',
      )
      ctx.log.info(
        '  4. src/email/welcome.ts holds a whole HTML page in a template literal',
      )
      ctx.log.info(
        '  5. src/handlers/ holds 11 files, six handlers beside five helpers and types',
      )
      ctx.log.info(
        '  6. docs/guides/ holds 11 markdown files, which is no code folder',
      )
      ctx.log.info('Action:  /code-health')
      ctx.log.info(
        "Expect:  a table row per file, each finding marked 'measured' or 'read',",
      )
      ctx.log.info(
        '         with each checkpoint taken from the verb record rather than the skill body.',
      )
      ctx.log.info(
        "         The parse loop in runImport and the handlers' two roles are marked 'read'.",
      )
      ctx.log.info(
        '         The comment block finding asks whether it belongs and proposes no deletion.',
      )
      ctx.log.info(
        '         A folder line routes src/handlers/ to codebase-layout. docs/guides/ gets none.',
      )
      ctx.log.info(
        '         A trend section follows the table, and the reply names plan-intake as the next step.',
      )
      ctx.log.info(
        '         No verdict, no score, and every seeded file byte-identical after the run.',
      )
    },
  },
})
