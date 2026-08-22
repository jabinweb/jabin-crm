export type RealtimeEvent = {
  type: string
  companyId: string
  payload: Record<string, unknown>
  ts: number
  userId?: string
}

type Listener = (event: RealtimeEvent) => void

const GLOBAL_HUB_KEY = '__crmRealtimeHub__'

interface HubState {
  listeners: Map<string, Set<Listener>>
}

function getHubState(): HubState {
  const g = globalThis as typeof globalThis & { [GLOBAL_HUB_KEY]?: HubState }
  if (!g[GLOBAL_HUB_KEY]) {
    g[GLOBAL_HUB_KEY] = { listeners: new Map() }
  }
  return g[GLOBAL_HUB_KEY]!
}

function fanOutLocal(event: RealtimeEvent): void {
  const set = getHubState().listeners.get(event.companyId)
  if (!set?.size) return
  set.forEach((listener) => {
    try {
      listener(event)
    } catch (err) {
      console.error('[realtime] listener error', err)
    }
  })
}

/** Subscribe to company-scoped realtime events on this process (SSE). */
export function subscribe(companyId: string, listener: Listener): () => void {
  const state = getHubState()
  let set = state.listeners.get(companyId)
  if (!set) {
    set = new Set()
    state.listeners.set(companyId, set)
  }
  set.add(listener)
  return () => {
    set!.delete(listener)
    if (set!.size === 0) {
      state.listeners.delete(companyId)
    }
  }
}

/** Publish to in-memory SSE listeners only (no Redis). */
export async function publish(event: RealtimeEvent): Promise<void> {
  fanOutLocal(event)
}

/** Convenience helper for publishing typed events. */
export async function publishRealtime(
  type: string,
  companyId: string,
  payload: Record<string, unknown>,
  userId?: string
): Promise<void> {
  await publish({
    type,
    companyId,
    payload,
    ts: Date.now(),
    userId,
  })
}
