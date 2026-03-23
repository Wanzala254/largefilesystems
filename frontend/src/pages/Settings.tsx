import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { NotificationPreferences, Settings } from '../types/network'

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null)

  useEffect(() => {
    Promise.all([api.getSettings(), api.getNotificationPreferences()])
      .then(([data, pref]) => {
        setSettings({
          ...data,
          topology: data.topology || { maxDepth: 6 },
          ticketing: data.ticketing || { slaHours: 4 },
        })
        setNotificationPreferences(pref)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await api.updateSettings(settings)
      if (notificationPreferences) {
        await api.updateNotificationPreferences(notificationPreferences)
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={styles.centered}>Loading settings…</div>
  if (!settings) return null

  return (
    <div>
      <h1 style={styles.title}>Settings</h1>
      <p style={styles.subtitle}>Configure network monitoring thresholds and preferences</p>

      {success && (
        <div style={styles.success}>Settings saved successfully!</div>
      )}
      {error && <div style={styles.error}>Error: {error}</div>}

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Alert Thresholds</h2>
        <div style={styles.card}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              High Latency Threshold (ms)
            </label>
            <input
              type="number"
              value={settings.alertThresholds.latencyMs}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  alertThresholds: {
                    ...settings.alertThresholds,
                    latencyMs: parseInt(e.target.value) || 0,
                  },
                })
              }
              style={styles.input}
              min="1"
            />
            <div style={styles.helpText}>
              Alerts will trigger when device latency exceeds this value
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Low Download Speed Threshold (Mbps)
            </label>
            <input
              type="number"
              value={settings.alertThresholds.downloadMbps}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  alertThresholds: {
                    ...settings.alertThresholds,
                    downloadMbps: parseFloat(e.target.value) || 0,
                  },
                })
              }
              style={styles.input}
              min="0"
              step="0.1"
            />
            <div style={styles.helpText}>
              Alerts will trigger when download speed drops below this value
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Low Upload Speed Threshold (Mbps)
            </label>
            <input
              type="number"
              value={settings.alertThresholds.uploadMbps}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  alertThresholds: {
                    ...settings.alertThresholds,
                    uploadMbps: parseFloat(e.target.value) || 0,
                  },
                })
              }
              style={styles.input}
              min="0"
              step="0.1"
            />
            <div style={styles.helpText}>
              Alerts will trigger when upload speed drops below this value
            </div>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Auto-Refresh</h2>
        <div style={styles.card}>
          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.autoRefresh}
                onChange={(e) =>
                  setSettings({ ...settings, autoRefresh: e.target.checked })
                }
                style={styles.checkbox}
              />
              Enable auto-refresh
            </label>
          </div>

          {settings.autoRefresh && (
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Refresh Interval (seconds)
              </label>
              <input
                type="number"
                value={settings.refreshInterval}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    refreshInterval: parseInt(e.target.value) || 30,
                  })
                }
                style={styles.input}
                min="5"
                max="300"
              />
              <div style={styles.helpText}>
                How often to automatically refresh data (5-300 seconds)
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Notifications</h2>
        <div style={styles.card}>
          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.notifications.browser}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      browser: e.target.checked,
                    },
                  })
                }
                style={styles.checkbox}
              />
              Browser notifications
            </label>
            <div style={styles.helpText}>
              Show browser notifications for critical alerts
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.notifications.email}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      email: e.target.checked,
                    },
                  })
                }
                style={styles.checkbox}
              />
              Email notifications
            </label>
            <div style={styles.helpText}>
              Send email alerts for critical network issues
            </div>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Topology</h2>
        <div style={styles.card}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Maximum Topology Depth</label>
            <input
              type="number"
              value={settings.topology.maxDepth}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  topology: {
                    ...settings.topology,
                    maxDepth: parseInt(e.target.value) || 6,
                  },
                })
              }
              style={styles.input}
              min="2"
              max="12"
            />
            <div style={styles.helpText}>
              Limits hierarchy depth for device branches (allowed range: 2 to 12)
            </div>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Ticketing SLA</h2>
        <div style={styles.card}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Ticket SLA Target (hours)</label>
            <input
              type="number"
              value={settings.ticketing.slaHours}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ticketing: {
                    ...settings.ticketing,
                    slaHours: parseInt(e.target.value) || 4,
                  },
                })
              }
              style={styles.input}
              min="1"
              max="72"
            />
            <div style={styles.helpText}>
              New tickets are marked overdue when this SLA time is exceeded before resolution
            </div>
          </div>
        </div>
      </div>

      {notificationPreferences && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>My Notification Preferences</h2>
          <div style={styles.card}>
            <div style={styles.formGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={notificationPreferences.inAppEnabled}
                  onChange={(e) =>
                    setNotificationPreferences({
                      ...notificationPreferences,
                      inAppEnabled: e.target.checked,
                    })
                  }
                  style={styles.checkbox}
                />
                In-app notifications
              </label>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={notificationPreferences.ticketUpdates}
                  onChange={(e) =>
                    setNotificationPreferences({
                      ...notificationPreferences,
                      ticketUpdates: e.target.checked,
                    })
                  }
                  style={styles.checkbox}
                />
                Ticket updates
              </label>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={notificationPreferences.alertUpdates}
                  onChange={(e) =>
                    setNotificationPreferences({
                      ...notificationPreferences,
                      alertUpdates: e.target.checked,
                    })
                  }
                  style={styles.checkbox}
                />
                Alert updates
              </label>
            </div>
          </div>
        </div>
      )}

      <div style={styles.actions}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={styles.saveButton}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
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
  success: {
    padding: '1rem',
    background: 'rgba(63, 185, 80, 0.1)',
    border: '1px solid var(--success)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--success)',
    marginBottom: '1.5rem',
  },
  error: {
    padding: '1rem',
    background: 'rgba(248, 81, 73, 0.1)',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--danger)',
    marginBottom: '1.5rem',
  },
  section: {
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    marginBottom: '1rem',
  },
  card: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
  },
  formGroup: {
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    maxWidth: 300,
    padding: '0.75rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    fontFamily: 'inherit',
  },
  helpText: {
    marginTop: '0.5rem',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  },
  actions: {
    marginTop: '2rem',
  },
  saveButton: {
    padding: '0.75rem 1.5rem',
    background: 'var(--accent)',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
}
