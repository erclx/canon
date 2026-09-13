/**
 * Bun resolves this module rather than `jsx-runtime` at run time (spike 1,
 * `.canon/groundwork/56-teach-render-layer/08-spikes.md`), so every export a
 * caller might reach through either entry point has to exist here too.
 */
export {
  Fragment,
  jsx,
  jsx as jsxDEV,
  jsxs,
  render,
  type JSX,
} from './jsx-runtime'
