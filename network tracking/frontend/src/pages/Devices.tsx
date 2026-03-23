import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { NetworkDevice, DeviceStatus } from '../types/network'
import styles from './Devices.module.css'

const typeLabels: Record<NetworkDevice['type'], string> = {
  router: 'Router',
  switch: 'Switch',
  server: 'Server',
  workstation: 'Workstation',
  other: 'Other',
}

const deviceTypes: NetworkDevice['type'][] = ['router', 'switch', 'server', 'workstation', 'other']
const parentEligibleTypes: NetworkDevice['type'][] = ['server', 'router', 'switch']

const getStatusColorClass = (status: DeviceStatus): string => {
  switch (status) {
    case 'online':
      return styles.statusOnline
    case 'offline':
      return styles.statusOffline
    case 'degraded':
      return styles.statusDegraded
    case 'unknown':
      return styles.statusUnknown
  }
}

type DisplayDevice = {
  device: NetworkDevice
  depth: number
}

export default function Devices() {
  const [devices, setDevices] = useState<NetworkDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [updatingConnection, setUpdatingConnection] = useState<string | null>(null)

  const loadDevices = async () => {
    try {
      setError(null)
      const data = await api.getDevices()
      setDevices(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
  }, [])

  const childrenMap = useMemo(() => {
    return devices.reduce<Record<string, NetworkDevice[]>>((acc, d) => {
      if (!d.parentId) return acc
      if (!acc[d.parentId]) acc[d.parentId] = []
      acc[d.parentId].push(d)
      return acc
    }, {})
  }, [devices])

  const orderedDevices = useMemo<DisplayDevice[]>(() => {
    const roots = devices.filter((d) => !d.parentId || !devices.find((x) => x.id === d.parentId))
    const list: DisplayDevice[] = []
    const seen = new Set<string>()

    const addBranch = (device: NetworkDevice, depth: number) => {
      if (seen.has(device.id)) return
      seen.add(device.id)
      list.push({ device, depth })
      const children = (childrenMap[device.id] || []).sort((a, b) => a.name.localeCompare(b.name))
      children.forEach((child) => addBranch(child, depth + 1))
    }

    roots.sort((a, b) => a.name.localeCompare(b.name)).forEach((root) => addBranch(root, 0))
    devices.filter((d) => !seen.has(d.id)).forEach((d) => addBranch(d, 0))
    return list
  }, [devices, childrenMap])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this device?')) return

    try {
      setDeleting(id)
      await api.deleteDevice(id)
      await loadDevices()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete device')
    } finally {
      setDeleting(null)
    }
  }

  const handleTestDevice = async (id: string) => {
    try {
      setTesting(id)
      const result = await api.testDevice(id)
      setDevices((prev) => prev.map((d) => (d.id === id ? result.device : d)))
      if (result.probe.reachable) {
        const latencyText =
          result.probe.latencyMs != null ? `${result.probe.latencyMs} ms` : 'latency unavailable'
        const via = result.probe.method ? ` via ${result.probe.method}` : ''
        alert(`Device reachable and online${via}: ${latencyText}`)
      } else {
        const hint = result.probe.hint
        alert(
          hint ||
            'Device not reachable from backend host. Check routing/VPN/firewall for this IP.'
        )
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to test device')
    } finally {
      setTesting(null)
    }
  }

  const handleConnectionChange = async (id: string, parentId: string) => {
    try {
      setUpdatingConnection(id)
      const updated = await api.updateDeviceConnection(id, parentId || undefined)
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update connection')
    } finally {
      setUpdatingConnection(null)
    }
  }

  if (loading) return <div className={styles.centered}>Loading devices...</div>
  if (error) return <div className={styles.error}>Error: {error}</div>

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Network devices</h1>
        <button onClick={() => setShowAddForm(true)} className={styles.addButton}>
          + Add Device
        </button>
      </div>

      {showAddForm && (
        <AddDeviceForm
          devices={devices}
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            setShowAddForm(false)
            loadDevices()
          }}
        />
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>IP</th>
              <th className={styles.th}>Type</th>
              <th className={styles.th}>Topology</th>
              <th className={styles.th}>Latency</th>
              <th className={styles.th}>Last seen</th>
              <th className={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orderedDevices.map(({ device: d, depth }) => {
              const childCount = (childrenMap[d.id] || []).length
              const parentName = d.parentId ? devices.find((x) => x.id === d.parentId)?.name : null
              return (
                <tr key={d.id} className={styles.tr}>
                  <td className={styles.td}>
                    <span
                      className={`${styles.statusDot} ${getStatusColorClass(d.status)}`}
                      title={d.status}
                    />
                    {d.status}
                  </td>
                  <td className={styles.td}>
                    <Link to={`/devices/${d.id}`} className={styles.nameLink}>
                      <span className={styles.name} style={{ paddingLeft: `${depth * 1.1}rem` }}>
                        {depth > 0 ? '└ ' : ''}
                        {d.name}
                      </span>
                    </Link>
                    {d.location && <span className={styles.location}>{d.location}</span>}
                  </td>
                  <td className={styles.td}>
                    <code className={styles.code}>{d.ip}</code>
                  </td>
                  <td className={styles.td}>{typeLabels[d.type]}</td>
                  <td className={styles.td}>
                    <div>
                      <div style={{ marginBottom: '0.35rem' }}>
                        {parentName
                          ? `Branch of ${parentName}`
                          : childCount > 0
                            ? `Main (${childCount} branches)`
                            : 'Standalone'}
                      </div>
                      <select
                        value={d.parentId || ''}
                        disabled={updatingConnection === d.id}
                        className={styles.select}
                        onChange={(e) => handleConnectionChange(d.id, e.target.value)}
                      >
                        <option value="">No parent (main)</option>
                        {devices
                          .filter(
                            (candidate) =>
                              candidate.id !== d.id && parentEligibleTypes.includes(candidate.type)
                          )
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name} ({candidate.type})
                            </option>
                          ))}
                      </select>
                    </div>
                  </td>
                  <td className={styles.td}>{d.latencyMs != null ? `${d.latencyMs} ms` : '-'}</td>
                  <td className={styles.td}>{new Date(d.lastSeen).toLocaleString()}</td>
                  <td className={styles.td}>
                    <button
                      onClick={() => handleTestDevice(d.id)}
                      disabled={testing === d.id}
                      className={`${styles.testButton} ${testing === d.id ? styles.testButtonDisabled : ''}`}
                    >
                      {testing === d.id ? 'Testing...' : 'Test'}
                    </button>
                    {(d.status === 'offline' || d.status === 'degraded') && (
                      <button
                        onClick={() => handleDelete(d.id)}
                        disabled={deleting === d.id}
                        className={`${styles.deleteButton} ${deleting === d.id ? styles.deleteButtonDisabled : ''}`}
                      >
                        {deleting === d.id ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AddDeviceForm({
  devices,
  onClose,
  onSuccess,
}: {
  devices: NetworkDevice[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: '',
    ip: '',
    type: 'other' as NetworkDevice['type'],
    parentId: '',
    location: '',
    mac: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parentChoices = devices.filter((d) => parentEligibleTypes.includes(d.type))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await api.createDevice({
        name: formData.name,
        ip: formData.ip,
        type: formData.type,
        parentId: formData.parentId || undefined,
        location: formData.location || undefined,
        mac: formData.mac || undefined,
      })
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create device')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Add New Device</h2>
          <button onClick={onClose} className={styles.closeButton}>
            x
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.formError}>{error}</div>}

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={styles.input}
              placeholder="e.g., Core Router"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              IP Address <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              required
              value={formData.ip}
              onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
              className={styles.input}
              placeholder="e.g., 192.168.1.1"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Type <span className={styles.required}>*</span>
            </label>
            <select
              required
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value as NetworkDevice['type'] })
              }
              className={styles.select}
              aria-label="Device type"
            >
              {deviceTypes.map((t) => (
                <option key={t} value={t}>
                  {typeLabels[t]}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Main Device (optional)</label>
            <select
              value={formData.parentId}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
              className={styles.select}
            >
              <option value="">None (top-level/main)</option>
              {parentChoices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.type})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Location (optional)</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className={styles.input}
              placeholder="e.g., Rack A"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>MAC Address (optional)</label>
            <input
              type="text"
              value={formData.mac}
              onChange={(e) => setFormData({ ...formData, mac: e.target.value })}
              className={styles.input}
              placeholder="e.g., 00:11:22:33:44:55"
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={styles.submitButton}>
              {submitting ? 'Adding...' : 'Add Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
