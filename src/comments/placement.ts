import { functionBodies } from '@/code/length'

/**
 * Where a comment sits: `head` outside every function body, such as a JSDoc
 * block above a declaration or a note in a class or object literal, and
 * `body` inside one, a nested function's heading included.
 */
export type Placement = 'head' | 'body'

/**
 * Reads the placement of any offset in one TypeScript source. The bodies come
 * from the brace walk the function length report reads, since `typescript` is
 * a development dependency and this module ships inside the published CLI.
 */
export function placementReader(
  path: string,
  source: string,
): (offset: number) => Placement {
  const bodies = functionBodies(source, { jsx: path.endsWith('.tsx') })
  return (offset) =>
    bodies.some((body) => body.start < offset && offset < body.end)
      ? 'body'
      : 'head'
}
