/* Spliced in by `canon teach up` at serve time and never written to a page, so
   the server sends a message only once a refresh has landed on disk. */
export function reload(path: string): void {
  var source = new EventSource(path)
  source.onmessage = function () {
    source.close()
    location.reload()
  }
}
