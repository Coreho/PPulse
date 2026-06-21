import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import { enqueueMutation } from '@/db/idb'
import type { Database } from '@/db/types'

type SubProject = Database['public']['Tables']['sub_projects']['Row']

interface SubProjectStore {
  subProjects: SubProject[]
  loading: boolean
  loadSubProjects: (projectId: string) => Promise<void>
  addSubProject: (projectId: string, name: string) => Promise<void>
  renameSubProject: (id: string, name: string) => Promise<void>
  deleteSubProject: (id: string) => Promise<void>
}

export const useSubProjectStore = create<SubProjectStore>((set, get) => ({
  subProjects: [],
  loading: false,

  loadSubProjects: async (projectId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('sub_projects')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true })
    set({ subProjects: data ?? [], loading: false })
  },

  addSubProject: async (projectId, name) => {
    const position = get().subProjects.length
    const optimistic: SubProject = {
      id: crypto.randomUUID(),
      owner_id: null,
      project_id: projectId,
      name,
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    set(s => ({ subProjects: [...s.subProjects, optimistic] }))
    try {
      const { data, error } = await supabase
        .from('sub_projects')
        .insert({ project_id: projectId, name, position })
        .select()
        .single()
      if (error) throw error
      set(s => ({ subProjects: s.subProjects.map(sp => sp.id === optimistic.id ? data : sp) }))
    } catch {
      await enqueueMutation('sub_projects', 'upsert', optimistic)
    }
  },

  renameSubProject: async (id, name) => {
    set(s => ({ subProjects: s.subProjects.map(sp => sp.id === id ? { ...sp, name } : sp) }))
    try {
      const { error } = await supabase.from('sub_projects').update({ name }).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('sub_projects', 'upsert', { id, name })
    }
  },

  deleteSubProject: async (id) => {
    set(s => ({ subProjects: s.subProjects.filter(sp => sp.id !== id) }))
    try {
      const { error } = await supabase.from('sub_projects').delete().eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('sub_projects', 'delete', { id })
    }
  },
}))
