import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import { useCardStore } from '@/store/cardStore'
import type { Database } from '@/db/types'

type BomItem = Database['public']['Tables']['bom_items']['Row']

interface BomStore {
  items: BomItem[]
  loading: boolean

  loadItems: (projectId: string) => Promise<void>
  addItem: (item: Database['public']['Tables']['bom_items']['Insert']) => Promise<void>
  updateItem: (id: string, updates: Database['public']['Tables']['bom_items']['Update']) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  adjustStock: (id: string, delta: number) => Promise<void>
}

function syncLowStock(item: BomItem) {
  if (!item.linked_card_id) return
  const cardStore = useCardStore.getState()
  if (item.quantity_stock < item.quantity_required) {
    cardStore.addStatusFlag(item.linked_card_id, 'low_stock')
  } else {
    cardStore.removeStatusFlag(item.linked_card_id, 'low_stock')
  }
}

export const useBomStore = create<BomStore>((set, get) => ({
  items: [],
  loading: false,

  loadItems: async (projectId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('bom_items')
      .select('*')
      .eq('project_id', projectId)
      .order('name')
    const items = data ?? []
    set({ items, loading: false })
    items.forEach(syncLowStock)
  },

  addItem: async (item) => {
    const optimistic: BomItem = {
      ...item,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    set(s => ({ items: [...s.items, optimistic] }))
    syncLowStock(optimistic)

    const { data, error } = await supabase.from('bom_items').insert(item).select().single()
    if (error) return
    set(s => ({ items: s.items.map(i => i.id === optimistic.id ? data : i) }))
    syncLowStock(data)
  },

  updateItem: async (id, updates) => {
    const now = new Date().toISOString()
    set(s => ({
      items: s.items.map(i => i.id === id ? { ...i, ...updates, updated_at: now } : i),
    }))
    const updated = get().items.find(i => i.id === id)
    if (updated) syncLowStock(updated)

    await supabase.from('bom_items').update({ ...updates, updated_at: now }).eq('id', id)
  },

  deleteItem: async (id) => {
    const item = get().items.find(i => i.id === id)
    set(s => ({ items: s.items.filter(i => i.id !== id) }))
    if (item?.linked_card_id) {
      useCardStore.getState().removeStatusFlag(item.linked_card_id, 'low_stock')
    }
    await supabase.from('bom_items').delete().eq('id', id)
  },

  adjustStock: async (id, delta) => {
    const item = get().items.find(i => i.id === id)
    if (!item) return
    const newStock = Math.max(0, item.quantity_stock + delta)
    await get().updateItem(id, { quantity_stock: newStock })
  },
}))
