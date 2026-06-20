import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import { enqueueMutation } from '@/db/idb'
import type { Database, CardColumn, StatusFlag } from '@/db/types'
import { useMachineStore } from '@/machines/machineStore'

type Card = Database['public']['Tables']['cards']['Row']

interface CardStore {
  cards: Card[]
  loading: boolean
  _bridgeUpdater: ((tag: string, title: string) => void) | null

  loadCards: (projectId: string, subProjectId?: string | null) => Promise<void>
  addCard: (card: Database['public']['Tables']['cards']['Insert']) => Promise<void>
  updateCard: (id: string, updates: Database['public']['Tables']['cards']['Update']) => Promise<void>
  moveCard: (id: string, column: CardColumn, position: number) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  addStatusFlag: (id: string, flag: StatusFlag) => void
  removeStatusFlag: (id: string, flag: StatusFlag) => void
  updateCardTitle: (scratchpadTag: string, title: string) => Promise<void>
  registerBridgeUpdater: (fn: ((tag: string, title: string) => void) | null) => void
}

export const useCardStore = create<CardStore>((set, get) => ({
  cards: [],
  loading: false,
  _bridgeUpdater: null,

  loadCards: async (projectId, subProjectId = null) => {
    set({ loading: true })
    let query = supabase.from('cards').select('*').eq('project_id', projectId)
    query = subProjectId ? query.eq('sub_project_id', subProjectId) : query.is('sub_project_id', null)
    const { data } = await query.order('position')
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
      // Accumulate machine hours from the session
      if (card.machine_id && card.machine_session_start) {
        const hours = (Date.now() - new Date(card.machine_session_start).getTime()) / 3_600_000
        if (hours > 0) {
          void useMachineStore.getState().logHours(card.machine_id, hours)
        }
      }
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

  updateCardTitle: async (scratchpadTag, title) => {
    const now = new Date().toISOString()
    const card = get().cards.find(c => c.scratchpad_tag === scratchpadTag)
    if (!card || card.title === title) return
    set(s => ({
      cards: s.cards.map(c =>
        c.scratchpad_tag === scratchpadTag ? { ...c, title, updated_at: now } : c,
      ),
    }))
    get()._bridgeUpdater?.(scratchpadTag, title)
    try {
      const { error } = await supabase
        .from('cards')
        .update({ title, updated_at: now })
        .eq('scratchpad_tag', scratchpadTag)
      if (error) throw error
    } catch {
      await enqueueMutation('cards', 'upsert', { scratchpad_tag: scratchpadTag, title, updated_at: now })
    }
  },

  registerBridgeUpdater: (fn) => set({ _bridgeUpdater: fn }),
}))
