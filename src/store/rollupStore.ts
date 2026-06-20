import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import { completion, projectHealth, type ProjectRollup } from '@/store/rollups'

interface RollupStore {
  rollups: Record<string, ProjectRollup>
  loadRollups: (projects: { id: string; estimated_completion_date: string | null }[]) => Promise<void>
}

export const useRollupStore = create<RollupStore>((set) => ({
  rollups: {},

  loadRollups: async (projects) => {
    const [objRes, issRes, subRes] = await Promise.all([
      supabase.from('objectives').select('project_id, completed'),
      supabase.from('issues').select('project_id, status, severity'),
      supabase.from('sub_projects').select('project_id'),
    ])
    const objectives = (objRes.data ?? []) as { project_id: string; completed: boolean }[]
    const issues = (issRes.data ?? []) as { project_id: string; status: string; severity: string }[]
    const subs = (subRes.data ?? []) as { project_id: string }[]

    const rollups: Record<string, ProjectRollup> = {}
    for (const p of projects) {
      const projObjectives = objectives.filter(o => o.project_id === p.id)
      const done = projObjectives.filter(o => o.completed).length
      const openIssues = issues.filter(i => i.project_id === p.id && i.status !== 'closed')
      const hasHigh = openIssues.some(i => i.severity === 'high' || i.severity === 'critical')
      const subProjectCount = subs.filter(s => s.project_id === p.id).length

      rollups[p.id] = {
        completion: completion(done, projObjectives.length),
        openIssues: openIssues.length,
        subProjectCount,
        health: projectHealth({
          estimatedCompletionDate: p.estimated_completion_date,
          openIssues: openIssues.length,
          hasHighSeverityOpenIssue: hasHigh,
        }),
      }
    }
    set({ rollups })
  },
}))
