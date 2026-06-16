import { useCallback, useEffect, useRef, useState } from 'react'
import {
  EditorView,
  ViewUpdate,
  Decoration,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view'
import { EditorState, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { useCardStore } from '@/store/cardStore'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { SyncBridge } from '@/sync/SyncBridge'
import { NotePencil } from '@phosphor-icons/react'

// ---- Card tag decoration ----

const TAG_REGEX = /<!-- pp-card:([a-f0-9-]+) -->/g

class CardTagWidget extends WidgetType {
  constructor(private readonly uuid: string) {
    super()
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 3px;
      opacity: 0.5;
      font-size: 10px;
      color: #22d3ee;
      font-family: var(--font-mono), monospace;
      margin-left: 6px;
      pointer-events: none;
      user-select: none;
    `
    span.innerHTML = `<svg width="10" height="10" viewBox="0 0 256 256" fill="currentColor"><path d="M224,72H184V48a8,8,0,0,0-8-8H80a8,8,0,0,0-8,8V72H32A16,16,0,0,0,16,88V200a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V88A16,16,0,0,0,224,72ZM88,56h80V72H88ZM224,200H32V88H224Z"/></svg>`
    span.setAttribute('aria-label', `Card ${this.uuid.slice(0, 8)}`)
    return span
  }

  eq(other: CardTagWidget): boolean {
    return this.uuid === other.uuid
  }
}

const tagDecorationField = StateField.define<DecorationSet>({
  create(state) {
    return buildTagDecorations(state.doc.toString())
  },
  update(deco, tr) {
    if (!tr.docChanged) return deco
    return buildTagDecorations(tr.newDoc.toString())
  },
  provide: f => EditorView.decorations.from(f),
})

function buildTagDecorations(content: string): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const matches: { from: number; to: number; uuid: string }[] = []

  let match: RegExpExecArray | null
  TAG_REGEX.lastIndex = 0
  while ((match = TAG_REGEX.exec(content)) !== null) {
    matches.push({ from: match.index, to: match.index + match[0].length, uuid: match[1] })
  }

  matches.sort((a, b) => a.from - b.from)

  for (const { from, to, uuid } of matches) {
    builder.add(from, to, Decoration.replace({ widget: new CardTagWidget(uuid) }))
  }

  return builder.finish()
}

// ---- Dark theme ----

const ppTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '14px',
      fontFamily: 'var(--font-mono), monospace',
      backgroundColor: '#09090b',
      color: '#fafafa',
    },
    '.cm-content': {
      padding: '16px',
      caretColor: '#22d3ee',
      lineHeight: '1.7',
    },
    '.cm-focused': { outline: 'none' },
    '.cm-line': { padding: '0' },
    '.cm-cursor': {
      borderLeftColor: '#22d3ee',
    },
    '.cm-selectionBackground': {
      backgroundColor: '#083344 !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: '#083344 !important',
    },
    '.cm-gutters': { display: 'none' },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-placeholder': { color: '#71717a' },
  },
  { dark: true },
)

// ---- Pinout trigger ----

const detectPinoutEffect = StateEffect.define<void>()

// ---- Floating "Create Card" button ----

interface FloatingButtonState {
  visible: boolean
  x: number
  y: number
  selectedText: string
}

// ---- Component ----

interface ScratchpadProps {
  projectId: string
  initialContent?: string
}

export function Scratchpad({ projectId, initialContent = '' }: ScratchpadProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<EditorView | null>(null)
  const bridgeRef = useRef<SyncBridge | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { addCard } = useCardStore()
  const { updateScratchpad } = useProjectStore()
  const { openPinout } = useUIStore()

  const [floatBtn, setFloatBtn] = useState<FloatingButtonState>({
    visible: false,
    x: 0,
    y: 0,
    selectedText: '',
  })

  const debouncedSave = useCallback(
    (content: string) => {
      if (!projectId) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        updateScratchpad(projectId, content)
      }, 1000)
    },
    [projectId, updateScratchpad],
  )

  const createCardFromSelection = useCallback(
    async (selectedText: string, view: EditorView) => {
      const uuid = crypto.randomUUID()
      const tag = `<!-- pp-card:${uuid} -->`

      const { state } = view
      const selection = state.selection.main
      const line = state.doc.lineAt(selection.to)
      const insertPos = line.to

      view.dispatch({
        changes: {
          from: insertPos,
          to: insertPos,
          insert: '\n' + tag,
        },
      })

      await addCard({
        project_id: projectId,
        type: 'software',
        title: selectedText.slice(0, 200),
        description: null,
        column: 'backlog',
        position: 0,
        scratchpad_tag: uuid,
        meta: null,
        blocked_by: [],
        bom_item_id: null,
        machine_id: null,
        target_timestamp: null,
        status_flags: [],
        machine_session_start: null,
      })

      setFloatBtn(prev => ({ ...prev, visible: false }))
    },
    [projectId, addCard],
  )

  useEffect(() => {
    if (!containerRef.current) return

    const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
      // Autosave
      if (update.docChanged) {
        const content = update.state.doc.toString()
        debouncedSave(content)

        // Detect @pinout typed
        const text = update.state.doc.toString()
        const selection = update.state.selection.main
        const lineText = update.state.doc.lineAt(selection.head).text
        if (lineText.includes('@pinout')) {
          openPinout(null)
        }

        // Bridge sync
        if (bridgeRef.current) {
          bridgeRef.current.handleUpdate(update)
        }
      }

      // Floating create card button on selection
      if (!update.selectionSet && !update.docChanged) return
      const selection = update.state.selection.main
      if (selection.empty) {
        setFloatBtn(prev => (prev.visible ? { ...prev, visible: false } : prev))
        return
      }

      const selectedText = update.state.sliceDoc(selection.from, selection.to).trim()
      if (!selectedText) {
        setFloatBtn(prev => (prev.visible ? { ...prev, visible: false } : prev))
        return
      }

      // Position near the cursor
      const coords = update.view.coordsAtPos(selection.to)
      if (!coords || !containerRef.current) {
        setFloatBtn(prev => (prev.visible ? { ...prev, visible: false } : prev))
        return
      }

      const containerRect = containerRef.current.getBoundingClientRect()
      setFloatBtn({
        visible: true,
        x: coords.left - containerRect.left,
        y: coords.bottom - containerRect.top + 6,
        selectedText,
      })
    })

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        history(),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        ppTheme,
        tagDecorationField,
        updateListener,
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    editorRef.current = view
    bridgeRef.current = new SyncBridge(view)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      bridgeRef.current?.destroy()
      view.destroy()
      editorRef.current = null
      bridgeRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally excluding deps — editor is initialized once

  // Update editor content when initialContent prop changes from external source
  useEffect(() => {
    const view = editorRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === initialContent) return
    view.dispatch({
      changes: { from: 0, to: current.length, insert: initialContent },
    })
  }, [initialContent])

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
        aria-label="Scratchpad editor"
      />

      {floatBtn.visible && (
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault()
            if (editorRef.current) {
              createCardFromSelection(floatBtn.selectedText, editorRef.current)
            }
          }}
          style={{
            position: 'absolute',
            left: Math.min(floatBtn.x, (containerRef.current?.clientWidth ?? 400) - 140),
            top: floatBtn.y,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#09090b',
            backgroundColor: 'var(--color-accent)',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
          aria-label="Create card from selection"
        >
          <NotePencil size={13} weight="bold" />
          Create Card
        </button>
      )}
    </div>
  )
}
