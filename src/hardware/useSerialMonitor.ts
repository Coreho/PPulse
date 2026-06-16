/**
 * useSerialMonitor — React hook wrapping the SerialMonitor singleton.
 *
 * Provides log lines and completion events with automatic cleanup on unmount.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { serialMonitor } from './serial'

export interface UseSerialMonitorOptions {
  /** If provided, only events for this cardId are surfaced. Pass undefined for all cards. */
  cardId?: string
  /** Maximum number of log lines to keep in state (default: 500). */
  maxLines?: number
}

export interface UseSerialMonitorReturn {
  /** Whether the Web Serial API is supported in this browser. */
  isSupported: boolean
  /** Log lines received from bound cards. */
  lines: { cardId: string; line: string }[]
  /** Set of cardIds that have completed (termination string matched). */
  completedCards: Set<string>
  /** Open the OS port picker and return the selected port. Must be called from a user gesture. */
  requestPort: () => Promise<SerialPort | null>
  /** Bind a port to a card and start reading. */
  bindCard: (
    port: SerialPort,
    cardId: string,
    cardTitle: string,
    terminationString: string,
    baudRate?: number,
  ) => Promise<void>
  /** Unbind and close port for a card. */
  unbindCard: (cardId: string) => Promise<void>
  /** Clear all log lines from state. */
  clearLines: () => void
}

export function useSerialMonitor(options: UseSerialMonitorOptions = {}): UseSerialMonitorReturn {
  const { cardId: filterCardId, maxLines = 500 } = options

  const [lines, setLines] = useState<{ cardId: string; line: string }[]>([])
  const [completedCards, setCompletedCards] = useState<Set<string>>(new Set())

  // Keep unsubscribe functions in a ref so we can clean up on unmount
  const unsubscribeRefs = useRef<(() => void)[]>([])

  useEffect(() => {
    const unsubLog = serialMonitor.onLog((id, line) => {
      if (filterCardId !== undefined && id !== filterCardId) return
      setLines((prev) => {
        const next = [...prev, { cardId: id, line }]
        return next.length > maxLines ? next.slice(next.length - maxLines) : next
      })
    })

    const unsubCompletion = serialMonitor.onCompletion((id) => {
      if (filterCardId !== undefined && id !== filterCardId) return
      setCompletedCards((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
    })

    unsubscribeRefs.current = [unsubLog, unsubCompletion]

    return () => {
      for (const unsub of unsubscribeRefs.current) {
        unsub()
      }
    }
  }, [filterCardId, maxLines])

  const requestPort = useCallback(async (): Promise<SerialPort | null> => {
    try {
      return await serialMonitor.requestPort()
    } catch (err) {
      // User cancelled the picker — not a real error
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.toLowerCase().includes('no port') && !msg.toLowerCase().includes('cancelled')) {
        console.error('[useSerialMonitor] requestPort error:', err)
      }
      return null
    }
  }, [])

  const bindCard = useCallback(
    async (
      port: SerialPort,
      id: string,
      cardTitle: string,
      terminationString: string,
      baudRate?: number,
    ): Promise<void> => {
      await serialMonitor.bindCard(port, id, cardTitle, terminationString, baudRate)
      // Start reading in the background — don't await (it runs until port closes)
      void serialMonitor.startReading(id)
    },
    [],
  )

  const unbindCard = useCallback(async (id: string): Promise<void> => {
    await serialMonitor.unbindCard(id)
  }, [])

  const clearLines = useCallback(() => {
    setLines([])
  }, [])

  return {
    isSupported: serialMonitor.isSupported(),
    lines,
    completedCards,
    requestPort,
    bindCard,
    unbindCard,
    clearLines,
  }
}
