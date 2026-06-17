import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import { enqueueMutation } from '@/db/idb'
import type { Database } from '@/db/types'

type Project = Database['public']['Tables']['projects']['Row']

interface ProjectStore {
  projects: Project[]
  activeProject: Project | null
  loading: boolean

  loadProjects: () => Promise<void>
  createProject: (name: string) => Promise<Project>
  setActiveProject: (project: Project) => void
  updateScratchpad: (projectId: string, content: string) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  activeProject: null,
  loading: false,

  loadProjects: async () => {
    set({ loading: true })
    const { data } = await supabase.from('projects').select('*').order('updated_at', { ascending: false })
    const projects = data ?? []
    set({ projects, activeProject: projects[0] ?? null, loading: false })
  },

  createProject: async (name) => {
    const { data, error } = await supabase
      .from('projects')
      .insert({ name, scratchpad_content: '' })
      .select()
      .single()
    if (error) throw error
    set(s => ({ projects: [data, ...s.projects], activeProject: data }))
    return data
  },

  setActiveProject: (project) => set({ activeProject: project }),

  updateScratchpad: async (projectId, content) => {
    const now = new Date().toISOString()
    set(s => ({
      activeProject: s.activeProject?.id === projectId
        ? { ...s.activeProject, scratchpad_content: content, updated_at: now }
        : s.activeProject,
    }))
    try {
      const { error } = await supabase
        .from('projects')
        .update({ scratchpad_content: content, updated_at: now })
        .eq('id', projectId)
      if (error) throw error
    } catch {
      await enqueueMutation('projects', 'upsert', {
        id: projectId,
        scratchpad_content: content,
        updated_at: now,
      })
    }
  },
}))
