/**
 * The page script both routes inject before load, answering a fullscreen request
 * without resizing the window, since a real request in a headless browser resizes
 * it to 800x600. A rule keyed on `:fullscreen`, which only a real request sets, does not apply.
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
