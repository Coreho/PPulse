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
  createProject: (name: string, classification?: ProjectClassification | null, status?: ProjectStatus) => Promise<Project>
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
  togglePin: (id: string) => Promise<void>
  archiveProject: (id: string) => Promise<void>
  unarchiveProject: (id: string) => Promise<void>
  duplicateProject: (id: string) => Promise<void>
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

  createProject: async (name, classification = null, status = 'planning') => {
    const { data, error } = await supabase
      .from('projects')
      .insert({ name, scratchpad_content: '', status, classification: classification ?? null, description: null, estimated_completion_date: null })
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

  togglePin: async (id) => {
    const proj = get().projects.find(p => p.id === id)
    if (!proj) return
    const is_pinned = !(proj as { is_pinned?: boolean }).is_pinned
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, is_pinned } : p) }))
    try {
      const { error } = await supabase.from('projects').update({ is_pinned }).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('projects', 'upsert', { id, is_pinned })
    }
  },

  archiveProject: async (id) => {
    const archived_at = new Date().toISOString()
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, archived_at } : p) }))
    try {
      const { error } = await supabase.from('projects').update({ archived_at }).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('projects', 'upsert', { id, archived_at })
    }
  },

  unarchiveProject: async (id) => {
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, archived_at: null } : p) }))
    try {
      const { error } = await supabase.from('projects').update({ archived_at: null }).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('projects', 'upsert', { id, archived_at: null })
    }
  },

  duplicateProject: async (id) => {
    const src = get().projects.find(p => p.id === id)
    if (!src) return
    const { data: newProj, error } = await supabase
      .from('projects')
      .insert({
        name: `${src.name} (copy)`,
        description: src.description ?? null,
        classification: (src as { classification?: string | null }).classification ?? null,
        status: (src as { status?: string }).status ?? 'planning',
        estimated_completion_date: (src as { estimated_completion_date?: string | null }).estimated_completion_date ?? null,
        scratchpad_content: (src as { scratchpad_content?: string | null }).scratchpad_content ?? '',
      })
      .select()
      .single()
    if (error || !newProj) return

    // sub_projects: map old id -> new id
    const { data: subs } = await supabase.from('sub_projects').select('*').eq('project_id', id)
    const subIdMap = new Map<string, string>()
    for (const sp of subs ?? []) {
      const { data: newSub } = await supabase.from('sub_projects')
        .insert({ project_id: newProj.id, name: sp.name, position: sp.position })
        .select().single()
      if (newSub) subIdMap.set(sp.id, newSub.id)
    }

    const remap = (oldSub: string | null) => (oldSub ? subIdMap.get(oldSub) ?? null : null)

    const { data: objectives } = await supabase.from('objectives').select('*').eq('project_id', id)
    for (const o of objectives ?? []) {
      await supabase.from('objectives').insert({
        project_id: newProj.id, sub_project_id: remap(o.sub_project_id),
        title: o.title, completed: o.completed, position: o.position,
      })
    }

    const { data: cards } = await supabase.from('cards').select('*').eq('project_id', id)
    for (const c of cards ?? []) {
      const rest = { ...c } as Record<string, unknown>
      delete rest.id
      delete rest.created_at
      delete rest.updated_at
      await supabase.from('cards').insert({ ...rest, project_id: newProj.id, sub_project_id: remap(c.sub_project_id), blocked_by: [] } as never)
    }

    set(s => ({ projects: [newProj, ...s.projects] }))
  },
}))
