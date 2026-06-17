import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import { enqueueMutation } from '@/db/idb'
import type { Database, IssueSeverity, IssueStatus } from '@/db/types'

type Issue = Database['public']['Tables']['issues']['Row']

interface IssuesStore {
  issues: Issue[]
  loading: boolean
  loadIssues: (projectId: string) => Promise<void>
  addIssue: (projectId: string, title: string, severity: IssueSeverity) => Promise<void>
  updateIssue: (id: string, updates: { title?: string; description?: string; severity?: IssueSeverity; status?: IssueStatus }) => Promise<void>
  deleteIssue: (id: string) => Promise<void>
}

export const useIssuesStore = create<IssuesStore>((set, get) => ({
  issues: [],
  loading: false,

  loadIssues: async (projectId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('issues')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    set({ issues: data ?? [], loading: false })
  },

  addIssue: async (projectId, title, severity) => {
    const now = new Date().toISOString()
    const optimistic: Issue = {
      id: crypto.randomUUID(),
      project_id: projectId,
      title,
      description: null,
      severity,
      status: 'open',
      created_at: now,
      updated_at: now,
    }
    set(s => ({ issues: [optimistic, ...s.issues] }))
    try {
      const { data, error } = await supabase
        .from('issues')
        .insert({ project_id: projectId, title, severity, status: 'open', description: null })
        .select()
        .single()
      if (error) throw error
      set(s => ({ issues: s.issues.map(i => i.id === optimistic.id ? data : i) }))
    } catch {
      await enqueueMutation('issues', 'upsert', optimistic)
    }
  },

  updateIssue: async (id, updates) => {
    const now = new Date().toISOString()
    set(s => ({ issues: s.issues.map(i => i.id === id ? { ...i, ...updates, updated_at: now } : i) }))
    try {
      const { error } = await supabase.from('issues').update({ ...updates, updated_at: now }).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('issues', 'upsert', { id, ...updates, updated_at: now })
    }
  },

  deleteIssue: async (id) => {
    set(s => ({ issues: s.issues.filter(i => i.id !== id) }))
    try {
      await supabase.from('issues').delete().eq('id', id)
    } catch {
      await enqueueMutation('issues', 'delete', { id })
    }
  },
}))
