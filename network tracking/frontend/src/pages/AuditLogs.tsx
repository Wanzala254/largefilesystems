import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AuditLogItem } from '../types/network'

export default function AuditLogs() {
  const [items, setItems] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setError(null)
      const data = await api.getAuditLogs(200)
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <div style={styles.center}>Loading audit logs...</div>
  if (error) return <div style={styles.error}>Error: {error}</div>

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Audit Logs</h1>
        <button type="button" onClick={load} style={styles.refresh}>
          Refresh
        </button>
      </div>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Time</th>
              <th style={styles.th}>Actor</th>
              <th style={styles.th}>Action</th>
              <th style={styles.th}>Target</th>
              <th style={styles.th}>IP</th>
            </tr>
          </thead>
          <tbody>
            {items.map((log) => (
              <tr key={log.id}>
                <td style={styles.td}>{new Date(log.createdAt).toLocaleString()}</td>
                <td style={styles.td}>
                  {log.actorUsername || 'system'} ({log.actorRole || '-'})
                </td>
                <td style={styles.td}>{log.action}</td>
                <td style={styles.td}>
                  {log.targetType || '-'} {log.targetId ? `#${log.targetId}` : ''}
                </td>
                <td style={styles.td}>{log.ip || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  title: {
    margin: 0,
    fontSize: '1.75rem',
  },
  refresh: {
    border: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.4rem 0.7rem',
    cursor: 'pointer',
  },
  tableWrap: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    background: 'var(--bg-secondary)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '0.7rem',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '0.65rem 0.7rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.85rem',
  },
  center: {
    padding: '2rem',
    textAlign: 'center',
  },
  error: {
    color: 'var(--danger)',
  },
}
