import { EditorView, ViewUpdate } from '@codemirror/view'
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

function extractPrecedingText(parent: Parent, index: number): string {
  if (index === 0) return ''
  const preceding = parent.children[index - 1]
  if ('children' in preceding) {
    const textNode = (preceding as Parent).children.find(
      n => 'value' in n && typeof (n as { value: unknown }).value === 'string',
    )
    if (textNode && 'value' in textNode) return String((textNode as { value: string }).value).trim()
  } else if ('value' in preceding) {
    return String((preceding as { value: string }).value).trim()
  }
  return ''
}

function walkAst(tree: Root): AstWalkResult[] {
  const results: AstWalkResult[] = []

  function visit(parent: Parent): void {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i]
      if (child.type === 'html') {
        const match = TAG_REGEX.exec((child as { type: 'html'; value: string }).value)
        if (match) {
          const uuid = match[1]
          const precedingText = extractPrecedingText(parent, i)
          const existing = results.find(r => r.uuid === uuid)
          if (existing) {
            existing.precedingText = precedingText
          } else {
            results.push({ uuid, precedingText })
          }
        }
      }
      if (isParent(child)) visit(child)
    }
  }

  visit(tree)
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

