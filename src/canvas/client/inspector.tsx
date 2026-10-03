/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { selectedFrame, writeError } from '@/canvas/client/state'

const FIELDS = ['x', 'y', 'width', 'height'] as const

/** Read-only in this slice, since editing a box is the edit slice's work. */
export function Inspector(): JSX.Element {
  const frame = selectedFrame.value
  return (
    <section aria-label="Frame">
      <h2 class="section-label">Frame</h2>
      {frame ? (
        <>
          <p class="detail" title={frame.name}>
            {frame.name}
          </p>
          <dl class="box">
            {FIELDS.map((field) => (
              <div key={field} class="box-row">
                <dt>{field}</dt>
                <dd>{frame[field]}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p class="empty">Select a frame to see its box</p>
      )}
      {writeError.value ? (
        <p class="notice" role="alert">
          {writeError.value}
        </p>
      ) : null}
    </section>
  )
}
