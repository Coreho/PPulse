import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import { enqueueMutation } from '@/db/idb'
import type { Database } from '@/db/types'

type Objective = Database['public']['Tables']['objectives']['Row']

interface ObjectivesStore {
  objectives: Objective[]
  loading: boolean
  loadObjectives: (projectId: string) => Promise<void>
  addObjective: (projectId: string, title: string) => Promise<void>
  toggleObjective: (id: string) => Promise<void>
  updateObjective: (id: string, title: string) => Promise<void>
  deleteObjective: (id: string) => Promise<void>
}

export const useObjectivesStore = create<ObjectivesStore>((set, get) => ({
  objectives: [],
  loading: false,

  loadObjectives: async (projectId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('objectives')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true })
    set({ objectives: data ?? [], loading: false })
  },

  addObjective: async (projectId, title) => {
    const position = get().objectives.length
    const optimistic: Objective = {
      id: crypto.randomUUID(),
      project_id: projectId,
      title,
      completed: false,
      position,
      created_at: new Date().toISOString(),
    }
    set(s => ({ objectives: [...s.objectives, optimistic] }))
    try {
      const { data, error } = await supabase
        .from('objectives')
        .insert({ project_id: projectId, title, completed: false, position })
        .select()
        .single()
      if (error) throw error
      set(s => ({ objectives: s.objectives.map(o => o.id === optimistic.id ? data : o) }))
    } catch {
      await enqueueMutation('objectives', 'upsert', optimistic)
    }
  },

  toggleObjective: async (id) => {
    const obj = get().objectives.find(o => o.id === id)
    if (!obj) return
    const completed = !obj.completed
    set(s => ({ objectives: s.objectives.map(o => o.id === id ? { ...o, completed } : o) }))
    try {
      const { error } = await supabase.from('objectives').update({ completed }).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('objectives', 'upsert', { id, completed })
    }
  },

  updateObjective: async (id, title) => {
    set(s => ({ objectives: s.objectives.map(o => o.id === id ? { ...o, title } : o) }))
    try {
      const { error } = await supabase.from('objectives').update({ title }).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('objectives', 'upsert', { id, title })
    }
  },

  deleteObjective: async (id) => {
    set(s => ({ objectives: s.objectives.filter(o => o.id !== id) }))
    try {
      await supabase.from('objectives').delete().eq('id', id)
    } catch {
      await enqueueMutation('objectives', 'delete', { id })
    }
  },
}))
