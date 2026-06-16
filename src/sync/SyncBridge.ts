import { EditorView, ViewUpdate } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Root, Node, Parent } from 'mdast'
import { useCardStore } from '@/store/cardStore'

const TAG_REGEX = /<!-- pp-card:([a-f0-9-]+) -->/

interface AstWalkResult {
  uuid: string
  precedingText: string
}

function isParent(node: Node): node is Parent {
  return 'children' in node
}

function walkAst(tree: Root): AstWalkResult[] {
  const results: AstWalkResult[] = []

  function visit(node: Node): void {
    if (node.type === 'html') {
      const htmlNode = node as { type: 'html'; value: string }
      const match = TAG_REGEX.exec(htmlNode.value)
      if (match) {
        results.push({ uuid: match[1], precedingText: '' })
      }
    }

    if (isParent(node)) {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        if (child.type === 'html') {
          const htmlNode = child as { type: 'html'; value: string }
          const match = TAG_REGEX.exec(htmlNode.value)
          if (match) {
            // Get text from preceding sibling
            const preceding = i > 0 ? node.children[i - 1] : null
            let precedingText = ''
            if (preceding && 'value' in preceding && typeof (preceding as { value: unknown }).value === 'string') {
              precedingText = ((preceding as { value: string }).value).trim()
            }
            // Update last result with correct preceding text (avoid duplicate)
            const existing = results.find(r => r.uuid === match[1])
            if (existing) {
              existing.precedingText = precedingText
            } else {
              results.push({ uuid: match[1], precedingText })
            }
          }
        }
        visit(child)
      }
    }
  }

  // Walk top-level
  for (let i = 0; i < tree.children.length; i++) {
    const child = tree.children[i]
    if (child.type === 'html') {
      const htmlNode = child as { type: 'html'; value: string }
      const match = TAG_REGEX.exec(htmlNode.value)
      if (match) {
        const preceding = i > 0 ? tree.children[i - 1] : null
        let precedingText = ''
        if (preceding) {
          // Extract text from paragraph or heading
          if ('children' in preceding) {
            const textNode = (preceding as Parent).children.find(
              n => 'value' in n && typeof (n as { value: unknown }).value === 'string',
            )
            if (textNode && 'value' in textNode) {
              precedingText = String((textNode as { value: string }).value).trim()
            }
          } else if ('value' in preceding) {
            precedingText = String((preceding as { value: string }).value).trim()
          }
        }
        const existing = results.find(r => r.uuid === match[1])
        if (existing) {
          existing.precedingText = precedingText
        } else {
          results.push({ uuid: match[1], precedingText })
        }
      }
    }
  }

  return results
}

export class SyncBridge {
  private view: EditorView
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private unsubscribe: (() => void) | null = null

  constructor(view: EditorView) {
    this.view = view
  }

  handleUpdate(update: ViewUpdate): void {
    if (!update.docChanged) return
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => this.syncToStore(), 500)
  }

  private syncToStore(): void {
    const content = this.view.state.doc.toString()
    const processor = unified().use(remarkParse).use(remarkGfm)
    const tree = processor.parse(content) as Root

    const results = walkAst(tree)
    const store = useCardStore.getState()

    for (const { uuid, precedingText } of results) {
      const card = store.cards.find(c => c.scratchpad_tag === uuid)
      if (!card) {
        // Orphan tag — remove from editor
        this.removeOrphanTag(uuid)
        continue
      }
      if (precedingText && card.title !== precedingText) {
        store.updateCardTitle(uuid, precedingText)
      }
    }
  }

  private removeOrphanTag(uuid: string): void {
    const content = this.view.state.doc.toString()
    const tag = `<!-- pp-card:${uuid} -->`
    const idx = content.indexOf(tag)
    if (idx === -1) return

    const from = idx
    const to = idx + tag.length

    // Also remove the newline if present
    const docLength = this.view.state.doc.length
    const end = to < docLength && content[to] === '\n' ? to + 1 : to

    this.view.dispatch({
      changes: { from, to: end, insert: '' },
    })
  }

  updateLine(scratchpadTag: string, newTitle: string): void {
    const content = this.view.state.doc.toString()
    const tag = `<!-- pp-card:${scratchpadTag} -->`
    const tagIdx = content.indexOf(tag)
    if (tagIdx === -1) return

    // Find the start of the line before the tag
    const linesBefore = content.slice(0, tagIdx).split('\n')
    if (linesBefore.length < 2) return

    const precedingLineText = linesBefore[linesBefore.length - 1]
    const precedingLineStart = tagIdx - precedingLineText.length

    this.view.dispatch({
      changes: {
        from: precedingLineStart,
        to: precedingLineStart + precedingLineText.length,
        insert: newTitle,
      },
    })
  }

  destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (this.unsubscribe) this.unsubscribe()
  }
}

export function useSyncBridge(editorView: EditorView | null): void {
  const bridgeRef = useRef<SyncBridge | null>(null)

  useEffect(() => {
    if (!editorView) return

    const bridge = new SyncBridge(editorView)
    bridgeRef.current = bridge

    // Listen to editor updates by extending the editor
    const extension = EditorView.updateListener.of((update: ViewUpdate) => {
      bridge.handleUpdate(update)
    })

    editorView.dispatch({
      effects: [],
    })

    // Since we can't add extensions after init via dispatch alone,
    // the bridge's handleUpdate is called from the Scratchpad component
    // via the updateListener extension. Store ref for external access.
    bridgeRef.current = bridge

    return () => {
      bridge.destroy()
      bridgeRef.current = null
    }
  }, [editorView])
}
