type BrowserFunction = (...args: never[]) => unknown

const transpiler = new Bun.Transpiler({ loader: 'ts' })

const MODULE_SYNTAX = /^\s*(import|export)\b/m

/**
 * `</script>` inside a serialized argument would end the block early, and
 * `<` is the same character to the JavaScript parser.
 */
function serialize(args: readonly unknown[]): string {
  return JSON.stringify(args).slice(1, -1).replace(/</g, '\\u003c')
}

/**
 * Turns a browser module's function into the `<script>` a page carries. The
 * transpiler does not bundle, so a module is self-contained: whatever it
 * calls but does not define arrives as a named function in `helpers`, and a
 * value it needs arrives in `args`. Output holding module syntax throws, since
 * a script block with an `import` fails in the browser with nothing in the
 * type checker to say so.
 */
export function compileScript(
  run: BrowserFunction,
  args: readonly unknown[] = [],
  helpers: readonly BrowserFunction[] = [],
): string {
  const source = helpers.length
    ? `(function () {\n${helpers.map(String).join('\n')}\nreturn ${run};\n})()`
    : String(run)
  // A bare expression statement is dead code to the transpiler and comes back
  // empty, so the source rides an export that it must keep.
  const code = transpiler
    .transformSync(`export default ${source}`)
    .trim()
    .replace(/^export default /, '')
    .replace(/;$/, '')

  if (MODULE_SYNTAX.test(code)) {
    throw new Error(`Browser module ${run.name} left import or export syntax`)
  }

  return `<script>(${code})(${serialize(args)})</script>`
}
