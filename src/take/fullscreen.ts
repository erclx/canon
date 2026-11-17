/**
 * The page script both routes inject before the page loads, answering a
 * fullscreen request without resizing the window. A real request in a headless
 * browser resizes the window to its 800x600 screen, which films a corner under
 * a log reading the viewport and stalls the stepped frame beside the release.
 *
 * The page is told it is fullscreen: `requestFullscreen` and `exitFullscreen`
 * resolve, `document.fullscreenElement` reads the element, and
 * `fullscreenchange` fires at it and bubbles to the document. The window never
 * changes, so a rule keyed on the `:fullscreen` pseudo-class, which only a
 * real request sets, does not apply.
 */
export const FULLSCREEN_SCRIPT = `(() => {
  let held = null
  const changed = (target) =>
    queueMicrotask(() =>
      (target.isConnected ? target : document).dispatchEvent(
        new Event('fullscreenchange', { bubbles: true, composed: true }),
      ),
    )
  Object.defineProperty(Document.prototype, 'fullscreenElement', {
    configurable: true,
    get: () => held,
  })
  Object.defineProperty(Document.prototype, 'fullscreenEnabled', {
    configurable: true,
    get: () => true,
  })
  Element.prototype.requestFullscreen = function () {
    held = this
    changed(this)
    return Promise.resolve()
  }
  Document.prototype.exitFullscreen = function () {
    if (held === null) {
      return Promise.reject(new TypeError('Not in fullscreen mode'))
    }
    const left = held
    held = null
    changed(left)
    return Promise.resolve()
  }
})()`
