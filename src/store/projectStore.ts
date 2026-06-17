import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import { enqueueMutation } from '@/db/idb'
import type { Database, ProjectClassification, ProjectStatus } from '@/db/types'

type Project = Database['public']['Tables']['projects']['Row']

interface ProjectStore {
  projects: Project[]
  activeProject: Project | null
  loading: boolean

  loadProjects: () => Promise<void>
  createProject: (name: string) => Promise<Project>
  updateProject: (id: string, updates: {
    name?: string
    description?: string
    classification?: ProjectClassification
    status?: ProjectStatus
    estimated_completion_date?: string | null
  }) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  setActiveProject: (project: Project | null) => void
  updateScratchpad: (projectId: string, content: string) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProject: null,
  loading: false,

  loadProjects: async () => {
    set({ loading: true })
    const { data } = await supabase.from('projects').select('*').order('updated_at', { ascending: false })
    const projects = data ?? []
    set({ projects, loading: false })
  },

  createProject: async (name) => {
    const { data, error } = await supabase
      .from('projects')
      .insert({ name, scratchpad_content: '', status: 'planning', classification: null, description: null, estimated_completion_date: null })
      .select()
      .single()
    if (error) throw error
    set(s => ({ projects: [data, ...s.projects], activeProject: data }))
    return data
  },

  updateProject: async (id, updates) => {
    const now = new Date().toISOString()
    set(s => ({
      projects: s.projects.map(p => p.id === id ? { ...p, ...updates, updated_at: now } : p),
      activeProject: s.activeProject?.id === id ? { ...s.activeProject, ...updates, updated_at: now } : s.activeProject,
    }))
    try {
      const { error } = await supabase.from('projects').update({ ...updates, updated_at: now }).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('projects', 'upsert', { id, ...updates, updated_at: now })
    }
  },

  deleteProject: async (id) => {
    set(s => ({
      projects: s.projects.filter(p => p.id !== id),
      activeProject: s.activeProject?.id === id ? null : s.activeProject,
    }))
    await supabase.from('projects').delete().eq('id', id)
  },

  setActiveProject: (project) => set({ activeProject: project }),

  updateScratchpad: async (projectId, content) => {
    const now = new Date().toISOString()
    set(s => ({
      projects: s.projects.map(p => p.id === projectId ? { ...p, scratchpad_content: content, updated_at: now } : p),
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
      await enqueueMutation('projects', 'upsert', { id: projectId, scratchpad_content: content, updated_at: now })
    }
  },
}))
