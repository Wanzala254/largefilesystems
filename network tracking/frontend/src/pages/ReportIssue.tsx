import { useEffect, useState } from 'react'
import { api, getTokenUser } from '../api/client'
import type { NetworkMessage } from '../types/network'
import {
  getQueuedTickets,
  queueTicket,
  removeQueuedTickets,
  type QueuedTicket,
} from '../utils/offlineTickets'

function formatTicketStatus(status: NetworkMessage['status']) {
  if (status === 'in_progress') return 'In Progress'
  if (status === 'closed') return 'Closed'
  if (status === 'resolved') return 'Resolved'
  return 'Pending'
}

export default function ReportIssue() {
  const tokenUser = getTokenUser()
  const [formData, setFormData] = useState({
    userName: tokenUser?.username || '',
    userEmail: '',
    message: '',
  })
  const [attachment, setAttachment] = useState<{
    name: string
    contentType: string
    data: string
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [autoReply, setAutoReply] = useState<string | null>(null)
  const [myTickets, setMyTickets] = useState<NetworkMessage[]>([])
  const [queuedTickets, setQueuedTickets] = useState<QueuedTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [ticketError, setTicketError] = useState<string | null>(null)
  const [syncingQueued, setSyncingQueued] = useState(false)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  const loadMyTickets = async () => {
    try {
      setTicketError(null)
      const data = await api.getMyMessages()
      setMyTickets(data)
    } catch (e) {
      setTicketError(e instanceof Error ? e.message : 'Failed to load your tickets')
    } finally {
      setLoadingTickets(false)
    }
  }

  useEffect(() => {
    setQueuedTickets(getQueuedTickets())
    loadMyTickets()
  }, [])

  const syncQueuedTickets = async () => {
    const queue = getQueuedTickets()
    if (queue.length === 0) return

    setSyncingQueued(true)
    const syncedIds: string[] = []
    try {
      for (const q of queue) {
        await api.createMessage({
          userName: q.userName || tokenUser?.username || '',
          userEmail: q.userEmail || undefined,
          message: q.message,
        })
        syncedIds.push(q.localId)
      }
      const remaining = removeQueuedTickets(syncedIds)
      setQueuedTickets(remaining)
      await loadMyTickets()
    } catch (e) {
      if (
        e instanceof Error &&
        !/Failed to fetch|NetworkError|Load failed/i.test(e.message)
      ) {
        setError(e.message)
      }
    } finally {
      setSyncingQueued(false)
    }
  }

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      syncQueuedTickets()
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setAutoReply(null)
    setSubmitting(true)

    try {
      if (!isOnline) {
        queueTicket({
          userName: formData.userName || tokenUser?.username || '',
          userEmail: formData.userEmail || undefined,
          message: formData.message + (attachment ? `\n[Attachment: ${attachment.name}]` : ''),
        })
        setQueuedTickets(getQueuedTickets())
        setSuccess(true)
        setAutoReply(
          'Saved offline. Your ticket will be sent automatically when internet is back.'
        )
        setFormData((prev) => ({ ...prev, userEmail: '', message: '' }))
        return
      }

      const created: NetworkMessage = await api.createMessage({
        userName: formData.userName || tokenUser?.username || '',
        userEmail: formData.userEmail || undefined,
        message: formData.message,
        attachment: attachment || undefined,
      })
      setAutoReply(created.adminResponse || null)
      setSuccess(true)
      setFormData((prev) => ({ ...prev, userEmail: '', message: '' }))
      setAttachment(null)
      await loadMyTickets()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to submit report'
      if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
        queueTicket({
          userName: formData.userName || tokenUser?.username || '',
          userEmail: formData.userEmail || undefined,
          message: formData.message + (attachment ? `\n[Attachment: ${attachment.name}]` : ''),
        })
        setQueuedTickets(getQueuedTickets())
        setSuccess(true)
        setAutoReply(
          'Network is down. Ticket was saved offline and will sync automatically.'
        )
        setFormData((prev) => ({ ...prev, userEmail: '', message: '' }))
        setAttachment(null)
      } else {
        setError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const getQuickFixTips = (issueText: string) => {
    const text = issueText.toLowerCase()
    const tips: string[] = []

    if (text.includes('wifi') || text.includes('wireless')) {
      tips.push('Turn Wi-Fi off and on, then reconnect to the network.')
    }
    if (text.includes('internet') || text.includes('no network') || text.includes('offline')) {
      tips.push('Restart your router or modem and wait 2 minutes before retrying.')
    }
    if (text.includes('slow') || text.includes('latency') || text.includes('lag')) {
      tips.push('Close heavy downloads/streams and run a speed test again.')
    }
    if (text.includes('dns') || text.includes('cannot reach') || text.includes('website')) {
      tips.push('Flush DNS cache or try switching DNS to 8.8.8.8 temporarily.')
    }
    if (text.includes('password') || text.includes('login') || text.includes('auth')) {
      tips.push('Re-enter credentials and confirm caps lock is not enabled.')
    }
    if (tips.length === 0) {
      tips.push('Try restarting your device and reconnecting to the network.')
    }

    return tips.slice(0, 3)
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Report Network Issue</h1>
      <p style={styles.description}>
        If you're experiencing network connectivity issues, please fill out the form below.
        Our admin team will be notified and will respond with an estimated resolution time.
      </p>

      {success && (
        <div style={styles.success}>
          Your report has been submitted successfully. The admin team has been notified.
          {autoReply && (
            <div style={styles.autoReply}>
              System response: {autoReply}
            </div>
          )}
        </div>
      )}

      {error && <div style={styles.error}>Error: {error}</div>}
      {!isOnline && (
        <div style={styles.offlineInfo}>
          You are offline. New tickets will be saved locally and uploaded when network returns.
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Your Name <span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            required
            value={formData.userName}
            onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
            style={styles.input}
            placeholder="e.g., John Doe"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Email (optional)</label>
          <input
            type="email"
            value={formData.userEmail}
            onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
            style={styles.input}
            placeholder="your.email@example.com"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            Issue Description <span style={styles.required}>*</span>
          </label>
          <textarea
            required
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            style={styles.textarea}
            placeholder="Describe the network issue you're experiencing..."
            rows={6}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Attachment (optional, max 1MB)</label>
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) {
                setAttachment(null)
                return
              }
              if (file.size > 1024 * 1024) {
                setError('Attachment is too large. Maximum is 1MB.')
                e.currentTarget.value = ''
                return
              }
              const reader = new FileReader()
              reader.onload = () => {
                const raw = typeof reader.result === 'string' ? reader.result : ''
                const base64 = raw.includes(',') ? raw.split(',')[1] : raw
                setAttachment({
                  name: file.name,
                  contentType: file.type || 'application/octet-stream',
                  data: base64,
                })
              }
              reader.readAsDataURL(file)
            }}
            style={styles.input}
          />
          {attachment && (
            <div style={styles.ticketInfo}>Attached: {attachment.name}</div>
          )}
        </div>

        <button type="submit" disabled={submitting} style={styles.submitButton}>
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>

      <section style={styles.ticketSection}>
        <div style={styles.ticketSectionHeader}>
          <h2 style={styles.ticketTitle}>My Raised Tickets</h2>
          <div style={styles.actionsRow}>
            <button type="button" onClick={loadMyTickets} style={styles.refreshButton}>
              Refresh
            </button>
            <button
              type="button"
              onClick={syncQueuedTickets}
              disabled={syncingQueued || queuedTickets.length === 0}
              style={styles.refreshButton}
            >
              {syncingQueued ? 'Syncing...' : `Sync Offline (${queuedTickets.length})`}
            </button>
          </div>
        </div>

        {queuedTickets.length > 0 && (
          <div style={styles.ticketInfo}>
            {queuedTickets.length} ticket(s) queued offline and waiting to upload.
          </div>
        )}

        {queuedTickets.map((ticket) => (
          <article key={ticket.localId} style={styles.ticketCard}>
            <div style={styles.ticketTop}>
              <span style={styles.ticketId}>Offline Ticket ({ticket.localId})</span>
              <span style={{ ...styles.statusBadge, ...styles.pendingBadge }}>queued</span>
            </div>
            <div style={styles.ticketBlock}>
              <div style={styles.ticketLabel}>Your Issue</div>
              <div style={styles.ticketText}>{ticket.message}</div>
            </div>
            <div style={styles.ticketMeta}>
              Saved offline at: {new Date(ticket.createdAt).toLocaleString()}
            </div>
          </article>
        ))}

        {loadingTickets && <div style={styles.ticketInfo}>Loading your tickets...</div>}
        {ticketError && <div style={styles.error}>Error: {ticketError}</div>}
        {!loadingTickets && !ticketError && myTickets.length === 0 && (
          <div style={styles.ticketInfo}>You have not raised any tickets yet.</div>
        )}

        {!loadingTickets &&
          !ticketError &&
          myTickets.map((ticket) => {
            const quickFixTips = getQuickFixTips(ticket.message)
            return (
              <article key={ticket.id} style={styles.ticketCard}>
                <div style={styles.ticketTop}>
                  <span style={styles.ticketId}>Ticket #{ticket.id}</span>
                  <span
                    style={{
                      ...styles.statusBadge,
                      ...(ticket.status === 'resolved'
                        ? styles.resolvedBadge
                        : ticket.status === 'closed'
                          ? styles.closedBadge
                        : ticket.status === 'in_progress'
                          ? styles.inProgressBadge
                          : styles.pendingBadge),
                    }}
                  >
                    {formatTicketStatus(ticket.status)}
                  </span>
                </div>

                <div style={styles.ticketBlock}>
                  <div style={styles.ticketLabel}>Your Issue</div>
                  <div style={styles.ticketText}>{ticket.message}</div>
                </div>
                {ticket.attachmentName && (
                  <div style={styles.ticketBlock}>
                    <div style={styles.ticketLabel}>Attachment</div>
                    <div style={styles.ticketText}>{ticket.attachmentName}</div>
                  </div>
                )}

                <div style={styles.ticketBlock}>
                  <div style={styles.ticketLabel}>Admin Response</div>
                  <div style={styles.ticketText}>
                    {ticket.adminResponse || 'No admin response yet.'}
                  </div>
                </div>

                {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                  <div style={styles.ticketBlock}>
                    <div style={styles.ticketLabel}>Quick Self-Help (for simple issues)</div>
                    <ul style={styles.tipList}>
                      {quickFixTips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={styles.ticketMeta}>
                  SLA Due: {ticket.slaDueAt ? new Date(ticket.slaDueAt).toLocaleString() : 'N/A'}
                  {ticket.isOverdue ? ' (Overdue)' : ''} |{' '}
                  First Response:{' '}
                  {ticket.firstResponseAt ? new Date(ticket.firstResponseAt).toLocaleString() : 'N/A'} |{' '}
                  Resolved:{' '}
                  {ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString() : 'N/A'} |{' '}
                  Closed: {ticket.closedAt ? new Date(ticket.closedAt).toLocaleString() : 'N/A'} <br />
                  Created: {new Date(ticket.createdAt).toLocaleString()} | Updated:{' '}
                  {new Date(ticket.updatedAt).toLocaleString()}
                </div>
              </article>
            )
          })}
      </section>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 700,
    margin: '0 auto',
  },
  title: {
    marginBottom: '0.5rem',
    fontSize: '1.75rem',
  },
  description: {
    marginBottom: '2rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
  },
  success: {
    padding: '1rem',
    background: 'rgba(63, 185, 80, 0.1)',
    border: '1px solid var(--success)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--success)',
    marginBottom: '1.5rem',
  },
  autoReply: {
    marginTop: '0.75rem',
    color: 'var(--text-primary)',
    background: 'rgba(88, 166, 255, 0.12)',
    border: '1px solid rgba(88, 166, 255, 0.35)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.65rem 0.75rem',
  },
  error: {
    padding: '1rem',
    background: 'rgba(248, 81, 73, 0.1)',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--danger)',
    marginBottom: '1.5rem',
  },
  form: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
  },
  formGroup: {
    marginBottom: '1.25rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  required: {
    color: 'var(--danger)',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: 120,
  },
  submitButton: {
    padding: '0.75rem 1.5rem',
    background: 'var(--accent)',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
  },
  ticketSection: {
    marginTop: '2rem',
  },
  ticketSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  actionsRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  ticketTitle: {
    margin: 0,
    fontSize: '1.25rem',
  },
  offlineInfo: {
    padding: '0.85rem',
    border: '1px solid var(--warning)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--warning)',
    background: 'rgba(210, 153, 34, 0.12)',
    marginBottom: '1rem',
  },
  refreshButton: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    padding: '0.45rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  ticketInfo: {
    padding: '0.85rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    background: 'var(--bg-secondary)',
  },
  ticketCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1rem',
    marginBottom: '0.9rem',
  },
  ticketTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  ticketId: {
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  statusBadge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    borderRadius: '999px',
    padding: '0.2rem 0.55rem',
    textTransform: 'capitalize',
  },
  pendingBadge: {
    background: 'rgba(210, 153, 34, 0.2)',
    color: 'var(--warning)',
  },
  inProgressBadge: {
    background: 'rgba(88, 166, 255, 0.2)',
    color: 'var(--accent)',
  },
  resolvedBadge: {
    background: 'rgba(63, 185, 80, 0.2)',
    color: 'var(--success)',
  },
  closedBadge: {
    background: 'rgba(110, 118, 129, 0.25)',
    color: '#c9d1d9',
  },
  ticketBlock: {
    marginBottom: '0.65rem',
  },
  ticketLabel: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    marginBottom: '0.25rem',
    fontWeight: 600,
  },
  ticketText: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.65rem 0.75rem',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  tipList: {
    margin: 0,
    paddingLeft: '1.2rem',
    color: 'var(--text-primary)',
  },
  ticketMeta: {
    marginTop: '0.6rem',
    fontSize: '0.76rem',
    color: 'var(--text-secondary)',
  },
}
