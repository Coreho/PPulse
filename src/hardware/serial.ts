/**
 * SerialMonitor — Web Serial API integration for ProjectPulse.
 *
 * Binds serial ports to cards via a termination string. When the MCU prints
 * the termination string, the monitor fires completion listeners so the board
 * can move the card to "done". Every received line is also emitted to log
 * listeners for the serial monitor panel.
 */

export interface SerialBinding {
  cardId: string
  cardTitle: string
  terminationString: string
  port: SerialPort
  reader: ReadableStreamDefaultReader<string> | null
}

type LogListener = (cardId: string, line: string) => void
type CompletionListener = (cardId: string) => void

export class SerialMonitor {
  private bindings: Map<string, SerialBinding> = new Map()
  private logListeners: LogListener[] = []
  private completionListeners: CompletionListener[] = []

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Returns true if the Web Serial API is available in this browser. */
  isSupported(): boolean {
    return 'serial' in navigator
  }

  /**
   * Open the browser's port picker and return the selected port.
   * Must be called from a user gesture.
   */
  async requestPort(): Promise<SerialPort> {
    if (!this.isSupported()) {
      throw new Error('Web Serial API is not supported in this browser.')
    }
    return navigator.serial.requestPort()
  }

  /**
   * Bind a port to a card. Opens the port at 9600 baud (default).
   * Call startReading() after binding to begin receiving data.
   */
  async bindCard(
    port: SerialPort,
    cardId: string,
    cardTitle: string,
    terminationString: string,
    baudRate = 9600,
  ): Promise<void> {
    // Unbind any existing binding for this card
    if (this.bindings.has(cardId)) {
      await this.unbindCard(cardId)
    }

    // Open the port if it isn't already open
    const info = port.getInfo()
    // Port info is available but open state is not directly exposed;
    // we attempt to open and catch if already open.
    try {
      await port.open({ baudRate })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Chrome throws "The port is already open" if it was opened before
      if (!msg.toLowerCase().includes('already open')) {
        throw err
      }
      // Otherwise, continue — port is already open
      void info // suppress unused warning
    }

    this.bindings.set(cardId, {
      cardId,
      cardTitle,
      terminationString,
      port,
      reader: null,
    })
  }

  /**
   * Cancel the reader and close the port for a card.
   */
  async unbindCard(cardId: string): Promise<void> {
    const binding = this.bindings.get(cardId)
    if (!binding) return

    if (binding.reader) {
      try {
        await binding.reader.cancel()
      } catch {
        // Ignore cancel errors — reader may already be done
      }
      binding.reader = null
    }

    try {
      await binding.port.close()
    } catch {
      // Ignore close errors — port may already be closed
    }

    this.bindings.delete(cardId)
  }

  /**
   * Start reading lines from a bound card's port.
   * This method runs asynchronously and resolves when the port is unbound or
   * a termination string is received.
   */
  async startReading(cardId: string): Promise<void> {
    const binding = this.bindings.get(cardId)
    if (!binding) {
      throw new Error(`No binding found for cardId: ${cardId}`)
    }

    if (!binding.port.readable) {
      throw new Error(`Port for card ${cardId} is not readable.`)
    }

    // Build a text-decoded line stream
    const decoderStream = new TextDecoderStream()
    const readable = binding.port.readable as ReadableStream<Uint8Array>
    const pipedStream = readable.pipeThrough(decoderStream)
    const reader = pipedStream.getReader() as ReadableStreamDefaultReader<string>

    binding.reader = reader

    let lineBuffer = ''

    try {
      while (true) {
        const { value, done } = await reader.read()

        if (done) break
        if (value === undefined) continue

        lineBuffer += value

        // Split on newline — handle \r\n and \n
        const parts = lineBuffer.split(/\r?\n/)

        // The last element is either empty (line ended with \n) or a partial line
        lineBuffer = parts.pop() ?? ''

        for (const line of parts) {
          if (line === '') continue

          // Emit to log listeners
          this.emitLog(cardId, line)

          // Check for termination string
          if (line.includes(binding.terminationString)) {
            this.emitCompletion(cardId)
            // Unbind after completion — fire and forget
            void this.unbindCard(cardId)
            return
          }
        }
      }

      // Flush remaining buffer content as a final line
      if (lineBuffer.trim() !== '') {
        this.emitLog(cardId, lineBuffer)
        if (lineBuffer.includes(binding.terminationString)) {
          this.emitCompletion(cardId)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Reader cancelled is expected during unbind — don't treat as error
      if (!msg.toLowerCase().includes('cancelled') && !msg.toLowerCase().includes('canceled')) {
        console.error(`[SerialMonitor] Read error for card ${cardId}:`, err)
      }
    }
  }

  /**
   * Register a listener for incoming serial lines.
   * @returns An unsubscribe function.
   */
  onLog(cb: LogListener): () => void {
    this.logListeners.push(cb)
    return () => {
      this.logListeners = this.logListeners.filter((l) => l !== cb)
    }
  }

  /**
   * Register a listener for card completion (termination string match).
   * @returns An unsubscribe function.
   */
  onCompletion(cb: CompletionListener): () => void {
    this.completionListeners.push(cb)
    return () => {
      this.completionListeners = this.completionListeners.filter((l) => l !== cb)
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private emitLog(cardId: string, line: string): void {
    for (const listener of this.logListeners) {
      try {
        listener(cardId, line)
      } catch (err) {
        console.error('[SerialMonitor] Log listener threw:', err)
      }
    }
  }

  private emitCompletion(cardId: string): void {
    for (const listener of this.completionListeners) {
      try {
        listener(cardId)
      } catch (err) {
        console.error('[SerialMonitor] Completion listener threw:', err)
      }
    }
  }
}

export const serialMonitor = new SerialMonitor()
