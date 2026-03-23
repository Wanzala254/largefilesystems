import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { NetworkEvent } from '../types/network'

const severityColors: Record<NetworkEvent['severity'], string> = {
  info: 'var(--accent)',
  warning: 'var(--warning)',
  error: 'var(--danger)',
}

const severityIcons: Record<NetworkEvent['severity'], string> = {
  info: 'ℹ',
  warning: '⚠',
  error: '✕',
}

export default function Events() {
  const [events, setEvents] = useState<NetworkEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadEvents = async () => {
    try {
      setError(null)
      const data = await api.getEvents()
      setEvents(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadEvents, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div style={styles.centered}>Loading events…</div>
  if (error) return <div style={styles.error}>Error: {error}</div>

  return (
    <div>
      <h1 style={styles.title}>Network Events Timeline</h1>
      <p style={styles.subtitle}>
        Chronological log of all network events and changes
      </p>

      {events.length === 0 ? (
        <div style={styles.empty}>No events recorded</div>
      ) : (
        <div style={styles.timeline}>
          {events.map((event) => (
            <div key={event.id} style={styles.eventItem}>
              <div
                style={{
                  ...styles.eventIcon,
                  background: severityColors[event.severity],
                }}
              >
                {severityIcons[event.severity]}
              </div>
              <div style={styles.eventContent}>
                <div style={styles.eventHeader}>
                  <div style={styles.eventTitle}>{event.title}</div>
                  <div style={styles.eventTime}>
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                </div>
                <div style={styles.eventDescription}>{event.description}</div>
                {event.deviceName && (
                  <div style={styles.eventDevice}>
                    Device:{' '}
                    {event.deviceId ? (
                      <Link
                        to={`/devices/${event.deviceId}`}
                        style={styles.deviceLink}
                      >
                        {event.deviceName}
                      </Link>
                    ) : (
                      event.deviceName
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    marginBottom: '0.5rem',
    fontSize: '1.75rem',
  },
  subtitle: {
    marginBottom: '1.5rem',
    color: 'var(--text-secondary)',
    fontSize: '0.9375rem',
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
  empty: {
    textAlign: 'center',
    padding: '3rem',
    color: 'var(--text-secondary)',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  },
  timeline: {
    position: 'relative',
    paddingLeft: '2rem',
  },
  eventItem: {
    position: 'relative',
    paddingBottom: '2rem',
    display: 'flex',
    gap: '1rem',
  },
  eventIcon: {
    position: 'absolute',
    left: '-2rem',
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    color: 'white',
    fontWeight: 600,
    flexShrink: 0,
  },
  eventContent: {
    flex: 1,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.25rem',
  },
  eventHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.5rem',
    gap: '1rem',
  },
  eventTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    flex: 1,
  },
  eventTime: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
  },
  eventDescription: {
    color: 'var(--text-secondary)',
    marginBottom: '0.5rem',
    lineHeight: 1.6,
  },
  eventDevice: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  deviceLink: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 500,
  },
}
