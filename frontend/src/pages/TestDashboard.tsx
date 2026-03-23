import { useEffect, useState } from 'react'
import styles from './Dashboard.module.css'

export default function TestDashboard() {
  const [stats, setStats] = useState<{
    totalDevices: number
    onlineCount: number
    offlineCount: number
    avgLatencyMs: number
    lastUpdated: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data for testing
    const mockStats = {
      totalDevices: 8,
      onlineCount: 6,
      offlineCount: 2,
      avgLatencyMs: 15,
      lastUpdated: new Date().toISOString()
    }
    
    setTimeout(() => {
      setStats(mockStats)
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading network data...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className={styles.centered}>
        <p>No data available</p>
      </div>
    )
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1 className={styles.title}>Test Dashboard</h1>
        <div className={styles.lastUpdated}>
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>🖥️</div>
          <div className={styles.metricContent}>
            <div className={styles.metricLabel}>Total Devices</div>
            <div className={styles.metricValue}>{stats.totalDevices}</div>
          </div>
        </div>
        
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>🟢</div>
          <div className={styles.metricContent}>
            <div className={`${styles.metricLabel} ${styles.colorSuccess}`}>Online</div>
            <div className={`${styles.metricValue} ${styles.colorSuccess}`}>
              {stats.onlineCount}
            </div>
          </div>
        </div>
        
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>🔴</div>
          <div className={styles.metricContent}>
            <div className={`${styles.metricLabel} ${styles.colorDanger}`}>Offline</div>
            <div className={`${styles.metricValue} ${styles.colorDanger}`}>
              {stats.offlineCount}
            </div>
          </div>
        </div>
        
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>📊</div>
          <div className={styles.metricContent}>
            <div className={styles.metricLabel}>Uptime</div>
            <div className={styles.metricValue}>
              {Math.round((stats.onlineCount / stats.totalDevices) * 100)}%
            </div>
          </div>
        </div>
        
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>⚡</div>
          <div className={styles.metricContent}>
            <div className={styles.metricLabel}>Avg Latency</div>
            <div className={styles.metricValue}>{stats.avgLatencyMs} ms</div>
          </div>
        </div>
      </div>

      <div className={styles.statusIndicator}>
        <span className={styles.statusIcon}>
          🟡
        </span>
        <span className={styles.statusText}>
          {stats.offlineCount} device(s) offline - Using test data
        </span>
      </div>
    </div>
  )
}
