import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { NetworkMessage, MessageStatus, TicketUpdateResponse } from '../types/network'

const statusColors: Record<MessageStatus, string> = {
  pending: 'var(--warning)',
  in_progress: 'var(--accent)',
  resolved: 'var(--success)',
  closed: '#6e7681',
}

const statusLabels: Record<MessageStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const allowedTransitions: Record<MessageStatus, MessageStatus[]> = {
  pending: ['pending', 'in_progress', 'resolved'],
  in_progress: ['in_progress', 'pending', 'resolved'],
  resolved: ['resolved', 'closed', 'in_progress'],
  closed: ['closed', 'in_progress'],
}

function formatTime(iso?: string) {
  if (!iso) return 'N/A'
  return new Date(iso).toLocaleString()
}

function diffMinutes(startIso?: string, endIso?: string) {
  if (!startIso || !endIso) return null
  const startMs = new Date(startIso).getTime()
  const endMs = new Date(endIso).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null
  return Math.round((endMs - startMs) / 60000)
}

function average(values: number[]) {
  if (values.length === 0) return null
  const total = values.reduce((sum, current) => sum + current, 0)
  return Math.round(total / values.length)
}

function formatMinutes(minutes: number | null) {
  if (minutes == null) return 'N/A'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`
}

export default function Tickets() {
  const [messages, setMessages] = useState<NetworkMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<NetworkMessage | null>(null)
  const [responseDraft, setResponseDraft] = useState('')
  const [sendingResponse, setSendingResponse] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'overdue' | 'pending' | 'in_progress' | 'resolved' | 'closed'
  >('all')

  const loadMessages = async () => {
    try {
      setError(null)
      const data = await api.getMessages()
      setMessages(data)
      if (selectedMessage) {
        const next = data.find((m) => m.id === selectedMessage.id) || null
        setSelectedMessage(next)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [])

  useEffect(() => {
    setResponseDraft(selectedMessage?.adminResponse || '')
  }, [selectedMessage])

  const handleUpdate = async (
    id: string,
    updates: { status?: MessageStatus; adminResponse?: string; estimatedFixTime?: string }
  ) => {
    try {
      const updated: TicketUpdateResponse = await api.updateMessage(id, updates)
      setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)))
      if (selectedMessage?.id === id) setSelectedMessage(updated)
      if (updated.notification) {
        if (updated.notification.sent) {
          setActionNotice('User was notified by email.')
        } else if (updated.notification.configured) {
          setActionNotice(
            `Ticket updated, but email notification failed${updated.notification.error ? `: ${updated.notification.error}` : '.'}`
          )
        } else {
          setActionNotice('Ticket updated. Email notifications are not configured.')
        }
      } else {
        setActionNotice('Ticket updated.')
      }
      return updated
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update message')
      return null
    }
  }

  const handleSendResponse = async () => {
    if (!selectedMessage) return
    const trimmed = responseDraft.trim()
    if (!trimmed) {
      alert('Enter a response before sending.')
      return
    }

    try {
      setSendingResponse(true)
      const nextStatus: MessageStatus =
        selectedMessage.status === 'pending' ? 'in_progress' : selectedMessage.status

      await handleUpdate(selectedMessage.id, {
        adminResponse: trimmed,
        status: nextStatus,
      })
      alert('Response sent to user ticket.')
    } finally {
      setSendingResponse(false)
    }
  }

  const handleStatusChange = async (nextStatus: MessageStatus) => {
    if (!selectedMessage) return
    try {
      setStatusUpdating(true)
      await handleUpdate(selectedMessage.id, { status: nextStatus })
    } finally {
      setStatusUpdating(false)
    }
  }

  const handleCloseTicket = async () => {
    if (!selectedMessage) return
    if (selectedMessage.status !== 'resolved') {
      alert('Only resolved tickets can be closed.')
      return
    }

    try {
      setStatusUpdating(true)
      await handleUpdate(selectedMessage.id, { status: 'closed' })
      alert('Ticket closed successfully.')
    } finally {
      setStatusUpdating(false)
    }
  }

  if (loading) return <div style={styles.centered}>Loading tickets...</div>
  if (error) return <div style={styles.error}>Error: {error}</div>

  const pendingCount = messages.filter((m) => m.status === 'pending').length
  const overdueCount = messages.filter((m) => m.isOverdue).length
  const inProgressCount = messages.filter((m) => m.status === 'in_progress').length
  const closedCount = messages.filter((m) => m.status === 'closed').length
  const avgFirstResponse = average(
    messages
      .map((m) => diffMinutes(m.createdAt, m.firstResponseAt))
      .filter((v): v is number => v !== null)
  )
  const avgResolution = average(
    messages
      .map((m) => diffMinutes(m.createdAt, m.resolvedAt))
      .filter((v): v is number => v !== null)
  )
  const filteredMessages = messages.filter((m) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'overdue') return Boolean(m.isOverdue)
    return m.status === activeFilter
  })

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Network Issue Tickets</h1>
          <p style={styles.subtitle}>
            {pendingCount} pending {pendingCount === 1 ? 'ticket' : 'tickets'}
            {overdueCount > 0 ? ` | ${overdueCount} overdue` : ''}
          </p>
        </div>
      </div>
      {actionNotice && (
        <div style={styles.noticeBanner}>
          {actionNotice}
          <button type="button" style={styles.noticeDismiss} onClick={() => setActionNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div style={styles.kpiGrid}>
        <button
          type="button"
          onClick={() => setActiveFilter(activeFilter === 'pending' ? 'all' : 'pending')}
          style={{
            ...styles.kpiCard,
            ...(activeFilter === 'pending' ? styles.kpiCardActive : {}),
            ...styles.kpiCardButton,
          }}
        >
          <div style={styles.kpiLabel}>Pending</div>
          <div style={styles.kpiValue}>{pendingCount}</div>
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter(activeFilter === 'overdue' ? 'all' : 'overdue')}
          style={{
            ...styles.kpiCard,
            ...(activeFilter === 'overdue' ? styles.kpiCardActive : {}),
            ...styles.kpiCardButton,
          }}
        >
          <div style={styles.kpiLabel}>Overdue Tickets</div>
          <div style={styles.kpiValueDanger}>{overdueCount}</div>
        </button>
        <button
          type="button"
          onClick={() =>
            setActiveFilter(activeFilter === 'in_progress' ? 'all' : 'in_progress')
          }
          style={{
            ...styles.kpiCard,
            ...(activeFilter === 'in_progress' ? styles.kpiCardActive : {}),
            ...styles.kpiCardButton,
          }}
        >
          <div style={styles.kpiLabel}>In Progress</div>
          <div style={styles.kpiValue}>{inProgressCount}</div>
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter(activeFilter === 'resolved' ? 'all' : 'resolved')}
          style={{
            ...styles.kpiCard,
            ...(activeFilter === 'resolved' ? styles.kpiCardActive : {}),
            ...styles.kpiCardButton,
          }}
        >
          <div style={styles.kpiLabel}>Resolved</div>
          <div style={styles.kpiValue}>
            {messages.filter((m) => m.status === 'resolved').length}
          </div>
        </button>
        <article style={styles.kpiCard}>
          <div style={styles.kpiLabel}>Avg First Response</div>
          <div style={styles.kpiValue}>{formatMinutes(avgFirstResponse)}</div>
        </article>
        <article style={styles.kpiCard}>
          <div style={styles.kpiLabel}>Avg Resolution</div>
          <div style={styles.kpiValue}>{formatMinutes(avgResolution)}</div>
        </article>
        <button
          type="button"
          onClick={() => setActiveFilter(activeFilter === 'closed' ? 'all' : 'closed')}
          style={{
            ...styles.kpiCard,
            ...(activeFilter === 'closed' ? styles.kpiCardActive : {}),
            ...styles.kpiCardButton,
          }}
        >
          <div style={styles.kpiLabel}>Closed Tickets</div>
          <div style={styles.kpiValue}>{closedCount}</div>
        </button>
      </div>
      {activeFilter !== 'all' && (
        <div style={styles.filterBanner}>
          Filter active: {activeFilter === 'in_progress' ? 'In Progress' : activeFilter}
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            style={styles.clearFilterButton}
          >
            Clear
          </button>
        </div>
      )}

      <div style={styles.layout}>
        <div style={styles.list}>
          {filteredMessages.length === 0 ? (
            <div style={styles.empty}>No tickets yet</div>
          ) : (
            filteredMessages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => setSelectedMessage(msg)}
                style={{
                  ...styles.ticketCard,
                  ...(selectedMessage?.id === msg.id ? styles.ticketCardActive : {}),
                  ...(msg.isOverdue ? styles.ticketCardOverdue : {}),
                }}
              >
                <div style={styles.ticketHeader}>
                  <span style={styles.ticketUser}>{msg.userName}</span>
                  <span
                    style={{
                      ...styles.statusBadge,
                      background: statusColors[msg.status],
                    }}
                  >
                    {statusLabels[msg.status]}
                  </span>
                </div>
                <p style={styles.ticketPreview}>
                  {msg.message.length > 100 ? `${msg.message.substring(0, 100)}...` : msg.message}
                </p>
                <div style={styles.ticketMeta}>Created: {formatTime(msg.createdAt)}</div>
                {msg.slaDueAt && (
                  <div style={msg.isOverdue ? styles.overdueText : styles.slaText}>
                    SLA Due: {formatTime(msg.slaDueAt)}
                    {msg.isOverdue ? ' (Overdue)' : ''}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {selectedMessage && (
          <div style={styles.detail}>
            <div style={styles.detailHeader}>
              <h2 style={styles.detailTitle}>Ticket Details</h2>
              <button onClick={() => setSelectedMessage(null)} style={styles.closeButton}>
                x
              </button>
            </div>

            <div style={styles.detailContent}>
              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>User</div>
                <div style={styles.detailValue}>
                  {selectedMessage.userName}
                  {selectedMessage.userEmail && (
                    <span style={styles.email}> ({selectedMessage.userEmail})</span>
                  )}
                </div>
              </div>

              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Status</div>
                <select
                  value={selectedMessage.status}
                  onChange={(e) => handleStatusChange(e.target.value as MessageStatus)}
                  style={styles.statusSelect}
                  disabled={statusUpdating}
                >
                  {allowedTransitions[selectedMessage.status].map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s]}
                    </option>
                  ))}
                </select>
                {selectedMessage.status === 'resolved' && (
                  <div style={styles.resolveActionWrap}>
                    <button
                      type="button"
                      onClick={handleCloseTicket}
                      disabled={statusUpdating}
                      style={styles.resolveButton}
                    >
                      {statusUpdating ? 'Updating...' : 'Close Ticket'}
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Issue</div>
                <div style={styles.messageBox}>{selectedMessage.message}</div>
              </div>

              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Admin Response</div>
                <textarea
                  value={responseDraft}
                  onChange={(e) => setResponseDraft(e.target.value)}
                  style={styles.responseTextarea}
                  placeholder="Enter your response to the user..."
                  rows={4}
                />
                <div style={styles.responseActions}>
                  <button
                    type="button"
                    onClick={handleSendResponse}
                    disabled={sendingResponse}
                    style={styles.sendButton}
                  >
                    {sendingResponse ? 'Sending...' : 'Send Response'}
                  </button>
                </div>
              </div>

              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Estimated Fix Time</div>
                <input
                  type="datetime-local"
                  value={
                    selectedMessage.estimatedFixTime
                      ? new Date(selectedMessage.estimatedFixTime).toISOString().slice(0, 16)
                      : ''
                  }
                  onChange={(e) =>
                    handleUpdate(selectedMessage.id, {
                      estimatedFixTime: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    })
                  }
                  style={styles.datetimeInput}
                />
              </div>

              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>SLA</div>
                <div style={styles.detailValue}>Target: {selectedMessage.slaTargetMinutes || 0} minutes</div>
                <div style={selectedMessage.isOverdue ? styles.overdueText : styles.slaText}>
                  Due: {formatTime(selectedMessage.slaDueAt)}
                  {selectedMessage.isOverdue ? ' (Overdue)' : ''}
                </div>
                <div style={styles.detailValue}>First response: {formatTime(selectedMessage.firstResponseAt)}</div>
                <div style={styles.detailValue}>Resolved at: {formatTime(selectedMessage.resolvedAt)}</div>
                <div style={styles.detailValue}>Closed at: {formatTime(selectedMessage.closedAt)}</div>
              </div>

              <div style={styles.detailMeta}>
                <div>Created: {formatTime(selectedMessage.createdAt)}</div>
                <div>Updated: {formatTime(selectedMessage.updatedAt)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
  },
  header: {
    marginBottom: '1.5rem',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  kpiCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '0.75rem',
  },
  kpiCardButton: {
    textAlign: 'left',
    width: '100%',
    cursor: 'pointer',
  },
  kpiCardActive: {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 0 1px rgba(88, 166, 255, 0.45) inset',
  },
  kpiLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginBottom: '0.25rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  kpiValue: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  kpiValueDanger: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--danger)',
  },
  filterBanner: {
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  clearFilterButton: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    padding: '0.2rem 0.5rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  title: {
    margin: 0,
    fontSize: '1.75rem',
  },
  subtitle: {
    margin: '0.25rem 0 0 0',
    color: 'var(--text-secondary)',
    fontSize: '0.9375rem',
  },
  noticeBanner: {
    marginBottom: '0.9rem',
    padding: '0.7rem 0.85rem',
    border: '1px solid rgba(88, 166, 255, 0.4)',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(88, 166, 255, 0.12)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    fontSize: '0.88rem',
  },
  noticeDismiss: {
    border: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    padding: '0.2rem 0.45rem',
    fontSize: '0.78rem',
  },
  centered: {
    textAlign: 'center',
    padding: '3rem',
    color: 'var(--text-secondary)',
  },
  error: {
    color: 'var(--danger)',
    padding: '1rem',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '400px 1fr',
    gap: '1.5rem',
    height: 'calc(100vh - 200px)',
  },
  list: {
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  empty: {
    padding: '2rem',
    textAlign: 'center',
    color: 'var(--text-secondary)',
  },
  ticketCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  ticketCardActive: {
    borderColor: 'var(--accent)',
    background: 'var(--bg-tertiary)',
  },
  ticketCardOverdue: {
    borderColor: 'var(--danger)',
  },
  ticketHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  ticketUser: {
    fontWeight: 600,
    fontSize: '0.9375rem',
  },
  statusBadge: {
    padding: '0.25rem 0.5rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'white',
  },
  ticketPreview: {
    margin: '0.5rem 0',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  ticketMeta: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  slaText: {
    marginTop: '0.35rem',
    fontSize: '0.75rem',
    color: 'var(--accent)',
  },
  overdueText: {
    marginTop: '0.35rem',
    fontSize: '0.75rem',
    color: 'var(--danger)',
    fontWeight: 700,
  },
  detail: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem',
    borderBottom: '1px solid var(--border)',
  },
  detailTitle: {
    margin: 0,
    fontSize: '1.25rem',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '1.25rem',
    cursor: 'pointer',
    padding: 0,
    width: 32,
    height: 32,
  },
  detailContent: {
    padding: '1.25rem',
    overflowY: 'auto',
    flex: 1,
  },
  detailSection: {
    marginBottom: '1.5rem',
  },
  detailLabel: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '0.5rem',
  },
  detailValue: {
    fontSize: '0.9375rem',
    marginBottom: '0.3rem',
  },
  email: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  statusSelect: {
    padding: '0.5rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    cursor: 'pointer',
  },
  messageBox: {
    padding: '1rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9375rem',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  responseTextarea: {
    width: '100%',
    padding: '0.75rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  responseActions: {
    marginTop: '0.75rem',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  sendButton: {
    border: '1px solid var(--accent)',
    background: 'var(--accent)',
    color: 'white',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 0.9rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  resolveActionWrap: {
    marginTop: '0.75rem',
  },
  resolveButton: {
    border: '1px solid var(--success)',
    background: 'rgba(63, 185, 80, 0.2)',
    color: 'var(--success)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.45rem 0.8rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  datetimeInput: {
    width: '100%',
    padding: '0.5rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    fontFamily: 'inherit',
  },
  detailMeta: {
    marginTop: '1.5rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid var(--border)',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
}
