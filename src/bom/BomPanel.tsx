import { useEffect, useState } from 'react'
import {
  Plus,
  Minus,
  Trash,
  PencilSimple,
  Check,
  X,
  Package,
} from '@phosphor-icons/react'
import { useBomStore } from './bomStore'
import { useProjectStore } from '@/store/projectStore'
import { useCardStore } from '@/store/cardStore'
import type { Database } from '@/db/types'

type BomItem = Database['public']['Tables']['bom_items']['Row']

// ── shared input style ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'var(--color-surface-0)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.25rem',
  padding: '4px 8px',
  fontSize: '12px',
  color: 'var(--color-text-primary)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
}

// ── stock level indicator ───────────────────────────────────────────────────

function StockBadge({ stock, required }: { stock: number; required: number }) {
  const color =
    stock === 0
      ? 'var(--color-danger)'
      : stock < required
      ? 'var(--color-warn)'
      : 'var(--color-success)'

  return (
    <span
      style={{
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        color,
        fontWeight: 600,
        minWidth: '36px',
        textAlign: 'right',
      }}
    >
      {stock}/{required}
    </span>
  )
}

// ── inline add / edit form ──────────────────────────────────────────────────

interface ItemFormProps {
  initial?: Partial<BomItem>
  cards: { id: string; title: string }[]
  onSave: (values: {
    name: string
    sku: string
    quantity_required: number
    quantity_stock: number
    unit: string
    bin_location: string
    linked_card_id: string | null
  }) => void
  onCancel: () => void
}

function ItemForm({ initial, cards, onSave, onCancel }: ItemFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [sku, setSku] = useState(initial?.sku ?? '')
  const [required, setRequired] = useState(String(initial?.quantity_required ?? 1))
  const [stock, setStock] = useState(String(initial?.quantity_stock ?? 0))
  const [unit, setUnit] = useState(initial?.unit ?? 'pcs')
  const [bin, setBin] = useState(initial?.bin_location ?? '')
  const [cardId, setCardId] = useState(initial?.linked_card_id ?? '')

  const valid = name.trim().length > 0

  return (
    <div
      style={{
        padding: '10px',
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <input
        style={inputStyle}
        placeholder="Part name *"
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <input style={inputStyle} placeholder="SKU / part #" value={sku} onChange={e => setSku(e.target.value)} />
        <input style={inputStyle} placeholder="Unit (pcs, g, m…)" value={unit} onChange={e => setUnit(e.target.value)} />
        <input style={inputStyle} type="number" placeholder="Required qty" min={0} value={required} onChange={e => setRequired(e.target.value)} />
        <input style={inputStyle} type="number" placeholder="Stock qty" min={0} value={stock} onChange={e => setStock(e.target.value)} />
        <input style={inputStyle} placeholder="Bin location" value={bin} onChange={e => setBin(e.target.value)} />

        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={cardId}
          onChange={e => setCardId(e.target.value)}
        >
          <option value="">No linked card</option>
          {cards.map(c => (
            <option key={c.id} value={c.id}>
              {c.title.slice(0, 40)}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            backgroundColor: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: '0.25rem',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() =>
            onSave({
              name: name.trim(),
              sku: sku.trim() || null as unknown as string,
              quantity_required: Math.max(0, parseInt(required, 10) || 1),
              quantity_stock: Math.max(0, parseInt(stock, 10) || 0),
              unit: unit.trim() || 'pcs',
              bin_location: bin.trim() || null as unknown as string,
              linked_card_id: cardId || null,
            })
          }
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#09090b',
            backgroundColor: valid ? 'var(--color-accent)' : 'var(--color-surface-3)',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: valid ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Check size={12} weight="bold" />
          Save
        </button>
      </div>
    </div>
  )
}

// ── single item row ─────────────────────────────────────────────────────────

interface ItemRowProps {
  item: BomItem
  cards: { id: string; title: string }[]
  onEdit: () => void
}

function ItemRow({ item, cards, onEdit }: ItemRowProps) {
  const { deleteItem, adjustStock } = useBomStore()
  const linkedCard = cards.find(c => c.id === item.linked_card_id)
  const isLow = item.quantity_stock < item.quantity_required

  return (
    <div
      style={{
        padding: '8px 10px',
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '0.375rem',
        border: `1px solid ${isLow ? 'rgba(251,146,60,0.3)' : 'var(--color-border-subtle)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
      }}
    >
      {/* Top row: name + stock controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
          {item.name}
        </span>

        {/* ± stock controls */}
        <button
          type="button"
          onClick={() => adjustStock(item.id, -1)}
          disabled={item.quantity_stock === 0}
          style={{
            width: '20px', height: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--color-border)',
            borderRadius: '0.25rem',
            backgroundColor: 'var(--color-surface-3)',
            color: 'var(--color-text-secondary)',
            cursor: item.quantity_stock === 0 ? 'not-allowed' : 'pointer',
            opacity: item.quantity_stock === 0 ? 0.4 : 1,
            flexShrink: 0,
          }}
          aria-label="Decrease stock"
        >
          <Minus size={10} weight="bold" />
        </button>

        <StockBadge stock={item.quantity_stock} required={item.quantity_required} />

        <button
          type="button"
          onClick={() => adjustStock(item.id, 1)}
          style={{
            width: '20px', height: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--color-border)',
            borderRadius: '0.25rem',
            backgroundColor: 'var(--color-surface-3)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Increase stock"
        >
          <Plus size={10} weight="bold" />
        </button>

        {/* actions */}
        <button
          type="button"
          onClick={onEdit}
          style={{
            width: '20px', height: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none',
            borderRadius: '0.25rem',
            backgroundColor: 'transparent',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Edit item"
        >
          <PencilSimple size={12} />
        </button>

        <button
          type="button"
          onClick={() => deleteItem(item.id)}
          style={{
            width: '20px', height: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none',
            borderRadius: '0.25rem',
            backgroundColor: 'transparent',
            color: 'var(--color-danger)',
            cursor: 'pointer',
            flexShrink: 0,
            opacity: 0.6,
          }}
          aria-label="Delete item"
        >
          <Trash size={12} />
        </button>
      </div>

      {/* Bottom row: meta badges */}
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
          {item.unit}
        </span>

        {item.sku && (
          <span
            style={{
              fontSize: '10px', fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)',
              backgroundColor: 'var(--color-surface-3)',
              padding: '1px 5px', borderRadius: '0.25rem',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {item.sku}
          </span>
        )}

        {item.bin_location && (
          <span
            style={{
              fontSize: '10px', fontFamily: 'var(--font-mono)',
              color: 'var(--color-accent)',
              backgroundColor: 'rgba(34,211,238,0.08)',
              padding: '1px 5px', borderRadius: '0.25rem',
              border: '1px solid rgba(34,211,238,0.2)',
            }}
          >
            {item.bin_location}
          </span>
        )}

        {linkedCard && (
          <span
            style={{
              fontSize: '10px',
              color: 'var(--color-text-secondary)',
              backgroundColor: 'var(--color-surface-3)',
              padding: '1px 5px', borderRadius: '0.25rem',
              border: '1px solid var(--color-border-subtle)',
              maxWidth: '100px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={linkedCard.title}
          >
            ↳ {linkedCard.title}
          </span>
        )}

        {isLow && (
          <span style={{ fontSize: '10px', color: 'var(--color-warn)', fontWeight: 600, marginLeft: 'auto' }}>
            LOW STOCK
          </span>
        )}
      </div>
    </div>
  )
}

// ── panel root ──────────────────────────────────────────────────────────────

export function BomPanel() {
  const { items, loading, loadItems, addItem, updateItem } = useBomStore()
  const { activeProject } = useProjectStore()
  const { cards } = useCardStore()

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (activeProject?.id) loadItems(activeProject.id)
  }, [activeProject?.id, loadItems])

  const cardOptions = cards.map(c => ({ id: c.id, title: c.title }))
  const projectId = activeProject?.id ?? ''

  const lowCount = items.filter(i => i.quantity_stock < i.quantity_required).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Package size={13} style={{ color: 'var(--color-text-muted)' }} />
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
          {lowCount > 0 && (
            <span
              style={{
                fontSize: '10px', fontWeight: 700,
                color: 'var(--color-warn)',
                backgroundColor: 'rgba(251,146,60,0.12)',
                padding: '1px 5px', borderRadius: '0.25rem',
              }}
            >
              {lowCount} LOW
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => { setShowAddForm(true); setEditingId(null) }}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px',
            fontSize: '11px', fontWeight: 600,
            color: 'var(--color-accent)',
            backgroundColor: 'rgba(34,211,238,0.1)',
            border: '1px solid rgba(34,211,238,0.3)',
            borderRadius: '0.25rem',
            cursor: 'pointer',
          }}
        >
          <Plus size={11} weight="bold" />
          Add
        </button>
      </div>

      {/* scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {showAddForm && (
          <ItemForm
            cards={cardOptions}
            onSave={async (values) => {
              if (!projectId) return
              await addItem({ project_id: projectId, ...values })
              setShowAddForm(false)
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {loading && items.length === 0 && (
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '24px' }}>
            Loading…
          </p>
        )}

        {!loading && items.length === 0 && !showAddForm && (
          <div
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '8px',
              color: 'var(--color-text-muted)',
              fontSize: '12px',
            }}
          >
            <Package size={28} style={{ opacity: 0.3 }} />
            <span>No BOM items yet</span>
          </div>
        )}

        {items.map(item =>
          editingId === item.id ? (
            <ItemForm
              key={item.id}
              initial={item}
              cards={cardOptions}
              onSave={async (values) => {
                await updateItem(item.id, values)
                setEditingId(null)
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <ItemRow
              key={item.id}
              item={item}
              cards={cardOptions}
              onEdit={() => { setEditingId(item.id); setShowAddForm(false) }}
            />
          )
        )}
      </div>
    </div>
  )
}
