import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3001

// Mock network devices – replace with real discovery (e.g. SNMP, ARP, ping) later
let devices = [
  { id: '1', name: 'Core Router', ip: '192.168.1.1', type: 'router', status: 'online', lastSeen: new Date().toISOString(), latencyMs: 2, location: 'Rack A' },
  { id: '2', name: 'Switch 1', ip: '192.168.1.2', type: 'switch', status: 'online', lastSeen: new Date().toISOString(), latencyMs: 1, location: 'Rack A' },
  { id: '3', name: 'Switch 2', ip: '192.168.1.3', type: 'switch', status: 'online', lastSeen: new Date().toISOString(), latencyMs: 3, location: 'Rack B' },
  { id: '4', name: 'File Server', ip: '192.168.1.10', type: 'server', status: 'online', lastSeen: new Date().toISOString(), latencyMs: 5, location: 'Rack A' },
  { id: '5', name: 'Backup Server', ip: '192.168.1.11', type: 'server', status: 'degraded', lastSeen: new Date().toISOString(), latencyMs: 120, location: 'Rack B' },
  { id: '6', name: 'Workstation-01', ip: '192.168.1.20', type: 'workstation', status: 'online', lastSeen: new Date().toISOString(), latencyMs: 4 },
  { id: '7', name: 'Workstation-02', ip: '192.168.1.21', type: 'workstation', status: 'offline', lastSeen: new Date(Date.now() - 3600000).toISOString(), latencyMs: null },
  { id: '8', name: 'Printer', ip: '192.168.1.30', type: 'other', status: 'online', lastSeen: new Date().toISOString(), latencyMs: 8 },
]

let nextId = 9
let nextMessageId = 1
let nextAlertId = 1
let nextEventId = 1

// Settings (defaults)
let settings = {
  alertThresholds: {
    latencyMs: 100,
    downloadMbps: 10,
    uploadMbps: 5,
  },
  autoRefresh: true,
  refreshInterval: 30,
  notifications: {
    email: false,
    browser: true,
  },
}

// Network issue messages/tickets
let messages = [
  {
    id: '1',
    userName: 'John Doe',
    userEmail: 'john@example.com',
    message: 'Network is down in Building A. No internet connection.',
    status: 'pending',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
]

// Network alerts
let alerts = [
  {
    id: '1',
    type: 'device_offline',
    severity: 'high',
    status: 'active',
    title: 'Device Offline',
    message: 'Workstation-02 is offline',
    deviceId: '7',
    deviceName: 'Workstation-02',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2',
    type: 'device_degraded',
    severity: 'medium',
    status: 'active',
    title: 'Device Performance Degraded',
    message: 'Backup Server has high latency (120ms)',
    deviceId: '5',
    deviceName: 'Backup Server',
    value: 120,
    threshold: 50,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
]

// Network events timeline
let events = [
  {
    id: '1',
    type: 'device_offline',
    title: 'Device Went Offline',
    description: 'Workstation-02 went offline',
    deviceId: '7',
    deviceName: 'Workstation-02',
    severity: 'error',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2',
    type: 'device_degraded',
    title: 'Device Performance Degraded',
    description: 'Backup Server latency increased to 120ms',
    deviceId: '5',
    deviceName: 'Backup Server',
    severity: 'warning',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: '3',
    type: 'alert_created',
    title: 'Alert Created',
    description: 'New alert: Device Offline - Workstation-02',
    severity: 'error',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '4',
    type: 'device_online',
    title: 'Device Came Online',
    description: 'Core Router came back online',
    deviceId: '1',
    deviceName: 'Core Router',
    severity: 'info',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: '5',
    type: 'speed_change',
    title: 'Network Speed Changed',
    description: 'Download speed increased to 85.3 Mbps',
    severity: 'info',
    timestamp: new Date(Date.now() - 10800000).toISOString(),
  },
]

// Generate traffic samples (mock)
function getTrafficSamples() {
  const samples = []
  const now = Date.now()
  for (let i = 24; i >= 0; i--) {
    const ts = new Date(now - i * 3600000).toISOString()
    samples.push({
      timestamp: ts,
      bytesIn: Math.floor(Math.random() * 50000) + 10000,
      bytesOut: Math.floor(Math.random() * 30000) + 5000,
    })
  }
  return samples
}

// Generate network speed samples (mock)
function getSpeedSamples() {
  const samples = []
  const now = Date.now()
  for (let i = 60; i >= 0; i--) {
    const ts = new Date(now - i * 60000).toISOString() // Every minute for last hour
    samples.push({
      timestamp: ts,
      downloadMbps: Math.random() * 100 + 10, // 10-110 Mbps
      uploadMbps: Math.random() * 50 + 5, // 5-55 Mbps
    })
  }
  return samples
}

// Get current network speed
function getCurrentSpeed() {
  const samples = getSpeedSamples()
  const latest = samples[samples.length - 1]
  const avgDownload = samples.reduce((sum, s) => sum + s.downloadMbps, 0) / samples.length
  const avgUpload = samples.reduce((sum, s) => sum + s.uploadMbps, 0) / samples.length
  const maxDownload = Math.max(...samples.map((s) => s.downloadMbps))
  const maxUpload = Math.max(...samples.map((s) => s.uploadMbps))

  return {
    currentDownloadMbps: latest.downloadMbps,
    currentUploadMbps: latest.uploadMbps,
    avgDownloadMbps: avgDownload,
    avgUploadMbps: avgUpload,
    maxDownloadMbps: maxDownload,
    maxUploadMbps: maxUpload,
    lastUpdated: latest.timestamp,
  }
}

app.get('/api/stats', (req, res) => {
  const onlineCount = devices.filter((d) => d.status === 'online').length
  const offlineCount = devices.filter((d) => d.status === 'offline').length
  const withLatency = devices.filter((d) => d.latencyMs != null)
  const avgLatency =
    withLatency.length > 0
      ? Math.round(withLatency.reduce((s, d) => s + d.latencyMs, 0) / withLatency.length)
      : 0
  res.json({
    totalDevices: devices.length,
    onlineCount,
    offlineCount,
    avgLatencyMs: avgLatency,
    lastUpdated: new Date().toISOString(),
  })
})

app.get('/api/devices', (req, res) => {
  res.json(devices)
})

app.get('/api/devices/:id', (req, res) => {
  const device = devices.find((d) => d.id === req.params.id)
  if (!device) return res.status(404).json({ error: 'Not found' })
  res.json(device)
})

app.get('/api/traffic', (req, res) => {
  res.json(getTrafficSamples())
})

app.get('/api/speed', (req, res) => {
  res.json(getCurrentSpeed())
})

app.get('/api/speed/history', (req, res) => {
  res.json(getSpeedSamples())
})

// Calculate network health score
function calculateHealthScore() {
  const onlineCount = devices.filter((d) => d.status === 'online').length
  const totalDevices = devices.length
  const deviceUptime = totalDevices > 0 ? (onlineCount / totalDevices) * 100 : 100

  const speedStats = getCurrentSpeed()
  const speedScore = Math.min(100, (speedStats.avgDownloadMbps / 100) * 100) // Normalize to 100 Mbps

  const withLatency = devices.filter((d) => d.latencyMs != null)
  const avgLatency =
    withLatency.length > 0
      ? withLatency.reduce((s, d) => s + d.latencyMs, 0) / withLatency.length
      : 0
  const latencyScore = Math.max(0, 100 - (avgLatency / 10) * 10) // Lower latency = higher score

  const degradedCount = devices.filter((d) => d.status === 'degraded').length
  const deviceHealth = totalDevices > 0
    ? ((totalDevices - degradedCount - (totalDevices - onlineCount)) / totalDevices) * 100
    : 100

  // Weighted average
  const score = Math.round(
    deviceUptime * 0.3 +
    speedScore * 0.3 +
    latencyScore * 0.2 +
    deviceHealth * 0.2
  )

  let status = 'excellent'
  if (score < 50) status = 'critical'
  else if (score < 70) status = 'poor'
  else if (score < 85) status = 'fair'
  else if (score < 95) status = 'good'

  return {
    score,
    status,
    factors: {
      deviceUptime: Math.round(deviceUptime),
      networkSpeed: Math.round(speedScore),
      latency: Math.round(latencyScore),
      deviceHealth: Math.round(deviceHealth),
    },
    lastUpdated: new Date().toISOString(),
  }
}

app.get('/api/health', (req, res) => {
  res.json(calculateHealthScore())
})

// Alerts API
app.get('/api/alerts', (req, res) => {
  const { status } = req.query
  let filtered = alerts
  if (status) {
    filtered = alerts.filter((a) => a.status === status)
  }
  // Sort by severity and date (newest first)
  const sorted = [...filtered].sort((a, b) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
    if (severityOrder[b.severity] !== severityOrder[a.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity]
    }
    return new Date(b.createdAt) - new Date(a.createdAt)
  })
  res.json(sorted)
})

app.get('/api/alerts/:id', (req, res) => {
  const alert = alerts.find((a) => a.id === req.params.id)
  if (!alert) return res.status(404).json({ error: 'Alert not found' })
  res.json(alert)
})

app.put('/api/alerts/:id', (req, res) => {
  const index = alerts.findIndex((a) => a.id === req.params.id)
  if (index === -1) {
    return res.status(404).json({ error: 'Alert not found' })
  }

  const { status } = req.body
  const alert = alerts[index]

  if (status && ['active', 'acknowledged', 'resolved'].includes(status)) {
    alert.status = status
    if (status === 'acknowledged' && !alert.acknowledgedAt) {
      alert.acknowledgedAt = new Date().toISOString()
    }
    if (status === 'resolved' && !alert.resolvedAt) {
      alert.resolvedAt = new Date().toISOString()
    }
  }

  res.json(alert)
})

app.delete('/api/alerts/:id', (req, res) => {
  const index = alerts.findIndex((a) => a.id === req.params.id)
  if (index === -1) {
    return res.status(404).json({ error: 'Alert not found' })
  }
  const alert = alerts[index]
  alerts.splice(index, 1)
  res.json({ message: 'Alert deleted', alert })
})

app.post('/api/devices', (req, res) => {
  const { name, ip, type, location, mac } = req.body
  
  if (!name || !ip || !type) {
    return res.status(400).json({ error: 'Missing required fields: name, ip, type' })
  }

  const validTypes = ['router', 'switch', 'server', 'workstation', 'other']
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` })
  }

  // Check if IP already exists
  if (devices.some((d) => d.ip === ip)) {
    return res.status(400).json({ error: 'Device with this IP already exists' })
  }

  const newDevice = {
    id: String(nextId++),
    name,
    ip,
    type,
    status: 'unknown',
    lastSeen: new Date().toISOString(),
    latencyMs: null,
    ...(location && { location }),
    ...(mac && { mac }),
  }

  devices.push(newDevice)
  res.status(201).json(newDevice)
})

app.delete('/api/devices/:id', (req, res) => {
  const index = devices.findIndex((d) => d.id === req.params.id)
  if (index === -1) {
    return res.status(404).json({ error: 'Device not found' })
  }

  const device = devices[index]
  // Only allow deletion of offline or degraded devices
  if (device.status !== 'offline' && device.status !== 'degraded') {
    return res.status(400).json({ error: 'Can only delete offline or degraded devices' })
  }

  devices.splice(index, 1)
  res.json({ message: 'Device deleted', device })
})

// Messages/Tickets API
app.get('/api/messages', (req, res) => {
  // Sort by newest first
  const sorted = [...messages].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  )
  res.json(sorted)
})

app.get('/api/messages/:id', (req, res) => {
  const message = messages.find((m) => m.id === req.params.id)
  if (!message) return res.status(404).json({ error: 'Message not found' })
  res.json(message)
})

app.post('/api/messages', (req, res) => {
  const { userName, userEmail, message } = req.body

  if (!userName || !message) {
    return res.status(400).json({ error: 'Missing required fields: userName, message' })
  }

  const now = new Date().toISOString()
  const newMessage = {
    id: String(nextMessageId++),
    userName,
    userEmail: userEmail || undefined,
    message,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }

  messages.push(newMessage)
  res.status(201).json(newMessage)
})

app.put('/api/messages/:id', (req, res) => {
  const index = messages.findIndex((m) => m.id === req.params.id)
  if (index === -1) {
    return res.status(404).json({ error: 'Message not found' })
  }

  const { status, adminResponse, estimatedFixTime } = req.body
  const message = messages[index]

  // Update fields if provided
  if (status && ['pending', 'in_progress', 'resolved'].includes(status)) {
    message.status = status
  }
  if (adminResponse !== undefined) {
    message.adminResponse = adminResponse || undefined
  }
  if (estimatedFixTime !== undefined) {
    message.estimatedFixTime = estimatedFixTime || undefined
  }
  message.updatedAt = new Date().toISOString()

  res.json(message)
})

// Device Details API
app.get('/api/devices/:id/details', (req, res) => {
  const device = devices.find((d) => d.id === req.params.id)
  if (!device) return res.status(404).json({ error: 'Device not found' })

  // Calculate uptime (mock - in real system, track status changes)
  const uptime = device.status === 'online' ? 95 : device.status === 'degraded' ? 60 : 0

  // Generate device history (mock)
  const history = []
  const now = Date.now()
  for (let i = 24; i >= 0; i--) {
    const ts = new Date(now - i * 3600000).toISOString()
    history.push({
      timestamp: ts,
      status: i < 2 && device.status === 'offline' ? 'offline' : device.status,
      latencyMs: device.latencyMs || (Math.random() * 20 + 5),
      downloadMbps: Math.random() * 50 + 20,
      uploadMbps: Math.random() * 30 + 10,
    })
  }

  const deviceAlerts = alerts.filter((a) => a.deviceId === device.id)
  const lastAlert = deviceAlerts.length > 0
    ? deviceAlerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt
    : undefined

  const details = {
    ...device,
    uptime,
    avgLatency: device.latencyMs || 0,
    history,
    totalAlerts: deviceAlerts.length,
    lastAlert,
  }

  res.json(details)
})

// Network Events API
app.get('/api/events', (req, res) => {
  const { limit } = req.query
  let sorted = [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  if (limit) {
    sorted = sorted.slice(0, parseInt(limit))
  }
  res.json(sorted)
})

app.get('/api/events/:id', (req, res) => {
  const event = events.find((e) => e.id === req.params.id)
  if (!event) return res.status(404).json({ error: 'Event not found' })
  res.json(event)
})

// Settings API
app.get('/api/settings', (req, res) => {
  res.json(settings)
})

app.put('/api/settings', (req, res) => {
  const updates = req.body
  settings = { ...settings, ...updates }
  res.json(settings)
})

app.listen(PORT, () => {
  console.log(`Network Tracker API running at http://localhost:${PORT}`)
})
