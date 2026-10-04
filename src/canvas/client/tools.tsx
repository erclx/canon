/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { activeTool, shownTool, type Tool } from '@/canvas/client/state'

interface ToolButton {
  readonly tool: Tool
  readonly name: string
  readonly key: string
  readonly icon: JSX.Element
}

const TOOLS: readonly ToolButton[] = [
  {
    tool: 'move',
    name: 'Move',
    key: 'V',
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 2.5l9 4.2-3.9 1.2-1.4 3.8z" />
      </svg>
    ),
  },
  {
    tool: 'pan',
    name: 'Pan',
    key: 'H',
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M5.5 8.5V4a1 1 0 0 1 2 0v3.5M7.5 7V2.8a1 1 0 0 1 2 0V7M9.5 7V3.6a1 1 0 0 1 2 0V8M11.5 7.5a1 1 0 0 1 2 0v2.2A4.8 4.8 0 0 1 8.7 14.5h-.6a4.3 4.3 0 0 1-3.2-1.4L2.6 10.6a1 1 0 0 1 1.5-1.4l1.4 1.3" />
      </svg>
    ),
  },
]

/** The tool strip floating at the surface's left edge, one button a tool. */
export function ToolStrip(): JSX.Element {
  const shown = shownTool.value
  return (
    <div
      class="tools"
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
    >
      {TOOLS.map(({ tool, name, key, icon }) => (
        <button
          key={tool}
          type="button"
          class="tool-button"
          aria-label={`${name} (${key})`}
          aria-keyshortcuts={key}
          aria-pressed={shown === tool ? 'true' : 'false'}
          title={`${name} (${key})`}
          data-tool={tool}
          onClick={() => {
            activeTool.value = tool
          }}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}
