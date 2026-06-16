/**
 * AlertEngine — Web Audio API based alert system for ProjectPulse.
 *
 * AudioContext is created lazily on the first unlock() call (must come from
 * a user gesture). All oscillators use an exponential gain ramp to avoid
 * the audible click that results from abruptly starting/stopping a sine wave.
 */

export class AlertEngine {
  private ctx: AudioContext | null = null
  private recurringId: number | null = null

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Must be called from a user gesture (click, keydown, etc.) to unlock the
   * AudioContext in browsers that require it. Safe to call multiple times.
   */
  unlock(): void {
    if (this.ctx) return
    this.ctx = new AudioContext()
    // Resume in case the browser created it in a suspended state
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
  }

  /**
   * Play a single tone burst.
   * @param frequency  Frequency in Hz
   * @param duration   Duration in milliseconds
   */
  playBurst(frequency: number, duration: number): void {
    const ctx = this.ensureContext()
    if (!ctx) return

    const durationSec = duration / 1000
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, now)

    // Ramp up quickly, hold, ramp down quickly to avoid clicks
    gain.gain.setValueAtTime(0, now)
    gain.gain.exponentialRampToValueAtTime(0.8, now + 0.01)
    gain.gain.setValueAtTime(0.8, now + durationSec - 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + durationSec)

    // Clean up nodes after they finish
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  }

  /**
   * Start a recurring 3-beep sequence.
   * Pattern: 800 Hz, 80 ms on, 120 ms gap between beeps, 600 ms between sequences.
   * Runs until stop() is called.
   */
  startRecurring(): void {
    if (this.recurringId !== null) return // already running

    const FREQ = 800
    const BEEP_MS = 80
    const GAP_MS = 120
    const SEQUENCE_PAUSE_MS = 600
    const BEEPS_PER_SEQUENCE = 3
    const SEQUENCE_DURATION_MS =
      BEEPS_PER_SEQUENCE * BEEP_MS +
      (BEEPS_PER_SEQUENCE - 1) * GAP_MS +
      SEQUENCE_PAUSE_MS

    const playSequence = () => {
      for (let i = 0; i < BEEPS_PER_SEQUENCE; i++) {
        const delay = i * (BEEP_MS + GAP_MS)
        setTimeout(() => {
          this.playBurst(FREQ, BEEP_MS)
        }, delay)
      }
    }

    // Play immediately, then schedule repeats
    playSequence()
    this.recurringId = window.setInterval(playSequence, SEQUENCE_DURATION_MS)
  }

  /**
   * Stop any recurring alert sequence.
   */
  stop(): void {
    if (this.recurringId !== null) {
      clearInterval(this.recurringId)
      this.recurringId = null
    }
  }

  /**
   * Map severity level to the appropriate alert method.
   */
  alert(severity: 'low' | 'medium' | 'high' | 'critical'): void {
    switch (severity) {
      case 'low':
        // Single soft tone: 440 Hz for 200 ms
        this.playBurst(440, 200)
        break
      case 'medium':
        // Single medium tone: 660 Hz for 400 ms
        this.playBurst(660, 400)
        break
      case 'high':
        // Recurring alarm sequence
        this.startRecurring()
        break
      case 'critical':
        // Recurring alarm sequence (same as high, but callers can differentiate)
        this.startRecurring()
        break
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      // Try to create lazily — may fail if no user gesture has occurred yet
      try {
        this.ctx = new AudioContext()
      } catch {
        console.warn('[AlertEngine] AudioContext could not be created. Call unlock() from a user gesture first.')
        return null
      }
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }

    return this.ctx
  }
}

export const alertEngine = new AlertEngine()
