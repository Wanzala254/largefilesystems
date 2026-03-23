import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { SpeedStats, NetworkSpeed } from '../types/network'

export default function NetworkSpeed() {
  const [stats, setStats] = useState<SpeedStats | null>(null)
  const [history, setHistory] = useState<NetworkSpeed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setError(null)
      const [speedStats, speedHistory] = await Promise.all([
        api.getSpeed(),
        api.getSpeedHistory(),
      ])
      setStats(speedStats)
      setHistory(speedHistory)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load speed data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div style={styles.centered}>Loading speed data…</div>
  if (error) return <div style={styles.error}>Error: {error}</div>
  if (!stats) return null

  const maxSpeed = Math.max(
    ...history.map((s) => Math.max(s.downloadMbps, s.uploadMbps)),
    100
  )

  return (
    <div>
      <h1 style={styles.title}>Network Speed</h1>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Current Download</div>
          <div style={styles.statValue}>
            {stats.currentDownloadMbps.toFixed(2)} <span style={styles.unit}>Mbps</span>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Current Upload</div>
          <div style={styles.statValue}>
            {stats.currentUploadMbps.toFixed(2)} <span style={styles.unit}>Mbps</span>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Average Download</div>
          <div style={styles.statValue}>
            {stats.avgDownloadMbps.toFixed(2)} <span style={styles.unit}>Mbps</span>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Average Upload</div>
          <div style={styles.statValue}>
            {stats.avgUploadMbps.toFixed(2)} <span style={styles.unit}>Mbps</span>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Peak Download</div>
          <div style={styles.statValue}>
            {stats.maxDownloadMbps.toFixed(2)} <span style={styles.unit}>Mbps</span>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Peak Upload</div>
          <div style={styles.statValue}>
            {stats.maxUploadMbps.toFixed(2)} <span style={styles.unit}>Mbps</span>
          </div>
        </div>
      </div>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Speed History (Last Hour)</h2>
        <div style={styles.chartContainer}>
          <div style={styles.chart}>
            {history.map((sample) => {
              const downloadHeight = (sample.downloadMbps / maxSpeed) * 100
              const uploadHeight = (sample.uploadMbps / maxSpeed) * 100
              return (
                <div key={sample.timestamp} style={styles.chartBar}>
                  <div
                    style={{
                      ...styles.bar,
                      ...styles.downloadBar,
                      height: `${downloadHeight}%`,
                    }}
                    title={`Download: ${sample.downloadMbps.toFixed(2)} Mbps`}
                  />
                  <div
                    style={{
                      ...styles.bar,
                      ...styles.uploadBar,
                      height: `${uploadHeight}%`,
                    }}
                    title={`Upload: ${sample.uploadMbps.toFixed(2)} Mbps`}
                  />
                </div>
              )
            })}
          </div>
          <div style={styles.chartLegend}>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendColor, background: 'var(--accent)' }} />
              Download
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendColor, background: 'var(--success)' }} />
              Upload
            </div>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Speed Over Time</h2>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Time</th>
                <th style={styles.th}>Download (Mbps)</th>
                <th style={styles.th}>Upload (Mbps)</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(-20).reverse().map((sample) => (
                <tr key={sample.timestamp} style={styles.tr}>
                  <td style={styles.td}>
                    {new Date(sample.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.speedValue}>
                      {sample.downloadMbps.toFixed(2)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.speedValue}>
                      {sample.uploadMbps.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p style={styles.updated}>
        Last updated: {new Date(stats.lastUpdated).toLocaleString()}
      </p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  title: { marginBottom: '1.5rem', fontSize: '1.75rem' },
  centered: {
    textAlign: 'center',
    padding: '3rem',
    color: 'var(--text-secondary)',
  },
  error: { color: 'var(--danger)', padding: '1rem' },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.25rem',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginBottom: '0.5rem',
  },
  statValue: {
    fontSize: '1.75rem',
    fontWeight: 600,
    color: 'var(--accent)',
  },
  unit: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    fontWeight: 400,
  },
  section: { marginBottom: '2rem' },
  sectionTitle: {
    fontSize: '1.125rem',
    marginBottom: '1rem',
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
    marginBottom: '1rem',
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
  chartLegend: {
    display: 'flex',
    gap: '1.5rem',
    justifyContent: 'center',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  tableWrap: {
    overflowX: 'auto',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid var(--border)',
    fontWeight: 600,
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: {
    padding: '0.75rem 1rem',
    fontSize: '0.9375rem',
  },
  speedValue: {
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 500,
  },
  updated: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
}
