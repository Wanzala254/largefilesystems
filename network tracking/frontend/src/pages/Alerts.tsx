import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { NetworkAlert, AlertSeverity, AlertStatus } from '../types/network'
import styles from './Alerts.module.css'

const severityLabels: Record<AlertSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

const typeLabels: Record<NetworkAlert['type'], string> = {
  device_offline: 'Device Offline',
  device_degraded: 'Device Degraded',
  low_speed: 'Low Speed',
  high_latency: 'High Latency',
  network_down: 'Network Down',
}

const getBorderSeverityClass = (severity: AlertSeverity): string => {
  switch (severity) {
    case 'low':
      return styles.borderLow
    case 'medium':
      return styles.borderMedium
    case 'high':
      return styles.borderHigh
    case 'critical':
      return styles.borderCritical
  }
}

const getBadgeSeverityClass = (severity: AlertSeverity): string => {
  switch (severity) {
    case 'low':
      return styles.badgeLow
    case 'medium':
      return styles.badgeMedium
    case 'high':
      return styles.badgeHigh
    case 'critical':
      return styles.badgeCritical
  }
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<NetworkAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<AlertStatus | 'all'>('all')

  const loadAlerts = async () => {
    try {
      setError(null)
      const data = await api.getAlerts(filter === 'all' ? undefined : filter)
      setAlerts(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAlerts()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadAlerts, 30000)
    return () => clearInterval(interval)
  }, [filter])

  const handleStatusChange = async (id: string, status: AlertStatus) => {
    try {
      await api.updateAlert(id, { status })
      await loadAlerts()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update alert')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return
    try {
      await api.deleteAlert(id)
      await loadAlerts()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete alert')
    }
  }

  if (loading) return <div className={styles.centered}>Loading alerts…</div>
  if (error) return <div className={styles.error}>Error: {error}</div>

  const activeCount = alerts.filter((a) => a.status === 'active').length
  const criticalCount = alerts.filter(
    (a) => a.status === 'active' && a.severity === 'critical'
  ).length

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Network Alerts</h1>
          <p className={styles.subtitle}>
            {activeCount} active alert{activeCount !== 1 ? 's' : ''}
            {criticalCount > 0 && (
              <span className={styles.criticalBadge}> • {criticalCount} critical</span>
            )}
          </p>
        </div>
        <div className={styles.filters}>
          {(['all', 'active', 'acknowledged', 'resolved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`${styles.filterButton} ${filter === f ? styles.filterButtonActive : ''}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>✓</div>
          <div className={styles.emptyText}>No alerts found</div>
          <div className={styles.emptySubtext}>
            {filter === 'all'
              ? 'All systems operational'
              : `No ${filter} alerts at this time`}
          </div>
        </div>
      ) : (
        <div className={styles.alertsList}>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`${styles.alertCard} ${getBorderSeverityClass(alert.severity)}`}
            >
              <div className={styles.alertHeader}>
                <div className={styles.alertTitleRow}>
                  <div>
                    <div className={styles.alertTitle}>{alert.title}</div>
                    <div className={styles.alertMeta}>
                      <span
                        className={`${styles.severityBadge} ${getBadgeSeverityClass(alert.severity)}`}
                      >
                        {severityLabels[alert.severity]}
                      </span>
                      <span className={styles.alertType}>{typeLabels[alert.type]}</span>
                      {alert.deviceName && (
                        <span className={styles.deviceName}>• {alert.deviceName}</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.alertStatus}>
                    <select
                      value={alert.status}
                      onChange={(e) =>
                        handleStatusChange(alert.id, e.target.value as AlertStatus)
                      }
                      className={styles.statusSelect}
                      aria-label={`Status for ${alert.title}`}
                    >
                      <option value="active">Active</option>
                      <option value="acknowledged">Acknowledged</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.alertMessage}>{alert.message}</div>

              {alert.value !== undefined && alert.threshold !== undefined && (
                <div className={styles.alertDetails}>
                  Current: {alert.value} (Threshold: {alert.threshold})
                </div>
              )}

              <div className={styles.alertFooter}>
                <div className={styles.alertTime}>
                  Created: {new Date(alert.createdAt).toLocaleString()}
                  {alert.acknowledgedAt && (
                    <> • Acknowledged: {new Date(alert.acknowledgedAt).toLocaleString()}</>
                  )}
                  {alert.resolvedAt && (
                    <> • Resolved: {new Date(alert.resolvedAt).toLocaleString()}</>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(alert.id)}
                  className={styles.deleteButton}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
