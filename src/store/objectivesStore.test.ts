import { describe, it, expect, beforeEach, vi } from 'vitest'

const fromMock = vi.fn()
vi.mock('@/db/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))
vi.mock('@/db/idb', () => ({ enqueueMutation: vi.fn() }))

import { useObjectivesStore } from './objectivesStore'

beforeEach(() => {
  useObjectivesStore.setState({ objectives: [], loading: false })
  fromMock.mockReset()
})

describe('objectivesStore scope', () => {
  it('loadObjectives filters by sub_project_id when provided', async () => {
    const eqProject = vi.fn().mockReturnThis()
    const eqSub = vi.fn().mockReturnThis()
    const order = vi.fn().mockResolvedValue({ data: [] })
    fromMock.mockReturnValue({
      select: () => ({ eq: eqProject, is: vi.fn().mockReturnThis(), order }),
    })
    // chainable: select().eq(project).eq(sub).order()
    const chain = { eq: eqSub, is: vi.fn().mockReturnThis(), order }
    eqProject.mockReturnValue(chain)
    await useObjectivesStore.getState().loadObjectives('p1', 'sp1')
    expect(eqProject).toHaveBeenCalledWith('project_id', 'p1')
    expect(eqSub).toHaveBeenCalledWith('sub_project_id', 'sp1')
  })

  it('loadObjectives filters sub_project_id IS NULL for parent scope', async () => {
    const isNull = vi.fn().mockReturnThis()
    const order = vi.fn().mockResolvedValue({ data: [] })
    const chain = { is: isNull, order }
    const eqProject = vi.fn().mockReturnValue(chain)
    fromMock.mockReturnValue({ select: () => ({ eq: eqProject }) })
    await useObjectivesStore.getState().loadObjectives('p1')
    expect(isNull).toHaveBeenCalledWith('sub_project_id', null)
  })
})
