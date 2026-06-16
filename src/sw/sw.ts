/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

// Injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimerPhase {
  name: string
  duration_minutes: number
  alert_severity: 'low' | 'medium' | 'high' | 'critical'
}

interface ScheduleTimerPayload {
  cardId: string
  cardTitle: string
  phases: TimerPhase[]
  startedAt: number
}

interface CancelTimerPayload {
  cardId: string
}

interface SWMessage {
  type: 'SCHEDULE_TIMER' | 'CANCEL_TIMER'
  payload: ScheduleTimerPayload | CancelTimerPayload
}

interface PushPayload {
  title: string
  body: string
  cardId?: string
  severity?: string
}

// ---------------------------------------------------------------------------
// State — active timers tracked as arrays of timeout IDs per card
// ---------------------------------------------------------------------------

const activeTimers = new Map<string, ReturnType<typeof setTimeout>[]>()

// ---------------------------------------------------------------------------
// Push relay URL — replaced at build time via Vite define or runtime env
// ---------------------------------------------------------------------------

declare const PUSH_RELAY_URL: string

function getPushRelayUrl(): string {
  try {
    // PUSH_RELAY_URL is injected by Vite's define config
    return PUSH_RELAY_URL
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function sendPushViaRelay(
  cardId: string,
  cardTitle: string,
  phaseName: string,
  severity: string,
): Promise<void> {
  const relayUrl = getPushRelayUrl()
  if (!relayUrl) {
    throw new Error('PUSH_RELAY_URL not configured')
  }

  const response = await fetch(`${relayUrl}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `${cardTitle} — phase complete`,
      body: `Phase "${phaseName}" has finished.`,
      severity,
      card_id: cardId,
      data: { cardId, phaseName, severity },
    }),
  })

  if (!response.ok) {
    throw new Error(`Relay responded ${response.status}`)
  }
}

async function showFallbackNotification(
  cardId: string,
  cardTitle: string,
  phaseName: string,
): Promise<void> {
  await self.registration.showNotification(`${cardTitle} — phase complete`, {
    body: `Phase "${phaseName}" has finished.`,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: `timer-${cardId}-${phaseName}`,
    data: { cardId },
    requireInteraction: true,
  })
}

function clearTimersForCard(cardId: string): void {
  const ids = activeTimers.get(cardId)
  if (ids) {
    for (const id of ids) {
      clearTimeout(id)
    }
    activeTimers.delete(cardId)
  }
}

// ---------------------------------------------------------------------------
// Schedule timer — chain timeouts for each phase
// ---------------------------------------------------------------------------

function scheduleTimer(payload: ScheduleTimerPayload): void {
  const { cardId, cardTitle, phases, startedAt } = payload

  // Cancel any existing timers for this card
  clearTimersForCard(cardId)

  const timeoutIds: ReturnType<typeof setTimeout>[] = []
  const now = Date.now()
  let cumulativeMs = 0

  for (const phase of phases) {
    cumulativeMs += phase.duration_minutes * 60 * 1000

    // How long until this phase fires from now (accounting for already elapsed time)
    const elapsed = now - startedAt
    const delay = Math.max(0, cumulativeMs - elapsed)

    const phaseName = phase.name
    const severity = phase.alert_severity

    const timeoutId = setTimeout(async () => {
      try {
        await sendPushViaRelay(cardId, cardTitle, phaseName, severity)
      } catch {
        // Network down or relay unavailable — fall back to local notification
        try {
          await showFallbackNotification(cardId, cardTitle, phaseName)
        } catch (notifErr) {
          console.error('[SW] Fallback notification failed:', notifErr)
        }
      }
    }, delay)

    timeoutIds.push(timeoutId)
  }

  activeTimers.set(cardId, timeoutIds)
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const msg = event.data as SWMessage

  if (!msg || !msg.type) return

  if (msg.type === 'SCHEDULE_TIMER') {
    scheduleTimer(msg.payload as ScheduleTimerPayload)
  } else if (msg.type === 'CANCEL_TIMER') {
    const { cardId } = msg.payload as CancelTimerPayload
    clearTimersForCard(cardId)
  }
})

// ---------------------------------------------------------------------------
// Push event handler
// ---------------------------------------------------------------------------

self.addEventListener('push', (event: PushEvent) => {
  let data: PushPayload = { title: 'ProjectPulse', body: 'Timer complete.' }

  try {
    if (event.data) {
      data = event.data.json() as PushPayload
    }
  } catch {
    if (event.data) {
      data = { title: 'ProjectPulse', body: event.data.text() }
    }
  }

  const notificationPromise = self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: data.cardId ? `push-${data.cardId}` : 'push-generic',
    data: { cardId: data.cardId, severity: data.severity },
    requireInteraction: true,
  })

  event.waitUntil(notificationPromise)
})

// ---------------------------------------------------------------------------
// Notification click handler
// ---------------------------------------------------------------------------

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  const cardId: string | undefined = event.notification.data?.cardId

  const focusPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then(async (clientList) => {
      // Try to find an existing focused window
      for (const client of clientList) {
        if ('focus' in client) {
          await (client as WindowClient).focus()
          if (cardId) {
            client.postMessage({ type: 'NAVIGATE_TO_CARD', cardId })
          }
          return
        }
      }

      // No existing window — open a new one
      const newClient = await self.clients.openWindow('/')
      if (newClient && cardId) {
        // Small delay to let the client initialize before posting
        setTimeout(() => {
          newClient.postMessage({ type: 'NAVIGATE_TO_CARD', cardId })
        }, 500)
      }
    })

  event.waitUntil(focusPromise)
})

// ---------------------------------------------------------------------------
// Install / activate lifecycle
// ---------------------------------------------------------------------------

self.addEventListener('install', () => {
  // Skip waiting so new SW takes over immediately
  void self.skipWaiting()
})

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim())
})
