import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import { useCardStore } from '@/store/cardStore'
import type { Database } from '@/db/types'

type Machine = Database['public']['Tables']['machines']['Row']

export interface MachineWithStatus extends Machine {
  hoursSinceLastMaintenance: number
  maintenancePercent: number
  needsMaintenance: boolean
}

interface MachineStore {
  machines: Machine[]
  loading: boolean

  loadMachines: (projectId: string) => Promise<void>
  addMachine: (m: Database['public']['Tables']['machines']['Insert']) => Promise<void>
  updateMachine: (id: string, updates: Database['public']['Tables']['machines']['Update']) => Promise<void>
  deleteMachine: (id: string) => Promise<void>
  logHours: (id: string, hours: number) => Promise<void>
  markMaintained: (id: string) => Promise<void>
  toggleLock: (id: string) => Promise<void>
}

function derivedStatus(m: Machine): Pick<MachineWithStatus, 'hoursSinceLastMaintenance' | 'maintenancePercent' | 'needsMaintenance'> {
  const since = m.total_hours_logged - m.hours_at_last_maintenance
  const pct = Math.min(100, (since / m.maintenance_threshold_hours) * 100)
  return {
    hoursSinceLastMaintenance: since,
    maintenancePercent: pct,
    needsMaintenance: since >= m.maintenance_threshold_hours,
  }
}

function syncMaintenanceFlag(machine: Machine) {
  const { needsMaintenance } = derivedStatus(machine)
  const cardStore = useCardStore.getState()
  const linkedCards = cardStore.cards.filter(c => c.machine_id === machine.id)
  for (const card of linkedCards) {
    if (needsMaintenance || machine.is_locked) {
      cardStore.addStatusFlag(card.id, 'needs_maintenance')
    } else {
      cardStore.removeStatusFlag(card.id, 'needs_maintenance')
    }
  }
}

export function withStatus(m: Machine): MachineWithStatus {
  return { ...m, ...derivedStatus(m) }
}

export const useMachineStore = create<MachineStore>((set, get) => ({
  machines: [],
  loading: false,

  loadMachines: async (projectId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('machines')
      .select('*')
      .eq('project_id', projectId)
      .order('name')
    const machines = data ?? []
    set({ machines, loading: false })
    machines.forEach(syncMaintenanceFlag)
  },

  addMachine: async (m) => {
    const optimistic: Machine = { ...m, id: crypto.randomUUID(), hours_at_last_maintenance: 0 }
    set(s => ({ machines: [...s.machines, optimistic] }))
    const { data, error } = await supabase.from('machines').insert(m).select().single()
    if (error) return
    set(s => ({ machines: s.machines.map(x => x.id === optimistic.id ? data : x) }))
  },

  updateMachine: async (id, updates) => {
    set(s => ({ machines: s.machines.map(m => m.id === id ? { ...m, ...updates } : m) }))
    const updated = get().machines.find(m => m.id === id)
    if (updated) syncMaintenanceFlag(updated)
    await supabase.from('machines').update(updates).eq('id', id)
  },

  deleteMachine: async (id) => {
    const m = get().machines.find(x => x.id === id)
    set(s => ({ machines: s.machines.filter(x => x.id !== id) }))
    if (m) {
      const cardStore = useCardStore.getState()
      cardStore.cards
        .filter(c => c.machine_id === id)
        .forEach(c => cardStore.removeStatusFlag(c.id, 'needs_maintenance'))
    }
    await supabase.from('machines').delete().eq('id', id)
  },

  logHours: async (id, hours) => {
    const m = get().machines.find(x => x.id === id)
    if (!m) return
    const newTotal = m.total_hours_logged + hours
    await get().updateMachine(id, { total_hours_logged: newTotal })
  },

  markMaintained: async (id) => {
    const m = get().machines.find(x => x.id === id)
    if (!m) return
    await get().updateMachine(id, {
      hours_at_last_maintenance: m.total_hours_logged,
      last_maintenance_at: new Date().toISOString(),
      is_locked: false,
    })
  },

  toggleLock: async (id) => {
    const m = get().machines.find(x => x.id === id)
    if (!m) return
    await get().updateMachine(id, { is_locked: !m.is_locked })
  },
}))
