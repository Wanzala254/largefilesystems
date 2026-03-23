// Database adapter supporting both SQLite and MySQL
import Database from 'better-sqlite3'
import mysql from 'mysql2/promise'

// Determine database type from environment
const USE_MYSQL = Boolean(process.env.MYSQL_HOST && process.env.MYSQL_PASSWORD)
const DB_TYPE = USE_MYSQL ? 'mysql' : 'sqlite'

console.log(`Using database type: ${DB_TYPE}`)

// Database connection and operations
let dbConnection = null
let isMySQL = false

// Initialize database connection
export async function initializeDatabase() {
  try {
    if (USE_MYSQL) {
      isMySQL = true
      const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE || 'network_tracker',
        multipleStatements: true,
      })
      dbConnection = connection
      console.log('MySQL Connected successfully')
    } else {
      isMySQL = false
      dbConnection = new Database('network-tracker.db')
      dbConnection.pragma('foreign_keys = ON')
      console.log('SQLite Connected successfully')
    }
  } catch (err) {
    console.error(`${DB_TYPE} Connection failed:`, err.message)
    throw err
  }
}

// Helper function to execute queries based on database type
function executeQuery(sql, params = []) {
  if (isMySQL) {
    return dbConnection.execute(sql, params)
  } else {
    const stmt = dbConnection.prepare(sql)
    if (params.length === 0) {
      return [stmt.all()]
    } else {
      return [stmt.all(params)]
    }
  }
}

// Helper function to execute single row queries
function executeGet(sql, params = []) {
  if (isMySQL) {
    const [rows] = dbConnection.execute(sql, params)
    return rows[0] || null
  } else {
    const stmt = dbConnection.prepare(sql)
    return stmt.get(params) || null
  }
}

// Helper function to execute insert/update/delete queries
function executeRun(sql, params = []) {
  if (isMySQL) {
    return dbConnection.execute(sql, params)
  } else {
    const stmt = dbConnection.prepare(sql)
    return stmt.run(params)
  }
}

// Device database operations
export const deviceDB = {
  getAll: async () => {
    const sql = isMySQL 
      ? 'SELECT * FROM devices ORDER BY name'
      : 'SELECT * FROM devices ORDER BY name'
    const [rows] = await executeQuery(sql)
    return rows
  },
  getById: async (id) => {
    const sql = isMySQL
      ? 'SELECT * FROM devices WHERE id = ?'
      : 'SELECT * FROM devices WHERE id = ?'
    return executeGet(sql, [id])
  },
  create: async (device) => {
    const sql = isMySQL
      ? `INSERT INTO devices (id, name, ip, type, status, lastSeen, latencyMs, location, createdAt, mac, parentId) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      : `INSERT INTO devices (id, name, ip, type, status, lastSeen, latencyMs, location, createdAt, mac, parentId) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    await executeRun(sql, [
      device.id, device.name, device.ip, device.type, device.status, 
      device.lastSeen, device.latencyMs, device.location, device.createdAt, 
      device.mac || null, device.parentId || null
    ])
  },
  update: async (id, updates) => {
    const device = await deviceDB.getById(id)
    if (!device) return null
    
    const next = { ...device, ...updates }
    const sql = isMySQL
      ? `UPDATE devices SET name = ?, ip = ?, type = ?, status = ?, lastSeen = ?, latencyMs = ?, location = ?, parentId = ? WHERE id = ?`
      : `UPDATE devices SET name = ?, ip = ?, type = ?, status = ?, lastSeen = ?, latencyMs = ?, location = ?, parentId = ? WHERE id = ?`
    await executeRun(sql, [
      next.name, next.ip, next.type, next.status, next.lastSeen, 
      next.latencyMs, next.location, next.parentId, id
    ])
    return next
  },
  delete: async (id) => {
    const sql = isMySQL
      ? 'DELETE FROM devices WHERE id = ?'
      : 'DELETE FROM devices WHERE id = ?'
    await executeRun(sql, [id])
  },
  ipExists: async (ip) => {
    const sql = isMySQL
      ? 'SELECT 1 FROM devices WHERE ip = ? LIMIT 1'
      : 'SELECT 1 FROM devices WHERE ip = ? LIMIT 1'
    const result = executeGet(sql, [ip])
    return !!result
  },
}

// Alert database operations
export const alertDB = {
  getAll: async () => {
    const sql = isMySQL
      ? 'SELECT * FROM alerts ORDER BY severity DESC, createdAt DESC'
      : 'SELECT * FROM alerts ORDER BY severity DESC, createdAt DESC'
    const [rows] = await executeQuery(sql)
    return rows
  },
  getByStatus: async (status) => {
    const sql = isMySQL
      ? 'SELECT * FROM alerts WHERE status = ? ORDER BY severity DESC, createdAt DESC'
      : 'SELECT * FROM alerts WHERE status = ? ORDER BY severity DESC, createdAt DESC'
    const [rows] = await executeQuery(sql, [status])
    return rows
  },
  getById: async (id) => {
    const sql = isMySQL
      ? 'SELECT * FROM alerts WHERE id = ?'
      : 'SELECT * FROM alerts WHERE id = ?'
    return executeGet(sql, [id])
  },
  create: async (alert) => {
    const sql = isMySQL
      ? `INSERT INTO alerts (id, type, severity, status, title, message, deviceId, deviceName, value, threshold, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      : `INSERT INTO alerts (id, type, severity, status, title, message, deviceId, deviceName, value, threshold, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    await executeRun(sql, [
      alert.id, alert.type, alert.severity, alert.status, alert.title, 
      alert.message, alert.deviceId, alert.deviceName, alert.value, 
      alert.threshold, alert.createdAt
    ])
  },
  update: async (id, updates) => {
    const alert = await alertDB.getById(id)
    if (!alert) return null
    
    const sql = isMySQL
      ? `UPDATE alerts SET status = ?, acknowledgedAt = ?, resolvedAt = ? WHERE id = ?`
      : `UPDATE alerts SET status = ?, acknowledgedAt = ?, resolvedAt = ? WHERE id = ?`
    await executeRun(sql, [
      updates.status || alert.status, 
      updates.acknowledgedAt || alert.acknowledgedAt, 
      updates.resolvedAt || alert.resolvedAt, 
      id
    ])
    return { ...alert, ...updates }
  },
  delete: async (id) => {
    const alert = await alertDB.getById(id)
    const sql = isMySQL
      ? 'DELETE FROM alerts WHERE id = ?'
      : 'DELETE FROM alerts WHERE id = ?'
    await executeRun(sql, [id])
    return alert
  },
}

// Message database operations
export const messageDB = {
  getAll: async () => {
    const sql = isMySQL
      ? 'SELECT * FROM messages ORDER BY createdAt DESC'
      : 'SELECT * FROM messages ORDER BY createdAt DESC'
    const [rows] = await executeQuery(sql)
    return rows
  },
  getById: async (id) => {
    const sql = isMySQL
      ? 'SELECT * FROM messages WHERE id = ?'
      : 'SELECT * FROM messages WHERE id = ?'
    return executeGet(sql, [id])
  },
  create: async (message) => {
    const sql = isMySQL
      ? `INSERT INTO messages (id, userName, userEmail, ownerUserId, ownerUsername, message, attachmentName, attachmentContentType, attachmentData, status, adminResponse, slaTargetMinutes, slaDueAt, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      : `INSERT INTO messages (id, userName, userEmail, ownerUserId, ownerUsername, message, attachmentName, attachmentContentType, attachmentData, status, adminResponse, slaTargetMinutes, slaDueAt, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    await executeRun(sql, [
      message.id, message.userName, message.userEmail, message.ownerUserId, 
      message.ownerUsername, message.message, message.attachmentName, 
      message.attachmentContentType, message.attachmentData, message.status, 
      message.adminResponse, message.slaTargetMinutes, message.slaDueAt, 
      message.createdAt, message.updatedAt
    ])
  },
  update: async (id, updates) => {
    const sql = isMySQL
      ? `UPDATE messages SET status = ?, adminResponse = ?, updatedAt = ?, resolvedAt = ?, closedAt = ?, firstResponseAt = ?, estimatedFixTime = ?, slaBreached = ? WHERE id = ?`
      : `UPDATE messages SET status = ?, adminResponse = ?, updatedAt = ?, resolvedAt = ?, closedAt = ?, firstResponseAt = ?, estimatedFixTime = ?, slaBreached = ? WHERE id = ?`
    await executeRun(sql, [
      updates.status, updates.adminResponse, new Date().toISOString(), 
      updates.resolvedAt, updates.closedAt, updates.firstResponseAt, 
      updates.estimatedFixTime, updates.slaBreached ? 1 : 0, id
    ])
    return messageDB.getById(id)
  },
  getByOwner: async (userId) => {
    const sql = isMySQL
      ? 'SELECT * FROM messages WHERE ownerUserId = ? ORDER BY createdAt DESC'
      : 'SELECT * FROM messages WHERE ownerUserId = ? ORDER BY createdAt DESC'
    const [rows] = await executeQuery(sql, [userId])
    return rows
  },
}

// Event database operations
export const eventDB = {
  getAll: async (limit) => {
    const sql = isMySQL
      ? 'SELECT * FROM events ORDER BY timestamp DESC LIMIT ?'
      : 'SELECT * FROM events ORDER BY timestamp DESC LIMIT ?'
    const [rows] = await executeQuery(sql, [limit || 100])
    return rows
  },
  getById: async (id) => {
    const sql = isMySQL
      ? 'SELECT * FROM events WHERE id = ?'
      : 'SELECT * FROM events WHERE id = ?'
    return executeGet(sql, [id])
  },
  create: async (e) => {
    const sql = isMySQL
      ? 'INSERT INTO events (id, type, title, description, deviceId, deviceName, severity, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      : 'INSERT INTO events (id, type, title, description, deviceId, deviceName, severity, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    await executeRun(sql, [
      e.id, e.type, e.title, e.description, e.deviceId, 
      e.deviceName, e.severity, e.timestamp
    ])
  },
}

// Settings database operations
export const settingsDB = {
  getAll: async () => {
    const sql = isMySQL
      ? 'SELECT * FROM settings'
      : 'SELECT * FROM settings'
    const [rows] = await executeQuery(sql)
    return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {})
  },
  get: async (key) => {
    const sql = isMySQL
      ? 'SELECT value FROM settings WHERE key = ?'
      : 'SELECT value FROM settings WHERE key = ?'
    const row = executeGet(sql, [key])
    return row?.value
  },
  update: async (updates) => {
    for (const [key, value] of Object.entries(updates)) {
      const sql = isMySQL
        ? 'INSERT INTO settings (key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)'
        : 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
      await executeRun(sql, [key, String(value)])
    }
  },
}

// User database operations
export const userDB = {
  getAll: async () => {
    const sql = isMySQL
      ? 'SELECT id, username, role, createdAt FROM users ORDER BY username'
      : 'SELECT id, username, role, createdAt FROM users ORDER BY username'
    const [rows] = await executeQuery(sql)
    return rows
  },
  getById: async (id) => {
    const sql = isMySQL
      ? 'SELECT * FROM users WHERE id = ?'
      : 'SELECT * FROM users WHERE id = ?'
    return executeGet(sql, [id])
  },
  getByUsername: async (username) => {
    const sql = isMySQL
      ? 'SELECT * FROM users WHERE username = ?'
      : 'SELECT * FROM users WHERE username = ?'
    return executeGet(sql, [username])
  },
  createUser: async (user) => {
    const sql = isMySQL
      ? 'INSERT INTO users (id, username, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)'
      : 'INSERT INTO users (id, username, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)'
    await executeRun(sql, [
      user.id, user.username, user.passwordHash, user.role, user.createdAt
    ])
    return user
  },
  updatePassword: async (id, passwordHash) => {
    const sql = isMySQL
      ? 'UPDATE users SET passwordHash = ? WHERE id = ?'
      : 'UPDATE users SET passwordHash = ? WHERE id = ?'
    await executeRun(sql, [passwordHash, id])
  },
  updateRole: async (id, role) => {
    const sql = isMySQL
      ? 'UPDATE users SET role = ? WHERE id = ?'
      : 'UPDATE users SET role = ? WHERE id = ?'
    await executeRun(sql, [role, id])
  },
  deleteById: async (id) => {
    const sql = isMySQL
      ? 'DELETE FROM users WHERE id = ?'
      : 'DELETE FROM users WHERE id = ?'
    await executeRun(sql, [id])
  },
  countAdmins: async () => {
    const sql = isMySQL
      ? "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
      : "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
    const [rows] = await executeQuery(sql)
    return rows[0]?.count || 0
  },
}

// Notification preference database operations
export const notificationPreferenceDB = {
  ensureDefault: async (userId) => {
    const sql = isMySQL
      ? `INSERT INTO notification_preferences (userId, inAppEnabled, emailEnabled, ticketUpdates, alertUpdates, updatedAt)
         VALUES (?, 1, 1, 1, 1, ?) ON DUPLICATE KEY UPDATE 
         inAppEnabled = VALUES(inAppEnabled), emailEnabled = VALUES(emailEnabled), 
         ticketUpdates = VALUES(ticketUpdates), alertUpdates = VALUES(alertUpdates), updatedAt = VALUES(updatedAt)`
      : `INSERT OR IGNORE INTO notification_preferences (userId, inAppEnabled, emailEnabled, ticketUpdates, alertUpdates, updatedAt)
         VALUES (?, 1, 1, 1, 1, ?)`
    await executeRun(sql, [userId, new Date().toISOString()])
    
    const selectSql = isMySQL
      ? 'SELECT * FROM notification_preferences WHERE userId = ?'
      : 'SELECT * FROM notification_preferences WHERE userId = ?'
    return executeGet(selectSql, [userId])
  },
  update: async (userId, updates) => {
    const current = await notificationPreferenceDB.ensureDefault(userId)
    const next = { ...current, ...updates }
    
    const sql = isMySQL
      ? `UPDATE notification_preferences SET inAppEnabled = ?, emailEnabled = ?, ticketUpdates = ?, alertUpdates = ?, updatedAt = ? WHERE userId = ?`
      : `UPDATE notification_preferences SET inAppEnabled = ?, emailEnabled = ?, ticketUpdates = ?, alertUpdates = ?, updatedAt = ? WHERE userId = ?`
    await executeRun(sql, [
      next.inAppEnabled, next.emailEnabled, next.ticketUpdates, 
      next.alertUpdates, new Date().toISOString(), userId
    ])
    return next
  },
}

// Audit log database operations
export const auditLogDB = {
  create: async (log) => {
    const sql = isMySQL
      ? `INSERT INTO audit_logs (id, actorUserId, actorUsername, actorRole, action, targetType, targetId, details, ip, userAgent, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      : `INSERT INTO audit_logs (id, actorUserId, actorUsername, actorRole, action, targetType, targetId, details, ip, userAgent, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    await executeRun(sql, [
      log.id, log.actorUserId, log.actorUsername, log.actorRole, 
      log.action, log.targetType, log.targetId, log.details, 
      log.ip, log.userAgent, log.createdAt
    ])
  },
  getRecent: async (limit) => {
    const sql = isMySQL
      ? 'SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT ?'
      : 'SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT ?'
    const [rows] = await executeQuery(sql, [limit])
    return rows
  },
}

// Password reset database operations
export const passwordResetDB = {
  create: async (reset) => {
    const sql = isMySQL
      ? 'INSERT INTO password_resets (id, userId, tokenHash, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)'
      : 'INSERT INTO password_resets (id, userId, tokenHash, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)'
    await executeRun(sql, [
      reset.id, reset.userId, reset.tokenHash, reset.expiresAt, reset.createdAt
    ])
  },
  markAllUsedForUser: async (userId) => {
    const sql = isMySQL
      ? 'UPDATE password_resets SET used = 1 WHERE userId = ?'
      : 'UPDATE password_resets SET used = 1 WHERE userId = ?'
    await executeRun(sql, [userId])
  },
  getValidByTokenHash: async (tokenHash, nowIso) => {
    const sql = isMySQL
      ? 'SELECT * FROM password_resets WHERE tokenHash = ? AND used = 0 AND expiresAt > ? ORDER BY createdAt DESC LIMIT 1'
      : 'SELECT * FROM password_resets WHERE tokenHash = ? AND used = 0 AND expiresAt > ? ORDER BY createdAt DESC LIMIT 1'
    return executeGet(sql, [tokenHash, nowIso])
  },
  markUsedById: async (id) => {
    const sql = isMySQL
      ? 'UPDATE password_resets SET used = 1 WHERE id = ?'
      : 'UPDATE password_resets SET used = 1 WHERE id = ?'
    await executeRun(sql, [id])
  },
}

// Traffic database operations (mock implementation)
export const trafficDB = {
  getHistory: async () => {
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
  },
}

// Speed database operations (mock implementation)
export const speedDB = {
  getHistory: async () => {
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
  },
  getCurrent: async () => {
    const samples = await speedDB.getHistory()
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
  },
}

// Export the database connection for direct access if needed
export default dbConnection
