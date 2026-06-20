import { describe, it, expect, beforeEach, vi } from 'vitest'

const fromMock = vi.fn()
vi.mock('@/db/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))
vi.mock('@/db/idb', () => ({ enqueueMutation: vi.fn() }))

import { useProjectStore } from './projectStore'

beforeEach(() => {
  useProjectStore.setState({ projects: [
    { id: 'p1', name: 'A', is_pinned: false, archived_at: null } as never,
  ], activeProject: null, loading: false })
  fromMock.mockReset()
  fromMock.mockReturnValue({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) })
})

describe('projectStore master actions', () => {
  it('togglePin flips is_pinned optimistically', async () => {
    await useProjectStore.getState().togglePin('p1')
    expect((useProjectStore.getState().projects[0] as { is_pinned: boolean }).is_pinned).toBe(true)
  })

  it('archiveProject sets archived_at', async () => {
    await useProjectStore.getState().archiveProject('p1')
    expect((useProjectStore.getState().projects[0] as { archived_at: string | null }).archived_at).not.toBeNull()
  })
})
