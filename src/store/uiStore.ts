import { create } from 'zustand'

type ActivePanel = 'bom' | 'machines' | 'fileVault' | 'serial' | 'pinout' | null

interface UIStore {
  activePanel: ActivePanel
  isPinoutOpen: boolean
  pinoutMcu: string | null
  isOnline: boolean

  setActivePanel: (panel: ActivePanel) => void
  openPinout: (mcu: string | null) => void
  closePinout: () => void
  setOnline: (online: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  activePanel: null,
  isPinoutOpen: false,
  pinoutMcu: null,
  isOnline: navigator.onLine,

  setActivePanel: (panel) => set(s => ({ activePanel: s.activePanel === panel ? null : panel })),
  openPinout: (mcu) => set({ isPinoutOpen: true, pinoutMcu: mcu }),
  closePinout: () => set({ isPinoutOpen: false, pinoutMcu: null }),
  setOnline: (online) => set({ isOnline: online }),
}))
