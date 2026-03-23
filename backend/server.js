import express from 'express'
import cors from 'cors'
import { execFile } from 'child_process'
import net from 'net'
import { WebSocketServer } from 'ws'
import {
  initializeDatabase,
  deviceDB,
  alertDB,
  messageDB,
  eventDB,
  trafficDB,
  speedDB,
  settingsDB,
  userDB,
  passwordResetDB,
  notificationPreferenceDB,
  auditLogDB,
} from './db.js'
import {
  setupSecurityRoutes,
  startSecurityMonitoring,
  setWebSocketServer,
} from './security.js'
import crypto from 'crypto'

const app = express()
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))
app.use(express.json({ limit: '2mb' }))

const PORT = process.env.PORT || 3001
const ALLOWED_ROLES = new Set(['admin', 'technician', 'viewer', 'user'])

const sseClients = new Map()
const wsClients = new Map()

const authRateStore = new Map()
function createRateLimiter({ windowMs, maxRequests }) {
  return (req, res, next) => {
    const now = Date.now()
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    const key = `${req.path}|${ip}`
    const entry = authRateStore.get(key)
    if (!entry || now > entry.resetAt) {
      authRateStore.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }
    entry.count += 1
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      res.setHeader('Retry-After', String(Math.max(1, retryAfter)))
      return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
    }
    return next()
  }
}
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 25 })

// Initialize database on startup
await initializeDatabase()

// Helper function to generate collision-safe IDs across restarts
function generateId() {
  return `id-${crypto.randomUUID()}`
}

// Simple password hashing using scrypt
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

function verifyPassword(stored, password) {
  if (!stored) return false
  const [salt, derived] = stored.split(':')
  if (!salt || !derived) return false
  try {
    const check = crypto.scryptSync(password, salt, 64).toString('hex')
    const derivedBuf = Buffer.from(derived, 'hex')
    const checkBuf = Buffer.from(check, 'hex')
    if (derivedBuf.length !== checkBuf.length) return false
    return crypto.timingSafeEqual(derivedBuf, checkBuf)
  } catch (e) {
    return false
  }
}

function isStrongEnoughPassword(password) {
  return typeof password === 'string' && password.length >= 6
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function sendPasswordRecoveryEmail({ to, username, resetToken, expiresAt }) {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = Number(process.env.SMTP_PORT || 587)
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = process.env.SMTP_FROM || smtpUser

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    return { sent: false, configured: false }
  }

  try {
    const nodemailerModule = await import('nodemailer')
    const nodemailer = nodemailerModule.default || nodemailerModule
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transport.sendMail({
      from: smtpFrom,
      to,
      subject: 'Network Tracker Password Recovery',
      text: [
        `Hello ${username},`,
        '',
        'Use this recovery code to reset your password:',
        resetToken,
        '',
        `This code expires at: ${new Date(expiresAt).toLocaleString()}`,
        '',
        'If you did not request this, ignore this email.',
      ].join('\n'),
    })

    return { sent: true, configured: true }
  } catch (error) {
    return { sent: false, configured: true, error: error?.message || String(error) }
  }
}

async function sendTicketUpdateEmail({
  to,
  userName,
  ticketId,
  status,
  adminResponse,
  estimatedFixTime,
}) {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = Number(process.env.SMTP_PORT || 587)
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = process.env.SMTP_FROM || smtpUser

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    return { sent: false, configured: false }
  }

  try {
    const nodemailerModule = await import('nodemailer')
    const nodemailer = nodemailerModule.default || nodemailerModule
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    })

    const lines = [
      `Hello ${userName || 'User'},`,
      '',
      `Your network ticket (${ticketId}) has been updated.`,
      `Current status: ${status}`,
      '',
      'Admin response:',
      adminResponse || 'No response provided yet.',
      '',
      `Estimated fix time: ${estimatedFixTime ? new Date(estimatedFixTime).toLocaleString() : 'Not set'}`,
      '',
      'Please log in to Network Tracker to view details.',
    ]

    await transport.sendMail({
      from: smtpFrom,
      to,
      subject: `Ticket Update - ${ticketId}`,
      text: lines.join('\n'),
    })

    return { sent: true, configured: true }
  } catch (error) {
    return { sent: false, configured: true, error: error?.message || String(error) }
  }
}

// Simple signed token (no external deps)
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'network-tracker-secret'
function signToken(payload, expiresMs = 24 * 60 * 60 * 1000) {
  const p = { ...payload, exp: Date.now() + expiresMs }
  const json = JSON.stringify(p)
  const b = Buffer.from(json).toString('base64url')
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(b).digest('hex')
  return `${b}.${sig}`
}

function verifyToken(token) {
  try {
    const [b, sig] = token.split('.')
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(b).digest('hex')
    if (!sig || !crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'))
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch (e) {
    return null
  }
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' })
  const token = auth.slice(7)
  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' })
  req.user = payload
  next()
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin required' })
    next()
  })
}

function requireRoles(roles) {
  const allowed = new Set(roles)
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!req.user || !allowed.has(req.user.role)) {
        return res.status(403).json({ error: `Requires role: ${[...allowed].join(', ')}` })
      }
      next()
    })
  }
}

function getRequestMeta(req) {
  return {
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.get('user-agent') || null,
  }
}

async function writeAuditLog(req, action, targetType, targetId, details = null) {
  try {
    const meta = getRequestMeta(req)
    await auditLogDB.create({
      id: generateId(),
      actorUserId: req.user?.id || null,
      actorUsername: req.user?.username || null,
      actorRole: req.user?.role || null,
      action,
      targetType,
      targetId: targetId || null,
      details: details ? JSON.stringify(details) : null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      createdAt: new Date().toISOString(),
    })
  } catch (e) {
    // keep request flow even if audit write fails
  }
}

function sendSseEvent(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`
  for (const client of sseClients.values()) {
    if (!client?.res) continue
    if (client.scope === 'all') {
      client.res.write(payload)
      continue
    }
    if (client.scope === 'admin' && event.scope !== 'user') {
      client.res.write(payload)
      continue
    }
    if (client.scope === 'user' && event.userId && client.userId === event.userId) {
      client.res.write(payload)
    }
  }
}

const TOPOLOGY_PARENT_TYPES = new Set(['server', 'router', 'switch'])
const DEFAULT_TOPOLOGY_MAX_DEPTH = 6
const DEFAULT_TICKET_SLA_HOURS = 4
const TERMINAL_TICKET_STATUSES = new Set(['resolved', 'closed'])
const TICKET_STATUS_TRANSITIONS = {
  pending: new Set(['pending', 'in_progress', 'resolved']),
  in_progress: new Set(['in_progress', 'pending', 'resolved']),
  resolved: new Set(['resolved', 'closed', 'in_progress']),
  closed: new Set(['closed', 'in_progress']),
}

function canBeParentDevice(device) {
  return !!device && TOPOLOGY_PARENT_TYPES.has(device.type)
}

async function getTopologyMaxDepth() {
  const raw = await settingsDB.get('topologyMaxDepth')
  const parsed = Number.parseInt(raw || String(DEFAULT_TOPOLOGY_MAX_DEPTH), 10)
  if (!Number.isFinite(parsed)) return DEFAULT_TOPOLOGY_MAX_DEPTH
  return Math.min(12, Math.max(2, parsed))
}

async function getTicketSlaHours() {
  const raw = await settingsDB.get('ticketSlaHours')
  const parsed = Number.parseInt(raw || String(DEFAULT_TICKET_SLA_HOURS), 10)
  if (!Number.isFinite(parsed)) return DEFAULT_TICKET_SLA_HOURS
  return Math.min(72, Math.max(1, parsed))
}

function computeSlaDueAt(createdAtIso, slaTargetMinutes) {
  const createdMs = new Date(createdAtIso).getTime()
  if (!Number.isFinite(createdMs)) return null
  const due = new Date(createdMs + slaTargetMinutes * 60 * 1000)
  return due.toISOString()
}

function isTicketOverdue(message, nowMs = Date.now()) {
  if (!message?.slaDueAt) return false
  if (TERMINAL_TICKET_STATUSES.has(message.status)) return false
  const dueMs = new Date(message.slaDueAt).getTime()
  if (!Number.isFinite(dueMs)) return false
  return nowMs > dueMs
}

function withTicketComputedFields(message) {
  if (!message) return message
  const overdue = isTicketOverdue(message)
  return {
    ...message,
    slaBreached: Boolean(message.slaBreached) || overdue,
    isOverdue: overdue,
  }
}

function canTransitionTicketStatus(fromStatus, toStatus) {
  const allowed = TICKET_STATUS_TRANSITIONS[fromStatus]
  if (!allowed) return false
  return allowed.has(toStatus)
}

function buildChildrenMap(devices) {
  return devices.reduce((acc, d) => {
    if (!d.parentId) return acc
    if (!acc[d.parentId]) acc[d.parentId] = []
    acc[d.parentId].push(d.id)
    return acc
  }, {})
}

function getSubtreeHeight(deviceId, childrenMap, seen = new Set()) {
  if (seen.has(deviceId)) return 1
  seen.add(deviceId)
  const children = childrenMap[deviceId] || []
  if (children.length === 0) return 1
  let maxChildHeight = 0
  for (const childId of children) {
    maxChildHeight = Math.max(maxChildHeight, getSubtreeHeight(childId, childrenMap, seen))
  }
  return 1 + maxChildHeight
}

function getDepthFromRoot(device, byId) {
  let depth = 1
  let cursor = device
  const seen = new Set([device.id])
  while (cursor?.parentId) {
    const parent = byId.get(cursor.parentId)
    if (!parent) break
    if (seen.has(parent.id)) break
    seen.add(parent.id)
    depth += 1
    cursor = parent
  }
  return depth
}

function isSafeHost(value) {
  return /^[a-zA-Z0-9.\-:_]+$/.test(value)
}

function parsePingLatencyMs(output) {
  const timeMatch = output.match(/time[=<]\s*([\d.]+)\s*ms/i)
  if (timeMatch) {
    const parsed = Number(timeMatch[1])
    if (Number.isFinite(parsed)) return parsed
  }
  const avgMatch = output.match(/Average\s*=\s*(\d+)\s*ms/i)
  if (avgMatch) {
    const parsed = Number(avgMatch[1])
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function isPrivateIPv4(host) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
  const [a, b] = host.split('.').map(Number)
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a === 127) return true
  return false
}

async function probeTcpPorts(host, ports = [80, 443, 22, 3389]) {
  for (const port of ports) {
    // eslint-disable-next-line no-await-in-loop
    const reachable = await new Promise((resolve) => {
      const socket = new net.Socket()
      let done = false
      const finish = (ok) => {
        if (done) return
        done = true
        socket.destroy()
        resolve(ok)
      }

      socket.setTimeout(1400)
      socket.once('connect', () => finish(true))
      socket.once('timeout', () => finish(false))
      socket.once('error', () => finish(false))
      socket.connect(port, host)
    })
    if (reachable) return { reachable: true, port }
  }
  return { reachable: false, port: null }
}

async function probeHost(host) {
  if (!host || !isSafeHost(host)) {
    throw new Error('Invalid host')
  }

  const args =
    process.platform === 'win32'
      ? ['-n', '1', '-w', '1500', host]
      : ['-c', '1', '-W', '2', host]

  const pingResult = await new Promise((resolve) => {
    execFile('ping', args, { timeout: 4000 }, (error, stdout = '', stderr = '') => {
      const output = `${stdout}\n${stderr}`
      const reachable =
        /ttl=/i.test(output) ||
        /bytes from/i.test(output) ||
        /1\s+received/i.test(output) ||
        /1\s+packets received/i.test(output)
      const latencyMs = parsePingLatencyMs(output)
      resolve({ reachable, latencyMs, output, error })
    })
  })

  if (pingResult.reachable) {
    return { ...pingResult, method: 'icmp' }
  }

  const tcpResult = await probeTcpPorts(host)
  if (tcpResult.reachable) {
    return {
      reachable: true,
      latencyMs: null,
      output: '',
      error: null,
      method: `tcp:${tcpResult.port}`,
    }
  }

  return {
    ...pingResult,
    method: 'none',
    hint: isPrivateIPv4(host)
      ? 'Private IP is not routable from your current network without VPN/static route.'
      : 'Host may be down, filtered by firewall, or ports are closed.',
  }
}

// Load initial data if database is empty
async function seedInitialData() {
  const devices = await deviceDB.getAll()
  if (!devices || devices.length === 0) {
    const seedDevices = [
      { id: '1', name: 'Core Router', ip: '192.168.1.1', type: 'router', status: 'online', lastSeen: new Date().toISOString(), latencyMs: 2, location: 'Rack A', createdAt: new Date().toISOString() },
      { id: '2', name: 'Switch 1', ip: '192.168.1.2', type: 'switch', status: 'online', lastSeen: new Date().toISOString(), latencyMs: 1, location: 'Rack A', createdAt: new Date().toISOString() },
      { id: '3', name: 'Switch 2', ip: '192.168.1.3', type: 'switch', status: 'online', lastSeen: new Date().toISOString(), latencyMs: 3, location: 'Rack B', createdAt: new Date().toISOString() },
      { id: '4', name: 'File Server', ip: '192.168.1.10', type: 'server', status: 'online', lastSeen: new Date().toISOString(), latencyMs: 5, location: 'Rack A', createdAt: new Date().toISOString() },
      { id: '5', name: 'Backup Server', ip: '192.168.1.11', type: 'server', status: 'degraded', lastSeen: new Date().toISOString(), latencyMs: 120, location: 'Rack B', createdAt: new Date().toISOString() },
      { id: '6', name: 'Workstation-01', ip: '192.168.1.20', type: 'workstation', status: 'online', lastSeen: new Date().toISOString(), latencyMs: 4, createdAt: new Date().toISOString() },
      { id: '7', name: 'Workstation-02', ip: '192.168.1.21', type: 'workstation', status: 'offline', lastSeen: new Date(Date.now() - 3600000).toISOString(), latencyMs: null, createdAt: new Date().toISOString() },
      { id: '8', name: 'Printer', ip: '192.168.1.30', type: 'other', status: 'online', lastSeen: new Date().toISOString(), latencyMs: 8, createdAt: new Date().toISOString() },
    ]

    for (const d of seedDevices) await deviceDB.create(d)

    const seedAlerts = [
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

    for (const a of seedAlerts) await alertDB.create(a)

    const seedMessages = [
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

    for (const m of seedMessages) await messageDB.create(m)

    const seedEvents = [
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
    ]

    for (const e of seedEvents) await eventDB.create(e)

  }

  // Seed default users if none exist.
  // Keep this independent from device seeding so auth works with pre-existing device data.
  try {
    const users = await userDB.getAll()
    if (!users || users.length === 0) {
      const now = new Date().toISOString()
      const adminPass = hashPassword('admin')
      const userPass = hashPassword('user')
      const seededAdmin = await userDB.createUser({ id: 'u1', username: 'admin', passwordHash: adminPass, role: 'admin', createdAt: now })
      const seededUser = await userDB.createUser({ id: 'u2', username: 'user', passwordHash: userPass, role: 'user', createdAt: now })
      await notificationPreferenceDB.ensureDefault(seededAdmin.id)
      await notificationPreferenceDB.ensureDefault(seededUser.id)
      console.log('Seeded default users: admin / user')
    }
  } catch (e) {
    // ignore
  }

  // Ensure requested admin credentials are always available.
  try {
    const adminUsername = 'wanzala'
    const adminPassword = 'wanzala@2026'
    const existing = await userDB.getByUsername(adminUsername)
    const passwordHash = hashPassword(adminPassword)
    if (existing) {
      await userDB.updatePassword(existing.id, passwordHash)
      await userDB.updateRole(existing.id, 'admin')
    } else {
      const createdAdmin = await userDB.createUser({
        id: `u-${crypto.randomUUID()}`,
        username: adminUsername,
        passwordHash,
        role: 'admin',
        createdAt: new Date().toISOString(),
      })
      await notificationPreferenceDB.ensureDefault(createdAdmin.id)
    }
    console.log(`Ensured admin account: ${adminUsername}`)
  } catch (e) {
    // ignore
  }
}

await seedInitialData()

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
    const ts = new Date(now - i * 60000).toISOString()
    samples.push({
      timestamp: ts,
      downloadMbps: Math.random() * 100 + 10,
      uploadMbps: Math.random() * 50 + 5,
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

// Calculate network health score
async function calculateHealthScore() {
  const devices = await deviceDB.getAll()
  const onlineCount = devices.filter((d) => d.status === 'online').length
  const totalDevices = devices.length
  const deviceUptime = totalDevices > 0 ? (onlineCount / totalDevices) * 100 : 100

  const speedStats = getCurrentSpeed()
  const speedScore = Math.min(100, (speedStats.avgDownloadMbps / 100) * 100)

  const withLatency = devices.filter((d) => d.latencyMs != null)
  const avgLatency =
    withLatency.length > 0
      ? withLatency.reduce((s, d) => s + d.latencyMs, 0) / withLatency.length
      : 0
  const latencyScore = Math.max(0, 100 - (avgLatency / 10) * 10)

  const degradedCount = devices.filter((d) => d.status === 'degraded').length
  const deviceHealth = totalDevices > 0
    ? ((totalDevices - degradedCount - (totalDevices - onlineCount)) / totalDevices) * 100
    : 100

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

// API Routes

// Auth
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' })
    const user = await userDB.getByUsername(username)
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    if (!verifyPassword(user.passwordHash, password)) return res.status(401).json({ error: 'Invalid credentials' })
    await notificationPreferenceDB.ensureDefault(user.id)
    const token = signToken({ id: user.id, username: user.username, role: user.role })
    const welcomeMessage = `Welcome, ${user.username}. You have successfully signed in.`
    await writeAuditLog(req, 'auth.login.success', 'user', user.id)
    res.json({ token, user: { id: user.id, username: user.username, role: user.role }, welcomeMessage })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/me', requireAuth, async (req, res) => {
  res.json({
    user: { id: req.user.id, username: req.user.username, role: req.user.role },
    notificationPreferences: await notificationPreferenceDB.ensureDefault(req.user.id),
  })
})

// Signup - create a new user (defaults to role 'user')
app.post('/api/signup', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' })
    if (!isStrongEnoughPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }
    const existing = await userDB.getByUsername(username)
    if (existing) return res.status(400).json({ error: 'Username already exists' })
    const now = new Date().toISOString()
    const id = generateId()
    const passwordHash = hashPassword(password)
    const user = await userDB.createUser({ id, username, passwordHash, role: 'user', createdAt: now })
    await notificationPreferenceDB.ensureDefault(user.id)
    const token = signToken({ id: user.id, username: user.username, role: user.role })
    req.user = { id: user.id, username: user.username, role: user.role }
    await writeAuditLog(req, 'auth.signup.success', 'user', user.id)
    res.status(201).json({ token, user })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/stats', requireAuth, async (req, res) => {
  const devices = await deviceDB.getAll()
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

app.get('/api/devices', requireAuth, async (req, res) => {
  res.json(await deviceDB.getAll())
})

app.get('/api/devices/:id', requireAuth, async (req, res) => {
  const device = await deviceDB.getById(req.params.id)
  if (!device) return res.status(404).json({ error: 'Device not found' })
  res.json(device)
})

app.post('/api/devices', requireRoles(['admin', 'technician']), async (req, res) => {
  try {
    const { name, ip, type, location, mac, parentId } = req.body

    if (!name || !ip || !type) {
      return res.status(400).json({ error: 'Missing required fields: name, ip, type' })
    }

    const validTypes = ['router', 'switch', 'server', 'workstation', 'other']
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` })
    }

    if (await deviceDB.ipExists(ip)) {
      return res.status(400).json({ error: 'Device with this IP already exists' })
    }
    if (parentId) {
      const parent = await deviceDB.getById(parentId)
      if (!parent) {
        return res.status(400).json({ error: 'Parent device not found' })
      }
      if (!canBeParentDevice(parent)) {
        return res.status(400).json({ error: 'Selected parent cannot have branch devices' })
      }
      const allDevices = await deviceDB.getAll()
      const byId = new Map(allDevices.map((d) => [d.id, d]))
      byId.set(parent.id, parent)
      const parentDepth = getDepthFromRoot(parent, byId)
      const maxDepth = await getTopologyMaxDepth()
      if (parentDepth + 1 > maxDepth) {
        return res.status(400).json({ error: `Topology depth limit is ${maxDepth}` })
      }
    }

    const newDevice = {
      id: generateId(),
      name,
      ip,
      parentId: parentId || null,
      type,
      status: 'unknown',
      lastSeen: new Date().toISOString(),
      latencyMs: null,
      location: location || null,
      mac: mac || null,
      createdAt: new Date().toISOString(),
    }

    await deviceDB.create(newDevice)
    await writeAuditLog(req, 'device.create', 'device', newDevice.id, { ip: newDevice.ip, type: newDevice.type })
    res.status(201).json(newDevice)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/devices/:id/connection', requireRoles(['admin', 'technician']), async (req, res) => {
  try {
    const device = await deviceDB.getById(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device not found' })

    const { parentId } = req.body
    let nextParentId = parentId || null

    if (nextParentId === device.id) {
      return res.status(400).json({ error: 'Device cannot be connected to itself' })
    }

    if (nextParentId) {
      const parent = await deviceDB.getById(nextParentId)
      if (!parent) return res.status(400).json({ error: 'Selected parent device not found' })
      if (!canBeParentDevice(parent)) {
        return res.status(400).json({ error: 'Selected parent cannot have branch devices' })
      }

      // Prevent loops in the topology tree.
      let cursor = parent
      while (cursor?.parentId) {
        if (cursor.parentId === device.id) {
          return res.status(400).json({ error: 'Invalid connection: cycle detected' })
        }
        cursor = await deviceDB.getById(cursor.parentId)
      }

      const allDevices = await deviceDB.getAll()
      const byId = new Map(allDevices.map((d) => [d.id, d]))
      byId.set(device.id, device)
      byId.set(parent.id, parent)
      const childrenMap = buildChildrenMap(allDevices)
      const subtreeHeight = getSubtreeHeight(device.id, childrenMap)
      const parentDepth = getDepthFromRoot(parent, byId)
      const deepestAfterMove = parentDepth + subtreeHeight
      const maxDepth = await getTopologyMaxDepth()
      if (deepestAfterMove > maxDepth) {
        return res.status(400).json({ error: `Invalid hierarchy: exceeds max depth of ${maxDepth}` })
      }
    }

    const updated = await deviceDB.update(device.id, { parentId: nextParentId })
    await writeAuditLog(req, 'device.connection.update', 'device', device.id, {
      fromParentId: device.parentId || null,
      toParentId: nextParentId,
    })
    
    // Send WebSocket event for topology update
    sendWebSocketEvent({
      type: 'device.connection.update',
      deviceId: device.id,
      deviceName: device.name,
      fromParentId: device.parentId || null,
      toParentId: nextParentId,
      timestamp: new Date().toISOString(),
    })
    
    return res.json(updated)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

app.delete('/api/devices/:id', requireRoles(['admin', 'technician']), async (req, res) => {
  try {
    const device = await deviceDB.getById(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device not found' })

    if (device.status !== 'offline' && device.status !== 'degraded') {
      return res.status(400).json({ error: 'Can only delete offline or degraded devices' })
    }

    await deviceDB.delete(req.params.id)
    await writeAuditLog(req, 'device.delete', 'device', device.id, { status: device.status })
    res.json({ message: 'Device deleted', device })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/traffic', requireAuth, (req, res) => {
  res.json(getTrafficSamples())
})

app.get('/api/speed', requireAuth, (req, res) => {
  res.json(getCurrentSpeed())
})

app.get('/api/speed/history', requireAuth, (req, res) => {
  res.json(getSpeedSamples())
})

app.get('/api/health', requireAuth, async (req, res) => {
  try {
    const result = await calculateHealthScore()
    res.json(result)
  } catch (err) {
    console.error('Error calculating health score', err)
    res.status(500).json({ error: 'Failed to calculate health' })
  }
})

// Alerts API
app.get('/api/alerts', requireAuth, async (req, res) => {
  try {
    const { status } = req.query
    let alerts = await alertDB.getAll()

    if (status) {
      alerts = await alertDB.getByStatus(status)
    }

    res.json(alerts)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/alerts/:id', requireAuth, async (req, res) => {
  try {
    const alert = await alertDB.getById(req.params.id)
    if (!alert) return res.status(404).json({ error: 'Alert not found' })
    res.json(alert)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/alerts/:id', requireRoles(['admin', 'technician']), async (req, res) => {
  try {
    const { status } = req.body
    const alert = await alertDB.getById(req.params.id)

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' })
    }

    if (status && ['active', 'acknowledged', 'resolved'].includes(status)) {
      const updates = { status }
      if (status === 'acknowledged' && !alert.acknowledgedAt) {
        updates.acknowledgedAt = new Date().toISOString()
      }
      if (status === 'resolved' && !alert.resolvedAt) {
        updates.resolvedAt = new Date().toISOString()
      }

      const updated = await alertDB.update(req.params.id, updates)
      await writeAuditLog(req, 'alert.update', 'alert', alert.id, {
        fromStatus: alert.status,
        toStatus: updated.status,
      })
      sendSseEvent({
        type: 'alert.updated',
        scope: 'admin',
        alertId: alert.id,
        status: updated.status,
        timestamp: new Date().toISOString(),
      })
      return res.json(updated)
    }

    res.json(alert)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/alerts/:id', requireRoles(['admin', 'technician']), async (req, res) => {
  try {
    const alert = await alertDB.delete(req.params.id)
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' })
    }
    await writeAuditLog(req, 'alert.delete', 'alert', alert.id)
    res.json({ message: 'Alert deleted', alert })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Messages API
app.get('/api/messages', requireRoles(['admin', 'technician', 'viewer']), async (req, res) => {
  try {
    const items = await messageDB.getAll()
    res.json(items.map((item) => withTicketComputedFields(item)))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/forgot-password', authLimiter, async (req, res) => {
  try {
    const { username, email } = req.body
    if (!username) return res.status(400).json({ error: 'Missing username' })
    const user = await userDB.getByUsername(username)
    if (!user) {
      return res.json({
        message:
          'If the account exists, a password reset code has been generated.',
      })
    }

    const resetToken = crypto.randomBytes(24).toString('hex')
    const tokenHash = hashResetToken(resetToken)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString()

    await passwordResetDB.markAllUsedForUser(user.id)
    await passwordResetDB.create({
      id: generateId(),
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt: now.toISOString(),
    })

    const targetEmail =
      (typeof email === 'string' && email.trim()) ||
      (typeof user.userEmail === 'string' && user.userEmail.trim()) ||
      null

    let emailResult = { sent: false, configured: false }
    if (targetEmail) {
      emailResult = await sendPasswordRecoveryEmail({
        to: targetEmail,
        username: user.username,
        resetToken,
        expiresAt,
      })
    }

    return res.json({
      message: emailResult.sent
        ? `Password recovery code sent to ${targetEmail}.`
        : 'Password reset code generated. It expires in 15 minutes.',
      resetToken: emailResult.sent ? undefined : resetToken,
      expiresAt,
      emailSent: emailResult.sent,
      emailConfigured: emailResult.configured,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

app.post('/api/reset-password', authLimiter, async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Missing resetToken or newPassword' })
    }
    if (!isStrongEnoughPassword(newPassword)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const tokenHash = hashResetToken(resetToken)
    const resetRow = await passwordResetDB.getValidByTokenHash(
      tokenHash,
      new Date().toISOString()
    )
    if (!resetRow) return res.status(400).json({ error: 'Invalid or expired reset token' })

    const user = await userDB.getById(resetRow.userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    await userDB.updatePassword(user.id, hashPassword(newPassword))
    await passwordResetDB.markUsedById(resetRow.id)
    req.user = { id: user.id, username: user.username, role: user.role }
    await writeAuditLog(req, 'auth.password.reset', 'user', user.id)

    return res.json({ message: 'Password has been reset successfully' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

app.post('/api/change-password', authLimiter, requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing currentPassword or newPassword' })
    }
    if (!isStrongEnoughPassword(newPassword)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const user = await userDB.getByUsername(req.user.username)
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (!verifyPassword(user.passwordHash, currentPassword)) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    await userDB.updatePassword(user.id, hashPassword(newPassword))
    await passwordResetDB.markAllUsedForUser(user.id)
    await writeAuditLog(req, 'auth.password.change', 'user', user.id)

    return res.json({ message: 'Password changed successfully' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// Admin user management
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    res.json(await userDB.getAll())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, role = 'user' } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' })
    }
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ error: 'Role must be one of: admin, technician, viewer, user' })
    }
    if (!isStrongEnoughPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }
    const existing = await userDB.getByUsername(username)
    if (existing) return res.status(400).json({ error: 'Username already exists' })

    const created = await userDB.createUser({
      id: generateId(),
      username,
      passwordHash: hashPassword(password),
      role,
      createdAt: new Date().toISOString(),
    })
    await notificationPreferenceDB.ensureDefault(created.id)
    await writeAuditLog(req, 'admin.user.create', 'user', created.id, { username: created.username, role: created.role })
    res.status(201).json(created)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/admin/users/:id/password', requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body
    if (!newPassword) return res.status(400).json({ error: 'Missing newPassword' })
    if (!isStrongEnoughPassword(newPassword)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }
    const user = await userDB.getById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    await userDB.updatePassword(user.id, hashPassword(newPassword))
    await passwordResetDB.markAllUsedForUser(user.id)
    await writeAuditLog(req, 'admin.user.password.reset', 'user', user.id)
    res.json({ message: 'User password updated' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ error: 'Role must be one of: admin, technician, viewer, user' })
    }
    const user = await userDB.getById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await userDB.countAdmins()
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last admin' })
      }
    }

    await userDB.updateRole(user.id, role)
    await writeAuditLog(req, 'admin.user.role.update', 'user', user.id, { fromRole: user.role, toRole: role })
    res.json({ message: 'User role updated' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await userDB.getById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' })
    }
    if (user.role === 'admin') {
      const adminCount = await userDB.countAdmins()
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin' })
      }
    }

    await userDB.deleteById(user.id)
    await passwordResetDB.markAllUsedForUser(user.id)
    await writeAuditLog(req, 'admin.user.delete', 'user', user.id, { role: user.role })
    res.json({ message: 'User deleted' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/devices/:id/test', requireRoles(['admin', 'technician']), async (req, res) => {
  try {
    const device = await deviceDB.getById(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device not found' })

    const result = await probeHost(device.ip)
    const now = new Date().toISOString()
    const nextStatus = result.reachable ? 'online' : 'offline'

    const updated = await deviceDB.update(device.id, {
      status: nextStatus,
      latencyMs: result.reachable ? result.latencyMs : null,
      lastSeen: now,
    })

    res.json({
      device: updated,
      probe: {
        reachable: result.reachable,
        latencyMs: result.latencyMs,
        method: result.method || 'unknown',
        hint: result.hint || null,
      },
    })
    await writeAuditLog(req, 'device.test', 'device', device.id, {
      reachable: result.reachable,
      method: result.method || 'unknown',
    })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to test device' })
  }
})

app.get('/api/messages/mine', requireAuth, async (req, res) => {
  try {
    const items = await messageDB.getByOwner(req.user.id, req.user.username)
    res.json(items.map((item) => withTicketComputedFields(item)))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/messages/:id', requireAuth, async (req, res) => {
  try {
    const message = await messageDB.getById(req.params.id)
    if (!message) return res.status(404).json({ error: 'Message not found' })
    const isStaff = req.user?.role && req.user.role !== 'user'
    const ownsMessage =
      message.ownerUserId === req.user.id || message.ownerUsername === req.user.username
    if (!isStaff && !ownsMessage) {
      return res.status(403).json({ error: 'Not allowed to view this ticket' })
    }
    res.json(withTicketComputedFields(message))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/messages', requireAuth, async (req, res) => {
  try {
    const { userName, userEmail, message, attachment } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Missing required field: message' })
    }
    if (attachment?.data && String(attachment.data).length > 1024 * 1024) {
      return res.status(400).json({ error: 'Attachment too large (max 1MB base64 payload)' })
    }

    const displayUserName =
      typeof userName === 'string' && userName.trim() ? userName.trim() : req.user.username
    const now = new Date().toISOString()
    const slaTargetMinutes = (await getTicketSlaHours()) * 60
    const slaDueAt = computeSlaDueAt(now, slaTargetMinutes)
    const automatedResponse =
      'Ticket received. The admin team has been notified and will follow up shortly.'
    const newMessage = {
      id: generateId(),
      userName: displayUserName,
      userEmail: userEmail || null,
      ownerUserId: req.user.id,
      ownerUsername: req.user.username,
      message,
      attachmentName: attachment?.name || null,
      attachmentContentType: attachment?.contentType || null,
      attachmentData: attachment?.data || null,
      status: 'pending',
      adminResponse: automatedResponse,
      slaTargetMinutes,
      slaDueAt,
      slaBreached: false,
      createdAt: now,
      updatedAt: now,
    }

    await messageDB.create(newMessage)
    await writeAuditLog(req, 'ticket.create', 'message', newMessage.id, {
      status: newMessage.status,
      hasAttachment: Boolean(newMessage.attachmentData),
    })
    sendSseEvent({
      type: 'ticket.created',
      scope: 'admin',
      ticketId: newMessage.id,
      userId: req.user.id,
      status: newMessage.status,
      timestamp: new Date().toISOString(),
    })
    res.status(201).json(withTicketComputedFields(newMessage))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/messages/:id', requireRoles(['admin', 'technician']), async (req, res) => {
  try {
    const { status, adminResponse, estimatedFixTime } = req.body
    const message = await messageDB.getById(req.params.id)

    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }

    const updates = {}
    const nextStatus = typeof status === 'string' ? status : message.status
    if (!['pending', 'in_progress', 'resolved', 'closed'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Invalid ticket status' })
    }
    if (!canTransitionTicketStatus(message.status, nextStatus)) {
      return res.status(400).json({
        error: `Invalid status transition from ${message.status} to ${nextStatus}`,
      })
    }

    updates.status = nextStatus
    const autoResolvedBySystem = nextStatus === 'resolved' && message.status === 'in_progress'
    if (autoResolvedBySystem) {
      const systemResolutionResponse = 'System update: The reported issue has been resolved.'
      const trimmedResponse = typeof adminResponse === 'string' ? adminResponse.trim() : ''
      updates.adminResponse = trimmedResponse || systemResolutionResponse
    }

    if (nextStatus === 'resolved' && !message.resolvedAt) {
      updates.resolvedAt = new Date().toISOString()
    }
    if (nextStatus === 'closed') {
      updates.closedAt = new Date().toISOString()
      if (!message.resolvedAt) {
        updates.resolvedAt = updates.closedAt
      }
    } else if (message.status === 'closed') {
      updates.closedAt = null
    }

    if (!TERMINAL_TICKET_STATUSES.has(nextStatus)) {
      updates.slaBreached = isTicketOverdue({ ...message, ...updates })
    } else {
      updates.slaBreached = Boolean(message.slaBreached) || isTicketOverdue(message)
    }

    if (adminResponse !== undefined && !autoResolvedBySystem) {
      updates.adminResponse = adminResponse || null
    }
    if (
      !message.firstResponseAt &&
      (
        (typeof updates.adminResponse === 'string' && updates.adminResponse.trim().length > 0) ||
        (typeof adminResponse === 'string' && adminResponse.trim().length > 0)
      )
    ) {
      updates.firstResponseAt = new Date().toISOString()
    }
    if (estimatedFixTime !== undefined) {
      updates.estimatedFixTime = estimatedFixTime || null
    }

    const updated = await messageDB.update(req.params.id, updates)

    const statusChanged = updated.status !== message.status
    const responseChanged =
      (updated.adminResponse || null) !== (message.adminResponse || null)
    const fixTimeChanged =
      (updated.estimatedFixTime || null) !== (message.estimatedFixTime || null)
    const notificationsEnabled = (await settingsDB.get('notifications_email')) === 'true'
    const userNotificationPref = message.ownerUserId
      ? await notificationPreferenceDB.ensureDefault(message.ownerUserId)
      : null
    const shouldEmailUser =
      notificationsEnabled &&
      (!userNotificationPref || userNotificationPref.emailEnabled) &&
      (!userNotificationPref || userNotificationPref.ticketUpdates) &&
      typeof message.userEmail === 'string' &&
      message.userEmail.trim().length > 0 &&
      (statusChanged || responseChanged || fixTimeChanged)

    let emailNotice = null
    if (shouldEmailUser) {
      emailNotice = await sendTicketUpdateEmail({
        to: message.userEmail.trim(),
        userName: message.userName,
        ticketId: updated.id,
        status: updated.status,
        adminResponse: updated.adminResponse,
        estimatedFixTime: updated.estimatedFixTime,
      })
    }

    await writeAuditLog(req, 'ticket.update', 'message', updated.id, {
      fromStatus: message.status,
      toStatus: updated.status,
      responseChanged,
      fixTimeChanged,
    })
    sendSseEvent({
      type: 'ticket.updated',
      scope: 'all',
      ticketId: updated.id,
      userId: message.ownerUserId || null,
      status: updated.status,
      timestamp: new Date().toISOString(),
    })

    res.json({
      ...withTicketComputedFields(updated),
      notification: emailNotice,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Device Details API
app.get('/api/devices/:id/details', requireAuth, async (req, res) => {
  try {
    const device = await deviceDB.getById(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device not found' })

    const uptime = device.status === 'online' ? 95 : device.status === 'degraded' ? 60 : 0

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

    const allAlerts = await alertDB.getAll()
    const deviceAlerts = allAlerts.filter((a) => a.deviceId === device.id)
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
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Events API
app.get('/api/events', requireAuth, async (req, res) => {
  try {
    const { limit } = req.query
    res.json(await eventDB.getAll(limit))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/events/:id', requireAuth, async (req, res) => {
  try {
    const event = await eventDB.getById(req.params.id)
    if (!event) return res.status(404).json({ error: 'Event not found' })
    res.json(event)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Settings API
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const settings = await settingsDB.getAll()
    // Convert back to nested object format for backward compatibility
    res.json({
      alertThresholds: {
        latencyMs: parseInt(settings.alertThresholds_latencyMs || '100'),
        downloadMbps: parseInt(settings.alertThresholds_downloadMbps || '10'),
        uploadMbps: parseInt(settings.alertThresholds_uploadMbps || '5'),
      },
      autoRefresh: settings.autoRefresh === 'true',
      refreshInterval: parseInt(settings.refreshInterval || '30'),
      notifications: {
        email: settings.notifications_email === 'true',
        browser: settings.notifications_browser === 'true',
      },
      topology: {
        maxDepth: parseInt(settings.topologyMaxDepth || String(DEFAULT_TOPOLOGY_MAX_DEPTH)),
      },
      ticketing: {
        slaHours: parseInt(settings.ticketSlaHours || String(DEFAULT_TICKET_SLA_HOURS)),
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/tickets/analytics', requireRoles(['admin', 'technician', 'viewer']), async (req, res) => {
  try {
    const all = await messageDB.getAll()
    const now = Date.now()
    const total = all.length
    const overdue = all.filter((m) => isTicketOverdue(m, now)).length
    const breached = all.filter((m) => Boolean(m.slaBreached) || isTicketOverdue(m, now)).length
    const firstResponseSamples = all
      .filter((m) => m.firstResponseAt)
      .map((m) => Math.max(0, new Date(m.firstResponseAt).getTime() - new Date(m.createdAt).getTime()))
    const resolutionSamples = all
      .filter((m) => m.resolvedAt)
      .map((m) => Math.max(0, new Date(m.resolvedAt).getTime() - new Date(m.createdAt).getTime()))
    const avgFirstResponseMs =
      firstResponseSamples.length > 0
        ? Math.round(firstResponseSamples.reduce((a, b) => a + b, 0) / firstResponseSamples.length)
        : null
    const avgResolutionMs =
      resolutionSamples.length > 0
        ? Math.round(resolutionSamples.reduce((a, b) => a + b, 0) / resolutionSamples.length)
        : null
    const byStatus = all.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
      },
      {}
    )
    res.json({
      total,
      overdue,
      breached,
      breachRate: total > 0 ? Number((breached / total).toFixed(4)) : 0,
      avgFirstResponseMs,
      avgResolutionMs,
      byStatus,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/audit-logs', requireAdmin, async (req, res) => {
  try {
    const limit = Number.parseInt(String(req.query.limit || '200'), 10)
    const rows = await auditLogDB.getRecent(limit)
    res.json(rows.map((row) => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null,
    })))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/me/notification-preferences', requireAuth, async (req, res) => {
  try {
    res.json(await notificationPreferenceDB.ensureDefault(req.user.id))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/me/notification-preferences', requireAuth, async (req, res) => {
  try {
    const next = await notificationPreferenceDB.update(req.user.id, {
      inAppEnabled: typeof req.body.inAppEnabled === 'boolean' ? req.body.inAppEnabled : undefined,
      emailEnabled: typeof req.body.emailEnabled === 'boolean' ? req.body.emailEnabled : undefined,
      ticketUpdates: typeof req.body.ticketUpdates === 'boolean' ? req.body.ticketUpdates : undefined,
      alertUpdates: typeof req.body.alertUpdates === 'boolean' ? req.body.alertUpdates : undefined,
    })
    await writeAuditLog(req, 'notification.preferences.update', 'user', req.user.id, next)
    res.json(next)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/stream', (req, res) => {
  const queryToken = typeof req.query.token === 'string' ? req.query.token : ''
  const payload = queryToken ? verifyToken(queryToken) : null
  if (!payload) return res.status(401).json({ error: 'Invalid stream token' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const clientId = `${Date.now()}-${Math.random()}`
  const scope = payload.role === 'admin' || payload.role === 'technician' || payload.role === 'viewer'
    ? 'admin'
    : 'user'
  sseClients.set(clientId, { res, userId: payload.id, scope })

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`)
  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${Date.now()}\n\n`)
  }, 25000)

  req.on('close', () => {
    clearInterval(heartbeat)
    sseClients.delete(clientId)
  })
})

app.get('/api/healthz', async (_req, res) => {
  try {
    const deviceCount = (await deviceDB.getAll()).length
    res.json({
      ok: true,
      status: 'up',
      version: '0.0.1',
      uptimeSeconds: Math.round(process.uptime()),
      dbHost: process.env.MYSQL_HOST || 'localhost',
      dbName: process.env.MYSQL_DATABASE || 'network_tracker',
      devices: deviceCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({ ok: false, status: 'down', error: error.message })
  }
})

app.get('/api/metrics', requireAdmin, async (_req, res) => {
  try {
    const [devices, alerts, tickets, users] = await Promise.all([
      deviceDB.getAll(),
      alertDB.getAll(),
      messageDB.getAll(),
      userDB.getAll(),
    ])
    const online = devices.filter((d) => d.status === 'online').length
    const activeAlerts = alerts.filter((a) => a.status === 'active').length
    const pendingTickets = tickets.filter((t) => t.status === 'pending').length
    const lines = [
      '# HELP nt_devices_total Total number of devices',
      '# TYPE nt_devices_total gauge',
      `nt_devices_total ${devices.length}`,
      '# HELP nt_devices_online Number of online devices',
      '# TYPE nt_devices_online gauge',
      `nt_devices_online ${online}`,
      '# HELP nt_alerts_active Number of active alerts',
      '# TYPE nt_alerts_active gauge',
      `nt_alerts_active ${activeAlerts}`,
      '# HELP nt_tickets_pending Number of pending tickets',
      '# TYPE nt_tickets_pending gauge',
      `nt_tickets_pending ${pendingTickets}`,
      '# HELP nt_users_total Total number of users',
      '# TYPE nt_users_total gauge',
      `nt_users_total ${users.length}`,
    ]
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
    res.send(lines.join('\n'))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/settings', requireAdmin, async (req, res) => {
  try {
    const updates = {
      alertThresholds_latencyMs: String(req.body.alertThresholds?.latencyMs || 100),
      alertThresholds_downloadMbps: String(req.body.alertThresholds?.downloadMbps || 10),
      alertThresholds_uploadMbps: String(req.body.alertThresholds?.uploadMbps || 5),
      autoRefresh: String(req.body.autoRefresh !== false),
      refreshInterval: String(req.body.refreshInterval || 30),
      notifications_email: String(req.body.notifications?.email === true),
      notifications_browser: String(req.body.notifications?.browser !== false),
      topologyMaxDepth: String(
        Math.min(12, Math.max(2, parseInt(String(req.body.topology?.maxDepth || DEFAULT_TOPOLOGY_MAX_DEPTH))))
      ),
      ticketSlaHours: String(
        Math.min(72, Math.max(1, parseInt(String(req.body.ticketing?.slaHours || DEFAULT_TICKET_SLA_HOURS))))
      ),
    }

    await settingsDB.update(updates)
    await writeAuditLog(req, 'settings.update', 'settings', 'global', updates)
    
    res.json({
      alertThresholds: {
        latencyMs: parseInt(updates.alertThresholds_latencyMs),
        downloadMbps: parseInt(updates.alertThresholds_downloadMbps),
        uploadMbps: parseInt(updates.alertThresholds_uploadMbps),
      },
      autoRefresh: updates.autoRefresh === 'true',
      refreshInterval: parseInt(updates.refreshInterval),
      notifications: {
        email: updates.notifications_email === 'true',
        browser: updates.notifications_browser === 'true',
      },
      topology: {
        maxDepth: parseInt(updates.topologyMaxDepth),
      },
      ticketing: {
        slaHours: parseInt(updates.ticketSlaHours),
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Network Tracker API running at http://localhost:${PORT}`)
})

// WebSocket Server for Real-time Monitoring
const wss = new WebSocketServer({ port: PORT + 1 })
console.log(`WebSocket server running at ws://localhost:${PORT + 1}`)

// Automatic device discovery service
let discoveryInterval = null
let isDiscovering = false

// Network scanning utilities
function getLocalNetworks() {
  const os = require('os')
  const interfaces = os.networkInterfaces()
  const networks = []
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const ip = iface.address
        const cidr = iface.netmask
        if (ip && cidr) {
          networks.push({ interface: name, ip, cidr })
        }
      }
    }
  }
  return networks
}

function ipToNumber(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

function numberToIp(num) {
  return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.')
}

function getNetworkRange(ip, cidr) {
  const ipNum = ipToNumber(ip)
  const mask = -1 << (32 - parseInt(cidr.split('.')[3]))
  const network = ipNum & mask
  const broadcast = network | (1 << (32 - parseInt(cidr.split('.')[3])) - 1)
  return { network, broadcast }
}

async function discoverDevicesInNetwork(networkInfo) {
  const { network, broadcast } = getNetworkRange(networkInfo.ip, networkInfo.cidr)
  const discovered = []
  
  // Scan a reasonable range (skip network and broadcast addresses)
  const start = network + 1
  const end = Math.min(broadcast - 1, network + 254) // Limit to avoid overwhelming the network
  
  console.log(`Scanning network ${networkInfo.ip}/${networkInfo.cidr} (${numberToIp(start)} - ${numberToIp(end)})`)
  
  for (let i = start; i <= end; i += 10) { // Scan in batches to avoid overwhelming
    const batchPromises = []
    
    for (let j = 0; j < 10 && (i + j) <= end; j++) {
      const targetIp = numberToIp(i + j)
      batchPromises.push(
        new Promise((resolve) => {
          execFile('ping', ['-n', '1', '-w', '100', targetIp], { timeout: 1000 }, (error, stdout) => {
            const reachable = /ttl=/i.test(stdout || '')
            if (reachable) {
              resolve({ ip: targetIp, reachable: true })
            } else {
              resolve({ ip: targetIp, reachable: false })
            }
          })
        })
      )
    }
    
    const results = await Promise.all(batchPromises)
    discovered.push(...results.filter(r => r.reachable))
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  return discovered
}

async function startDeviceDiscovery() {
  if (isDiscovering) return
  isDiscovering = true
  
  console.log('Starting automatic device discovery...')
  
  discoveryInterval = setInterval(async () => {
    try {
      const networks = getLocalNetworks()
      if (networks.length === 0) {
        console.log('No network interfaces found for discovery')
        return
      }
      
      for (const network of networks) {
        console.log(`Discovering devices on ${network.interface} (${network.ip}/${network.cidr})`)
        const discovered = await discoverDevicesInNetwork(network)
        
        for (const device of discovered) {
          try {
            // Check if device already exists in database
            const existing = await deviceDB.getAll()
            const alreadyExists = existing.some(d => d.ip === device.ip)
            
            if (!alreadyExists) {
              // Test the device to get more information
              const result = await probeHost(device.ip)
              const now = new Date().toISOString()
              
              const newDevice = {
                id: generateId(),
                name: `Discovered Device (${device.ip})`,
                ip: device.ip,
                parentId: null,
                type: 'other',
                status: result.reachable ? 'online' : 'offline',
                lastSeen: now,
                latencyMs: result.reachable ? result.latencyMs : null,
                location: 'Auto-discovered',
                createdAt: now,
              }
              
              await deviceDB.create(newDevice)
              
              console.log(`Discovered new device: ${device.ip}`)
              
              // Send WebSocket notification
              sendWebSocketEvent({
                type: 'device.discovered',
                device: newDevice,
                timestamp: now,
              })
            }
          } catch (error) {
            console.error(`Error processing discovered device ${device.ip}:`, error.message)
          }
        }
      }
    } catch (error) {
      console.error('Error in device discovery:', error.message)
    }
  }, 300000) // Run discovery every 5 minutes
}

function stopDeviceDiscovery() {
  if (discoveryInterval) {
    clearInterval(discoveryInterval)
    discoveryInterval = null
  }
  isDiscovering = false
  console.log('Device discovery stopped')
}

// Background monitoring service
let monitoringInterval = null
let isMonitoring = false

function broadcastToWebSocketClients(message) {
  const payload = JSON.stringify(message)
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(payload)
    }
  })
}

function sendWebSocketEvent(event) {
  broadcastToWebSocketClients(event)
}

// Real-time device monitoring
async function startBackgroundMonitoring() {
  if (isMonitoring) return
  isMonitoring = true
  
  console.log('Starting background device monitoring...')
  
  monitoringInterval = setInterval(async () => {
    try {
      const devices = await deviceDB.getAll()
      const now = new Date().toISOString()
      
      // Check each device status
      for (const device of devices) {
        try {
          const result = await probeHost(device.ip)
          const nextStatus = result.reachable ? 'online' : 'offline'
          const latencyMs = result.reachable ? result.latencyMs : null
          
          // Only update if status changed or latency is available
          if (nextStatus !== device.status || (latencyMs !== null && latencyMs !== device.latencyMs)) {
            const updated = await deviceDB.update(device.id, {
              status: nextStatus,
              latencyMs: latencyMs,
              lastSeen: now,
            })
            
            // Send real-time updates
            sendWebSocketEvent({
              type: 'device.status.update',
              deviceId: device.id,
              deviceName: device.name,
              status: nextStatus,
              latencyMs: latencyMs,
              timestamp: now,
            })
            
            // Create alert if device went offline
            if (nextStatus === 'offline' && device.status !== 'offline') {
              const alert = {
                id: generateId(),
                type: 'device_offline',
                severity: 'high',
                status: 'active',
                title: 'Device Offline',
                message: `${device.name} (${device.ip}) is now offline`,
                deviceId: device.id,
                deviceName: device.name,
                createdAt: now,
              }
              await alertDB.create(alert)
              
              sendWebSocketEvent({
                type: 'alert.created',
                alert: alert,
                timestamp: now,
              })
            }
            
            // Create alert if device is degraded
            if (nextStatus === 'online' && latencyMs > 100) {
              const alert = {
                id: generateId(),
                type: 'device_degraded',
                severity: 'medium',
                status: 'active',
                title: 'Device Performance Degraded',
                message: `${device.name} (${device.ip}) has high latency (${latencyMs}ms)`,
                deviceId: device.id,
                deviceName: device.name,
                value: latencyMs,
                threshold: 100,
                createdAt: now,
              }
              await alertDB.create(alert)
              
              sendWebSocketEvent({
                type: 'alert.created',
                alert: alert,
                timestamp: now,
              })
            }
          }
        } catch (error) {
          console.error(`Error monitoring device ${device.name}:`, error.message)
        }
      }
      
      // Send health score update
      const healthScore = await calculateHealthScore()
      sendWebSocketEvent({
        type: 'health.score.update',
        healthScore: healthScore,
        timestamp: now,
      })
      
      // Send traffic and speed updates
      const trafficData = getTrafficSamples()
      const speedData = getCurrentSpeed()
      
      sendWebSocketEvent({
        type: 'network.traffic.update',
        trafficData: trafficData,
        timestamp: now,
      })
      
      sendWebSocketEvent({
        type: 'network.speed.update',
        speedData: speedData,
        timestamp: now,
      })
      
    } catch (error) {
      console.error('Error in background monitoring:', error.message)
    }
  }, 30000) // Check every 30 seconds
}

function stopBackgroundMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
    monitoringInterval = null
  }
  isMonitoring = false
  console.log('Background monitoring stopped')
}

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected')
  
  // Send initial data
  ws.send(JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString(),
  }))
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString())
      
      switch (data.type) {
        case 'subscribe':
          // Send current state
          const devices = await deviceDB.getAll()
          const alerts = await alertDB.getAll()
          const healthScore = await calculateHealthScore()
          const speedData = getCurrentSpeed()
          const trafficData = getTrafficSamples()
          
          ws.send(JSON.stringify({
            type: 'initial_state',
            devices: devices,
            alerts: alerts,
            healthScore: healthScore,
            speedData: speedData,
            trafficData: trafficData,
            timestamp: new Date().toISOString(),
          }))
          break
          
        case 'device_test':
          if (data.deviceId) {
            const device = await deviceDB.getById(data.deviceId)
            if (device) {
              const result = await probeHost(device.ip)
              const now = new Date().toISOString()
              const nextStatus = result.reachable ? 'online' : 'offline'
              
              const updated = await deviceDB.update(device.id, {
                status: nextStatus,
                latencyMs: result.reachable ? result.latencyMs : null,
                lastSeen: now,
              })
              
              ws.send(JSON.stringify({
                type: 'device.test.result',
                deviceId: device.id,
                result: result,
                updatedDevice: updated,
                timestamp: now,
              }))
            }
          }
          break
          
        case 'get_device_details':
          if (data.deviceId) {
            const device = await deviceDB.getById(data.deviceId)
            if (device) {
              const allAlerts = await alertDB.getAll()
              const deviceAlerts = allAlerts.filter((a) => a.deviceId === device.id)
              
              ws.send(JSON.stringify({
                type: 'device.details',
                deviceId: device.id,
                details: {
                  ...device,
                  totalAlerts: deviceAlerts.length,
                  alerts: deviceAlerts,
                },
                timestamp: new Date().toISOString(),
              }))
            }
          }
          break
          
        default:
          console.log('Unknown WebSocket message type:', data.type)
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error.message)
    }
  })
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected')
  })
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message)
  })
})

// Setup security monitoring
setupSecurityRoutes(app)
setWebSocketServer(wss)
startSecurityMonitoring()

// Start background monitoring
startBackgroundMonitoring()

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...')
  stopBackgroundMonitoring()
  stopSecurityMonitoring()
  wss.close()
  process.exit(0)
})
