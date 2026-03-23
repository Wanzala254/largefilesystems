export interface QueuedTicket {
  localId: string
  userName: string
  userEmail?: string
  message: string
  createdAt: string
}

const STORAGE_KEY = 'nt_offline_tickets'

function readQueue(): QueuedTicket[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((q) => q && q.localId && q.message)
  } catch {
    return []
  }
}

function writeQueue(queue: QueuedTicket[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

export function getQueuedTickets() {
  return readQueue()
}

export function queueTicket(input: Omit<QueuedTicket, 'localId' | 'createdAt'>) {
  const queue = readQueue()
  const item: QueuedTicket = {
    localId: `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...input,
  }
  queue.push(item)
  writeQueue(queue)
  return item
}

export function removeQueuedTickets(localIds: string[]) {
  const ids = new Set(localIds)
  const next = readQueue().filter((q) => !ids.has(q.localId))
  writeQueue(next)
  return next
}
