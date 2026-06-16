import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import { enqueueMutation } from '@/db/idb'
import type { Database, CardColumn, StatusFlag } from '@/db/types'

type Card = Database['public']['Tables']['cards']['Row']

interface CardStore {
  cards: Card[]
  loading: boolean

  loadCards: (projectId: string) => Promise<void>
  addCard: (card: Database['public']['Tables']['cards']['Insert']) => Promise<void>
  updateCard: (id: string, updates: Database['public']['Tables']['cards']['Update']) => Promise<void>
  moveCard: (id: string, column: CardColumn, position: number) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  addStatusFlag: (id: string, flag: StatusFlag) => void
  removeStatusFlag: (id: string, flag: StatusFlag) => void
  updateCardTitle: (scratchpadTag: string, title: string) => void
}

export const useCardStore = create<CardStore>((set, get) => ({
  cards: [],
  loading: false,

  loadCards: async (projectId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('cards')
      .select('*')
      .eq('project_id', projectId)
      .order('position')
    set({ cards: data ?? [], loading: false })
  },

  addCard: async (card) => {
    const optimistic = { ...card, id: crypto.randomUUID(), status_flags: [], blocked_by: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Card
    set(s => ({ cards: [...s.cards, optimistic] }))

    const { data, error } = await supabase.from('cards').insert(card).select().single()
    if (error) {
      await enqueueMutation('cards', 'upsert', card as Record<string, unknown>)
      return
    }
    set(s => ({ cards: s.cards.map(c => c.id === optimistic.id ? data : c) }))
  },

  updateCard: async (id, updates) => {
    const now = new Date().toISOString()
    set(s => ({ cards: s.cards.map(c => c.id === id ? { ...c, ...updates, updated_at: now } : c) }))

    const { error } = await supabase.from('cards').update({ ...updates, updated_at: now }).eq('id', id)
    if (error) await enqueueMutation('cards', 'upsert', { id, ...updates, updated_at: now } as Record<string, unknown>)
  },

  moveCard: async (id, column, position) => {
    const card = get().cards.find(c => c.id === id)
    if (!card) return

    const previousColumn = card.column
    const now = new Date().toISOString()

    const updates: Partial<Card> = { column, position, updated_at: now }

    if (column === 'in_progress' && previousColumn !== 'in_progress') {
      updates.machine_session_start = now
    }
    if (previousColumn === 'in_progress' && column !== 'in_progress') {
      updates.machine_session_start = null
    }

    set(s => ({ cards: s.cards.map(c => c.id === id ? { ...c, ...updates } : c) }))
    const { error } = await supabase.from('cards').update(updates).eq('id', id)
    if (error) await enqueueMutation('cards', 'upsert', { id, ...updates } as Record<string, unknown>)
  },

  deleteCard: async (id) => {
    set(s => ({ cards: s.cards.filter(c => c.id !== id) }))
    await supabase.from('cards').delete().eq('id', id)
  },

  addStatusFlag: (id, flag) => {
    set(s => ({
      cards: s.cards.map(c =>
        c.id === id && !c.status_flags.includes(flag)
          ? { ...c, status_flags: [...c.status_flags, flag] }
          : c,
      ),
    }))
  },

  removeStatusFlag: (id, flag) => {
    set(s => ({
      cards: s.cards.map(c =>
        c.id === id ? { ...c, status_flags: c.status_flags.filter(f => f !== flag) } : c,
      ),
    }))
  },

  updateCardTitle: (scratchpadTag, title) => {
    const now = new Date().toISOString()
    const card = get().cards.find(c => c.scratchpad_tag === scratchpadTag)
    if (!card || card.title === title) return
    set(s => ({
      cards: s.cards.map(c =>
        c.scratchpad_tag === scratchpadTag ? { ...c, title, updated_at: now } : c,
      ),
    }))
    supabase.from('cards').update({ title, updated_at: now }).eq('scratchpad_tag', scratchpadTag)
  },
}))
