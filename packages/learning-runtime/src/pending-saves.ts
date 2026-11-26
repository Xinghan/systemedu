type Slot<T> = { current: T }

/** Every caller waits for both the active write and any newer queued state. */
export async function flushPendingSaves<T>(pending: Slot<T | null>, inFlight: Slot<Promise<void> | null>, write: (value: T) => Promise<void>): Promise<void> {
  while (inFlight.current || pending.current) {
    if (inFlight.current) { await inFlight.current; continue }
    const value = pending.current!
    pending.current = null
    const operation = write(value)
    inFlight.current = operation
    try { await operation }
    catch (error) { pending.current ??= value; throw error }
    finally { if (inFlight.current === operation) inFlight.current = null }
  }
}
