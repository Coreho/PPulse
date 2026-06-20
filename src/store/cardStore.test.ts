import { describe, it, expect, beforeEach, vi } from 'vitest'

const fromMock = vi.fn()
vi.mock('@/db/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))
vi.mock('@/db/idb', () => ({ enqueueMutation: vi.fn() }))
vi.mock('@/machines/machineStore', () => ({ useMachineStore: { getState: () => ({ logHours: vi.fn() }) } }))

import { useCardStore } from './cardStore'

beforeEach(() => {
  useCardStore.setState({ cards: [], loading: false })
  fromMock.mockReset()
})

describe('cardStore scope', () => {
  it('loadCards filters by sub_project_id when provided', async () => {
    const eqSub = vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [] }) })
    const eqProject = vi.fn().mockReturnValue({ eq: eqSub, is: vi.fn() })
    fromMock.mockReturnValue({ select: () => ({ eq: eqProject }) })
    await useCardStore.getState().loadCards('p1', 'sp1')
    expect(eqSub).toHaveBeenCalledWith('sub_project_id', 'sp1')
  })

  it('loadCards filters sub_project_id IS NULL for parent scope', async () => {
    const isNull = vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [] }) })
    const eqProject = vi.fn().mockReturnValue({ is: isNull, eq: vi.fn() })
    fromMock.mockReturnValue({ select: () => ({ eq: eqProject }) })
    await useCardStore.getState().loadCards('p1')
    expect(isNull).toHaveBeenCalledWith('sub_project_id', null)
  })
})
