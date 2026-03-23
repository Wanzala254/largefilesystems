import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { DeviceDetails, DeviceStatus } from '../types/network'

const statusColors: Record<DeviceStatus, string> = {
  online: 'var(--success)',
  offline: 'var(--danger)',
  degraded: 'var(--warning)',
  unknown: 'var(--text-secondary)',
}

const typeLabels: Record<string, string> = {
  router: 'Router',
  switch: 'Switch',
  server: 'Server',
  workstation: 'Workstation',
  other: 'Other',
}

export default function DeviceDetails() {
  const { id } = useParams<{ id: string }>()
  const [device, setDevice] = useState<DeviceDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api
      .getDeviceDetails(id)
      .then(setDevice)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={styles.centered}>Loading device details…</div>
  if (error) return <div style={styles.error}>Error: {error}</div>
  if (!device) return null

  const maxLatency = Math.max(...device.history.map((h) => h.latencyMs || 0), 1)
  const maxSpeed = Math.max(
    ...device.history.map((h) => Math.max(h.downloadMbps || 0, h.uploadMbps || 0)),
    1
  )

  return (
    <div>
      <div style={styles.header}>
        <Link to="/devices" style={styles.backLink}>← Back to Devices</Link>
        <h1 style={styles.title}>{device.name}</h1>
      </div>

      <div style={styles.grid}>
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Device Information</h2>
          <div style={styles.infoCard}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Status:</span>
              <span
                style={{
                  ...styles.statusBadge,
                  background: statusColors[device.status],
                }}
              >
                {device.status}
              </span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Type:</span>
              <span>{typeLabels[device.type]}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>IP Address:</span>
              <code style={styles.code}>{device.ip}</code>
            </div>
            {device.mac && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>MAC Address:</span>
                <code style={styles.code}>{device.mac}</code>
              </div>
            )}
            {device.location && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Location:</span>
                <span>{device.location}</span>
              </div>
            )}
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Last Seen:</span>
              <span>{new Date(device.lastSeen).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Performance Metrics</h2>
          <div style={styles.metricsGrid}>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Uptime</div>
              <div style={styles.metricValue}>{device.uptime}%</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Avg Latency</div>
              <div style={styles.metricValue}>{device.avgLatency} ms</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Current Latency</div>
              <div style={styles.metricValue}>
                {device.latencyMs ? `${device.latencyMs} ms` : '—'}
              </div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Total Alerts</div>
              <div style={styles.metricValue}>{device.totalAlerts}</div>
            </div>
          </div>
          {device.lastAlert && (
            <div style={styles.alertInfo}>
              Last Alert: {new Date(device.lastAlert).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Performance History (Last 24 Hours)</h2>
        <div style={styles.chartContainer}>
          <div style={styles.chart}>
            {device.history.map((sample) => {
              const latencyHeight = sample.latencyMs
                ? Math.max(4, (sample.latencyMs / maxLatency) * 100)
                : 0
              return (
                <div key={sample.timestamp} style={styles.chartBar}>
                  <div
                    style={{
                      ...styles.bar,
                      height: `${latencyHeight}%`,
                      background: statusColors[sample.status],
                    }}
                    title={`${new Date(sample.timestamp).toLocaleTimeString()}: ${sample.latencyMs || 0}ms`}
                  />
                </div>
              )
            })}
          </div>
          <div style={styles.chartLabel}>Latency (ms)</div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Speed History</h2>
        <div style={styles.chartContainer}>
          <div style={styles.chart}>
            {device.history.map((sample) => {
              const downloadHeight = sample.downloadMbps
                ? Math.max(4, ((sample.downloadMbps || 0) / maxSpeed) * 100)
                : 0
              const uploadHeight = sample.uploadMbps
                ? Math.max(4, ((sample.uploadMbps || 0) / maxSpeed) * 100)
                : 0
              return (
                <div key={sample.timestamp} style={styles.chartBar}>
                  <div
                    style={{
                      ...styles.bar,
                      ...styles.downloadBar,
                      height: `${downloadHeight}%`,
                    }}
                    title={`Download: ${sample.downloadMbps?.toFixed(1) || 0} Mbps`}
                  />
                  <div
                    style={{
                      ...styles.bar,
                      ...styles.uploadBar,
                      height: `${uploadHeight}%`,
                    }}
                    title={`Upload: ${sample.uploadMbps?.toFixed(1) || 0} Mbps`}
                  />
                </div>
              )
            })}
          </div>
          <div style={styles.chartLabel}>Speed (Mbps)</div>
        </div>
      </section>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    marginBottom: '1.5rem',
  },
  backLink: {
    display: 'inline-block',
    marginBottom: '0.5rem',
    color: 'var(--accent)',
    textDecoration: 'none',
    fontSize: '0.9375rem',
  },
  title: {
    margin: 0,
    fontSize: '1.75rem',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  section: {
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    marginBottom: '1rem',
  },
  infoCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.25rem',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 0',
    borderBottom: '1px solid var(--border)',
  },
  infoLabel: {
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  statusBadge: {
    padding: '0.25rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'white',
  },
  code: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.875rem',
    background: 'var(--bg-tertiary)',
    padding: '0.2em 0.4em',
    borderRadius: 4,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '1rem',
  },
  metricCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1rem',
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginBottom: '0.5rem',
  },
  metricValue: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--accent)',
  },
  alertInfo: {
    marginTop: '1rem',
    padding: '0.75rem',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  chartContainer: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
  },
  chart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '2px',
    height: 200,
    marginBottom: '0.5rem',
  },
  chartBar: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    gap: '2px',
    minWidth: 4,
  },
  bar: {
    width: '100%',
    borderRadius: 2,
    minHeight: 2,
  },
  downloadBar: {
    background: 'var(--accent)',
  },
  uploadBar: {
    background: 'var(--success)',
  },
  chartLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
}
