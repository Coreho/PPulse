import { describe, it, expect, beforeEach, vi } from 'vitest'

const insertSingle = vi.fn()
const fromMock = vi.fn()
vi.mock('@/db/supabase', () => ({
  supabase: { from: (...a: unknown[]) => fromMock(...a) },
}))
vi.mock('@/db/idb', () => ({ enqueueMutation: vi.fn() }))

import { useSubProjectStore } from './subProjectStore'

beforeEach(() => {
  useSubProjectStore.setState({ subProjects: [], loading: false })
  fromMock.mockReset()
  insertSingle.mockReset()
})

describe('subProjectStore', () => {
  it('addSubProject inserts and stores the returned row', async () => {
    const row = { id: 'sp1', project_id: 'p1', name: 'Firmware', position: 0,
      owner_id: null, created_at: 'now', updated_at: 'now' }
    fromMock.mockReturnValue({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) }),
    })
    await useSubProjectStore.getState().addSubProject('p1', 'Firmware')
    expect(useSubProjectStore.getState().subProjects).toHaveLength(1)
    expect(useSubProjectStore.getState().subProjects[0].name).toBe('Firmware')
  })

  it('deleteSubProject removes it optimistically', async () => {
    useSubProjectStore.setState({ subProjects: [
      { id: 'sp1', project_id: 'p1', name: 'A', position: 0, owner_id: null, created_at: '', updated_at: '' },
    ] })
    fromMock.mockReturnValue({ delete: () => ({ eq: () => Promise.resolve({ error: null }) }) })
    await useSubProjectStore.getState().deleteSubProject('sp1')
    expect(useSubProjectStore.getState().subProjects).toHaveLength(0)
  })
})
