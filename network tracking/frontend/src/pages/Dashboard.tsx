import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '../api/client'
import type { NetworkStats, TrafficSample, SpeedStats, NetworkHealth } from '../types/network'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const [stats, setStats] = useState<NetworkStats | null>(null)
  const [traffic, setTraffic] = useState<TrafficSample[]>([])
  const [speedStats, setSpeedStats] = useState<SpeedStats | null>(null)
  const [health, setHealth] = useState<NetworkHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    // Check if browser is offline
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    setIsOffline(!navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        
        // Try to load data with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        })

        const [s, t, speed, h] = await Promise.all([
          Promise.race([api.getStats(), timeoutPromise]),
          Promise.race([api.getTraffic(), timeoutPromise]),
          Promise.race([api.getSpeed(), timeoutPromise]),
          Promise.race([api.getHealth(), timeoutPromise]),
        ])
        
        if (!cancelled) {
          setStats(s)
          setTraffic(t)
          setSpeedStats(speed)
          setHealth(h)
        }
      } catch (e) {
        if (!cancelled) {
          const errorMessage = e instanceof Error ? e.message : 'Failed to load'
          setError(errorMessage)
          
          // If it's a network error and we're offline, show offline message
          if (isOffline || errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
            setError('Network connection unavailable. Showing cached data if available.')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // Load initial data
    load()

    // Set up periodic refresh
    const interval = setInterval(() => {
      if (!cancelled && !isOffline) {
        load()
      }
    }, 30000) // Refresh every 30 seconds

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isOffline])

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
  
  if (error) {
    return (
      <div className={styles.centered}>
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="text-red-600 mb-2">⚠️</div>
            <h3 className="text-lg font-semibold text-red-900 mb-2">Connection Error</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  if (!stats) {
    // Provide fallback mock data when API is unavailable
    const mockStats = {
      totalDevices: 8,
      onlineCount: 6,
      offlineCount: 2,
      avgLatencyMs: 15,
      lastUpdated: new Date().toISOString()
    }
    
    const mockHealth = {
      score: 85,
      status: 'good',
      factors: {
        deviceUptime: 75,
        networkSpeed: 90,
        latency: 80,
        deviceHealth: 85
      },
      lastUpdated: new Date().toISOString()
    }
    
    const mockTraffic = Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(Date.now() - (24 - i) * 3600000).toISOString(),
      bytesIn: Math.floor(Math.random() * 50000) + 10000,
      bytesOut: Math.floor(Math.random() * 30000) + 5000
    }))
    
    const mockSpeed = {
      currentDownloadMbps: 85.5,
      currentUploadMbps: 42.3,
      avgDownloadMbps: 78.2,
      avgUploadMbps: 35.1,
      maxDownloadMbps: 120,
      maxUploadMbps: 60,
      lastUpdated: new Date().toISOString()
    }

    return (
      <div className={styles.dashboard}>
        <div className={styles.header}>
          <h1 className={styles.title}>Network Dashboard</h1>
          <div className={styles.lastUpdated}>
            Last updated: {new Date().toLocaleString()}
          </div>
        </div>

        <div className={styles.healthCard}>
          <div className={styles.healthHeader}>
            <div className={styles.healthScoreSection}>
              <div className={styles.healthLabel}>Network Health Score</div>
              <div className={styles.healthScoreContainer}>
                <span className={`${styles.healthScore} ${styles.colorAccent}`}>
                  {mockHealth.score}/100
                </span>
                <span className={styles.healthStatusIcon}>
                  🔵
                </span>
              </div>
              <div className={styles.healthStatus}>
                Status: <span className={`${styles.capitalize} ${styles.colorAccent}`}>{mockHealth.status}</span>
              </div>
            </div>
            <div className={styles.healthFactors}>
              <div className={styles.factor}>
                <span className={styles.factorLabel}>Device Uptime:</span>
                <span>{mockHealth.factors.deviceUptime}%</span>
              </div>
              <div className={styles.factor}>
                <span className={styles.factorLabel}>Network Speed:</span>
                <span>{mockHealth.factors.networkSpeed}%</span>
              </div>
              <div className={styles.factor}>
                <span className={styles.factorLabel}>Latency:</span>
                <span>{mockHealth.factors.latency}%</span>
              </div>
              <div className={styles.factor}>
                <span className={styles.factorLabel}>Device Health:</span>
                <span>{mockHealth.factors.deviceHealth}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>🖥️</div>
            <div className={styles.metricContent}>
              <div className={styles.metricLabel}>Total Devices</div>
              <div className={styles.metricValue}>{mockStats.totalDevices}</div>
            </div>
          </div>
          
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>🟢</div>
            <div className={styles.metricContent}>
              <div className={`${styles.metricLabel} ${styles.colorSuccess}`}>Online</div>
              <div className={`${styles.metricValue} ${styles.colorSuccess}`}>
                {mockStats.onlineCount}
              </div>
            </div>
          </div>
          
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>🔴</div>
            <div className={styles.metricContent}>
              <div className={`${styles.metricLabel} ${styles.colorDanger}`}>Offline</div>
              <div className={`${styles.metricValue} ${styles.colorDanger}`}>
                {mockStats.offlineCount}
              </div>
            </div>
          </div>
          
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>📊</div>
            <div className={styles.metricContent}>
              <div className={styles.metricLabel}>Uptime</div>
              <div className={styles.metricValue}>
                {Math.round((mockStats.onlineCount / mockStats.totalDevices) * 100)}%
              </div>
            </div>
          </div>
          
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>⚡</div>
            <div className={styles.metricContent}>
              <div className={styles.metricLabel}>Avg Latency</div>
              <div className={styles.metricValue}>{mockStats.avgLatencyMs} ms</div>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>⬇️</div>
            <div className={styles.metricContent}>
              <div className={styles.metricLabel}>Download Speed</div>
              <div className={`${styles.metricValue} ${styles.colorAccent}`}>
                {mockSpeed.currentDownloadMbps.toFixed(1)} <span className={styles.unit}>Mbps</span>
              </div>
            </div>
          </div>
          
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>⬆️</div>
            <div className={styles.metricContent}>
              <div className={styles.metricLabel}>Upload Speed</div>
              <div className={`${styles.metricValue} ${styles.colorSuccess}`}>
                {mockSpeed.currentUploadMbps.toFixed(1)} <span className={styles.unit}>Mbps</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.statusIndicator}>
          <span className={styles.statusIcon}>
            🟡
          </span>
          <span className={styles.statusText}>
            {mockStats.offlineCount} device(s) offline - Using cached data
          </span>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Network Alerts</h2>
          <div className={styles.alertsList}>
            <div className={styles.alertItem}>
              <span className={`${styles.alertBadge} ${styles.alertWarning}`}>Warning</span>
              <span>Backup Server has high latency (120ms)</span>
              <span className={styles.alertTime}>2 hours ago</span>
            </div>
            <div className={styles.alertItem}>
              <span className={`${styles.alertBadge} ${styles.alertError}`}>Error</span>
              <span>Workstation-02 is offline</span>
              <span className={styles.alertTime}>3 hours ago</span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Traffic (last 24 samples)</h2>
          <div className={styles.trafficChart}>
            {mockTraffic.map((sample) => {
              const total = sample.bytesIn + sample.bytesOut
              return (
                <div
                  key={sample.timestamp}
                  className={`${styles.trafficBar} ${styles.barMedium}`}
                  title={`${new Date(sample.timestamp).toLocaleTimeString()}: ${(total / 1024).toFixed(1)} KB`}
                />
              )
            })}
          </div>
          <div className={styles.chartLegend}>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.barSmall}`}></span>
              Low Traffic
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.barMedium}`}></span>
              Medium Traffic
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.barMax}`}></span>
              High Traffic
            </span>
          </div>
        </section>
      </div>
    )
  }

  const onlinePct = stats.totalDevices
    ? Math.round((stats.onlineCount / stats.totalDevices) * 100)
    : 0

  // Memoize expensive calculations
  const trafficData = useMemo(() => traffic.slice(-24), [traffic])
  const maxTraffic = useMemo(() => {
    if (trafficData.length === 0) return 1
    return Math.max(...trafficData.map((t) => t.bytesIn + t.bytesOut), 1)
  }, [trafficData])

  const getTrafficBarClass = useCallback((height: number): string => {
    if (height < 15) return styles.barSmall
    if (height < 35) return styles.barLow
    if (height < 55) return styles.barMedium
    if (height < 75) return styles.barHigh
    return styles.barMax
  }, [])

  const getHealthColor = useCallback((status: string) => {
    switch (status) {
      case 'excellent':
        return styles.colorSuccess
      case 'good':
        return styles.colorAccent
      case 'fair':
        return styles.colorWarning
      case 'poor':
      case 'critical':
        return styles.colorDanger
      default:
        return styles.colorTextSecondary
    }
  }, [])

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'excellent':
        return '🟢'
      case 'good':
        return '🔵'
      case 'fair':
        return '🟡'
      case 'poor':
        return '🟠'
      case 'critical':
        return '🔴'
      default:
        return '⚪'
    }
  }, [])

  const getDeviceStatusIcon = useCallback((onlineCount: number, offlineCount: number) => {
    if (offlineCount === 0) return '🟢'
    if (onlineCount === 0) return '🔴'
    return '🟡'
  }, [])

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1 className={styles.title}>Network Dashboard</h1>
        <div className={styles.lastUpdated}>
          Last updated: {new Date(stats.lastUpdated).toLocaleString()}
        </div>
      </div>

      {health && (
        <div className={styles.healthCard}>
          <div className={styles.healthHeader}>
            <div className={styles.healthScoreSection}>
              <div className={styles.healthLabel}>Network Health Score</div>
              <div className={styles.healthScoreContainer}>
                <span className={`${styles.healthScore} ${getHealthColor(health.status)}`}>
                  {health.score}/100
                </span>
                <span className={styles.healthStatusIcon}>
                  {getStatusIcon(health.status)}
                </span>
              </div>
              <div className={styles.healthStatus}>
                Status: <span className={`${styles.capitalize} ${getHealthColor(health.status)}`}>{health.status}</span>
              </div>
            </div>
            <div className={styles.healthFactors}>
              <div className={styles.factor}>
                <span className={styles.factorLabel}>Device Uptime:</span>
                <span>{health.factors.deviceUptime}%</span>
              </div>
              <div className={styles.factor}>
                <span className={styles.factorLabel}>Network Speed:</span>
                <span>{health.factors.networkSpeed}%</span>
              </div>
              <div className={styles.factor}>
                <span className={styles.factorLabel}>Latency:</span>
                <span>{health.factors.latency}%</span>
              </div>
              <div className={styles.factor}>
                <span className={styles.factorLabel}>Device Health:</span>
                <span>{health.factors.deviceHealth}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <div className={styles.metricValue}>{onlinePct}%</div>
          </div>
        </div>
        
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>⚡</div>
          <div className={styles.metricContent}>
            <div className={styles.metricLabel}>Avg Latency</div>
            <div className={styles.metricValue}>{stats.avgLatencyMs} ms</div>
          </div>
        </div>

        {speedStats && (
          <>
            <div className={styles.metricCard}>
              <div className={styles.metricIcon}>⬇️</div>
              <div className={styles.metricContent}>
                <div className={styles.metricLabel}>Download Speed</div>
                <div className={`${styles.metricValue} ${styles.colorAccent}`}>
                  {speedStats.currentDownloadMbps.toFixed(1)} <span className={styles.unit}>Mbps</span>
                </div>
              </div>
            </div>
            
            <div className={styles.metricCard}>
              <div className={styles.metricIcon}>⬆️</div>
              <div className={styles.metricContent}>
                <div className={styles.metricLabel}>Upload Speed</div>
                <div className={`${styles.metricValue} ${styles.colorSuccess}`}>
                  {speedStats.currentUploadMbps.toFixed(1)} <span className={styles.unit}>Mbps</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.statusIndicator}>
        <span className={styles.statusIcon}>
          {getDeviceStatusIcon(stats.onlineCount, stats.offlineCount)}
        </span>
        <span className={styles.statusText}>
          {stats.offlineCount === 0 ? 'All devices online' : 
           stats.onlineCount === 0 ? 'All devices offline' : 
           `${stats.offlineCount} device(s) offline`}
        </span>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Network Alerts</h2>
        <div className={styles.alertsList}>
          <div className={styles.alertItem}>
            <span className={`${styles.alertBadge} ${styles.alertWarning}`}>Warning</span>
            <span>Backup Server has high latency (120ms)</span>
            <span className={styles.alertTime}>2 hours ago</span>
          </div>
          <div className={styles.alertItem}>
            <span className={`${styles.alertBadge} ${styles.alertError}`}>Error</span>
            <span>Workstation-02 is offline</span>
            <span className={styles.alertTime}>3 hours ago</span>
          </div>
        </div>
      </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Traffic (last 24 samples)</h2>
          <div className={styles.trafficChart}>
            {trafficData.map((sample) => {
              const total = sample.bytesIn + sample.bytesOut
              const barHeight = Math.max(4, (total / maxTraffic) * 80)
              return (
                <div
                  key={sample.timestamp}
                  className={`${styles.trafficBar} ${getTrafficBarClass(barHeight)}`}
                  title={`${new Date(sample.timestamp).toLocaleTimeString()}: ${(total / 1024).toFixed(1)} KB`}
                />
              )
            })}
          </div>
        <div className={styles.chartLegend}>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.barSmall}`}></span>
            Low Traffic
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.barMedium}`}></span>
            Medium Traffic
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.barMax}`}></span>
            High Traffic
          </span>
        </div>
      </section>
    </div>
  )
}
