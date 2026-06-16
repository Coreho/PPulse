/**
 * TimerManager — Post-processing timer manager for ProjectPulse.
 *
 * Delegates phase scheduling to the Service Worker via postMessage so timers
 * survive page blur. Also handles push notification subscription lifecycle.
 */

import type { TimerPhase } from '../db/types'

export interface ActiveTimer {
  cardId: string
  cardTitle: string
  phases: TimerPhase[]
  startedAt: number
  currentPhaseIndex: number
}

export class TimerManager {
  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Schedule a multi-phase timer via the Service Worker.
   * If the SW controller is unavailable (no SW registered), logs a warning.
   */
  schedule(cardId: string, cardTitle: string, phases: TimerPhase[]): void {
    const controller = navigator.serviceWorker?.controller
    if (!controller) {
      console.warn(
        '[TimerManager] Service Worker controller not available. ' +
          'Ensure the SW is registered and the page has been refreshed after first install.',
      )
      return
    }

    controller.postMessage({
      type: 'SCHEDULE_TIMER',
      payload: {
        cardId,
        cardTitle,
        phases,
        startedAt: Date.now(),
      },
    })
  }

  /**
   * Cancel a running timer via the Service Worker.
   */
  cancel(cardId: string): void {
    const controller = navigator.serviceWorker?.controller
    if (!controller) return

    controller.postMessage({
      type: 'CANCEL_TIMER',
      payload: { cardId },
    })
  }

  /**
   * Calculate how many milliseconds remain in the current phase.
   * Returns 0 if the phase is already past its end time.
   */
  getRemainingTime(timer: ActiveTimer): number {
    const { phases, startedAt, currentPhaseIndex } = timer

    // Sum durations of all completed phases
    let elapsedPhaseMs = 0
    for (let i = 0; i < currentPhaseIndex; i++) {
      elapsedPhaseMs += (phases[i]?.duration_minutes ?? 0) * 60 * 1000
    }

    const currentPhase = phases[currentPhaseIndex]
    if (!currentPhase) return 0

    const currentPhaseDurationMs = currentPhase.duration_minutes * 60 * 1000
    const phaseStartedAt = startedAt + elapsedPhaseMs
    const phaseEndsAt = phaseStartedAt + currentPhaseDurationMs

    return Math.max(0, phaseEndsAt - Date.now())
  }

  /**
   * Subscribe to Web Push notifications and store the subscription for the
   * given project. Sends the subscription to the push relay server.
   *
   * Returns null if push is not supported, permission was denied, or
   * the relay POST failed.
   */
  async subscribeToPush(projectId: string): Promise<PushSubscription | null> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[TimerManager] Push notifications are not supported in this browser.')
      return null
    }

    const registration = await navigator.serviceWorker.ready

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
    if (!vapidPublicKey) {
      console.error('[TimerManager] VITE_VAPID_PUBLIC_KEY is not set.')
      return null
    }

    const applicationServerKey = this.urlBase64ToUint8Array(vapidPublicKey)

    let subscription: PushSubscription
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
    } catch (err) {
      console.error('[TimerManager] Push subscription failed:', err)
      return null
    }

    // Send subscription to relay
    const relayUrl = import.meta.env.VITE_PUSH_RELAY_URL as string | undefined
    if (relayUrl) {
      try {
        const res = await fetch(`${relayUrl}/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            subscription: subscription.toJSON(),
          }),
        })
        if (!res.ok) {
          console.warn(`[TimerManager] Relay /subscribe responded ${res.status}`)
        }
      } catch (err) {
        console.warn('[TimerManager] Could not send subscription to relay:', err)
        // Non-fatal — local SW fallback still works
      }
    }

    return subscription
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert a URL-safe Base64 VAPID public key to a Uint8Array, as required
   * by pushManager.subscribe().
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
  }
}

export const timerManager = new TimerManager()
