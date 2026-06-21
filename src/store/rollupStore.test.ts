import { describe, it, expect, beforeEach, vi } from 'vitest'

const fromMock = vi.fn()
vi.mock('@/db/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))

import { useRollupStore } from './rollupStore'

function selectReturning(data: unknown[]) {
  return { select: () => Promise.resolve({ data }) }
}

beforeEach(() => {
  useRollupStore.setState({ rollups: {} })
  fromMock.mockReset()
})

describe('rollupStore', () => {
  it('computes completion, open issues and sub-project counts per project', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'objectives') return selectReturning([
        { project_id: 'p1', completed: true },
        { project_id: 'p1', completed: false },
      ])
      if (table === 'issues') return selectReturning([
        { project_id: 'p1', status: 'open', severity: 'low' },
      ])
      if (table === 'sub_projects') return selectReturning([
        { project_id: 'p1' }, { project_id: 'p1' },
      ])
      return selectReturning([])
    })
    await useRollupStore.getState().loadRollups([
      { id: 'p1', estimated_completion_date: null },
    ])
    const r = useRollupStore.getState().rollups['p1']
    expect(r.completion).toBe(0.5)
    expect(r.openIssues).toBe(1)
    expect(r.subProjectCount).toBe(2)
    expect(r.health).toBe('amber') // has an open issue
  })
})
