/** @jsxImportSource preact */
import type { JSX } from 'preact'
import {
  activeTool,
  history,
  panelsHidden,
  redo,
  shownTool,
  type Tool,
  togglePanels,
  undo,
} from '@/canvas/client/state'

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

interface HistoryButton {
  readonly name: 'Undo' | 'Redo'
  readonly shortcut: string
  readonly keys: string
  readonly run: () => Promise<void>
  readonly icon: JSX.Element
}

const HISTORY_BUTTONS: readonly HistoryButton[] = [
  {
    name: 'Undo',
    shortcut: 'Ctrl+Z',
    keys: 'Control+Z Meta+Z',
    run: () => undo(),
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M5.5 3.5L2.5 6.5l3 3M2.5 6.5h7a4 4 0 0 1 0 8H7" />
      </svg>
    ),
  },
  {
    name: 'Redo',
    shortcut: 'Ctrl+Shift+Z',
    keys: 'Control+Shift+Z Meta+Shift+Z Control+Y',
    run: () => redo(),
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M10.5 3.5l3 3-3 3M13.5 6.5h-7a4 4 0 0 0 0 8H9" />
      </svg>
    ),
  },
]

/**
 * The tool strip floating at the surface's left edge, one button a tool, then
 * undo and redo, each disabled while the server holds nothing to step.
 */
export function ToolStrip(): JSX.Element {
  const shown = shownTool.value
  const { canUndo, canRedo } = history.value
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
      <span class="tools-divider" aria-hidden="true" />
      {HISTORY_BUTTONS.map(({ name, shortcut, keys, run, icon }) => (
        <button
          key={name}
          type="button"
          class="tool-button"
          aria-label={`${name} (${shortcut})`}
          aria-keyshortcuts={keys}
          title={`${name} (${shortcut})`}
          disabled={name === 'Undo' ? !canUndo : !canRedo}
          onClick={() => void run()}
        >
          {icon}
        </button>
      ))}
      <span class="tools-divider" aria-hidden="true" />
      <PanelsButton />
    </div>
  )
}

/** Named by what a press does now, so the panels come back by mouse too. */
function PanelsButton(): JSX.Element {
  const name = panelsHidden.value ? 'Show panels' : 'Hide panels'
  return (
    <button
      type="button"
      class="tool-button"
      aria-label={`${name} (\\)`}
      aria-keyshortcuts="\\"
      title={`${name} (\\)`}
      data-panels={panelsHidden.value ? 'hidden' : 'shown'}
      onClick={togglePanels}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2" y="3" width="12" height="10" rx="1.5" />
        {panelsHidden.value ? null : <path d="M5.5 3v10M10.5 3v10" />}
      </svg>
    </button>
  )
}
