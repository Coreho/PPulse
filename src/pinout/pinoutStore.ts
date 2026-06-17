import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import type { Database } from '@/db/types'

type Pinout = Database['public']['Tables']['pinouts']['Row']

interface PinoutStore {
  pinouts: Pinout[]
  loading: boolean
  activeMcu: string

  setActiveMcu: (mcu: string) => void
  loadPinouts: (projectId: string) => Promise<void>
  addPinout: (p: Database['public']['Tables']['pinouts']['Insert']) => Promise<void>
  updatePinout: (id: string, u: Database['public']['Tables']['pinouts']['Update']) => Promise<void>
  deletePinout: (id: string) => Promise<void>
}

export const usePinoutStore = create<PinoutStore>((set, get) => ({
  pinouts: [],
  loading: false,
  activeMcu: 'pico',

  setActiveMcu: (mcu) => set({ activeMcu: mcu }),

  loadPinouts: async (projectId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('pinouts')
      .select('*')
      .eq('project_id', projectId)
      .order('variable_name')
    set({ pinouts: data ?? [], loading: false })
  },

  addPinout: async (p) => {
    const optimistic: Pinout = { ...p, id: crypto.randomUUID() }
    set(s => ({ pinouts: [...s.pinouts, optimistic] }))
    const { data, error } = await supabase.from('pinouts').insert(p).select().single()
    if (error) {
      set(s => ({ pinouts: s.pinouts.filter(x => x.id !== optimistic.id) }))
      return
    }
    set(s => ({ pinouts: s.pinouts.map(x => x.id === optimistic.id ? data : x) }))
  },

  updatePinout: async (id, u) => {
    set(s => ({ pinouts: s.pinouts.map(x => x.id === id ? { ...x, ...u } : x) }))
    await supabase.from('pinouts').update(u).eq('id', id)
  },

  deletePinout: async (id) => {
    set(s => ({ pinouts: s.pinouts.filter(x => x.id !== id) }))
    await supabase.from('pinouts').delete().eq('id', id)
  },
}))
