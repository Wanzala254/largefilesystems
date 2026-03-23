import { execFile } from 'child_process'
import { WebSocketServer } from 'ws'
import {
  alertDB,
  eventDB,
  auditLogDB,
  deviceDB,
  settingsDB,
} from './db.js'
import crypto from 'crypto'

// Security monitoring configuration
const SECURITY_CONFIG = {
  portScanThreshold: 10, // Number of failed port attempts before alert
  failedLoginThreshold: 5, // Failed login attempts before alert
  suspiciousActivityWindow: 300000, // 5 minutes in milliseconds
  vpnMonitoringEnabled: true,
  intrusionDetectionEnabled: true,
}

// Security event storage
const securityEvents = new Map()
const failedLogins = new Map()
const portScanAttempts = new Map()

function generateId() {
  return `id-${crypto.randomUUID()}`
}

function logSecurityEvent(type, severity, title, description, sourceIp, details = null) {
  const event = {
    id: generateId(),
    type: 'security_event',
    severity,
    title,
    description,
    deviceId: null,
    deviceName: null,
    timestamp: new Date().toISOString(),
    sourceIp,
    details: details ? JSON.stringify(details) : null,
  }

  // Create alert for high severity events
  if (severity === 'high' || severity === 'critical') {
    const alert = {
      id: generateId(),
      type: 'security_threat',
      severity,
      status: 'active',
      title,
      message: `${description} (Source: ${sourceIp})`,
      deviceId: null,
      deviceName: null,
      createdAt: event.timestamp,
    }
    alertDB.create(alert)
  }

  // Log event
  eventDB.create(event)

  // Send WebSocket notification
  sendWebSocketEvent({
    type: 'security.event',
    event,
    timestamp: event.timestamp,
  })

  console.log(`[SECURITY] ${severity.toUpperCase()}: ${title} from ${sourceIp}`)
}

function isPrivateIP(ip) {
  if (!ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false
  const [a, b] = ip.split('.').map(Number)
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a === 127) return true
  return false
}

async function detectPortScanning() {
  if (!SECURITY_CONFIG.intrusionDetectionEnabled) return

  try {
    // Use netstat to get active connections
    const netstatResult = await new Promise((resolve, reject) => {
      execFile('netstat', ['-an'], { timeout: 5000 }, (error, stdout) => {
        if (error) return reject(error)
        resolve(stdout)
      })
    })

    const lines = netstatResult.split('\n')
    const connectionCounts = new Map()

    // Count connections by source IP
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 5) {
        const localAddress = parts[1]
        const foreignAddress = parts[2]
        const state = parts[3]

        // Only count established connections
        if (state === 'ESTABLISHED' || state === 'SYN_SENT') {
          const [ip] = foreignAddress.split(':')
          if (ip && ip !== '127.0.0.1' && !isPrivateIP(ip)) {
            connectionCounts.set(ip, (connectionCounts.get(ip) || 0) + 1)
          }
        }
      }
    })

    // Check for potential port scanning
    connectionCounts.forEach((count, ip) => {
      if (count > SECURITY_CONFIG.portScanThreshold) {
        logSecurityEvent(
          'port_scan',
          'high',
          'Potential Port Scanning Detected',
          `High number of connections from ${ip} (${count} connections)`,
          ip,
          { connectionCount: count, threshold: SECURITY_CONFIG.portScanThreshold }
        )
      }
    })

  } catch (error) {
    console.error('Error detecting port scanning:', error.message)
  }
}

async function detectSuspiciousLogins() {
  if (!SECURITY_CONFIG.intrusionDetectionEnabled) return

  try {
    // Check for failed login attempts in audit logs
    const recentLogs = await auditLogDB.getRecent(100)
    const now = Date.now()
    const windowStart = now - SECURITY_CONFIG.suspiciousActivityWindow

    // Count failed login attempts by IP
    const failedAttempts = new Map()

    recentLogs.forEach(log => {
      if (log.action === 'auth.login.failed' && log.ip) {
        const logTime = new Date(log.createdAt).getTime()
        if (logTime >= windowStart) {
          failedAttempts.set(log.ip, (failedAttempts.get(log.ip) || 0) + 1)
        }
      }
    })

    // Check for excessive failed login attempts
    failedAttempts.forEach((count, ip) => {
      if (count >= SECURITY_CONFIG.failedLoginThreshold) {
        logSecurityEvent(
          'brute_force',
          'critical',
          'Brute Force Attack Detected',
          `Multiple failed login attempts from ${ip} (${count} attempts in ${SECURITY_CONFIG.suspiciousActivityWindow / 60000} minutes)`,
          ip,
          { failedAttempts: count, threshold: SECURITY_CONFIG.failedLoginThreshold, timeWindow: SECURITY_CONFIG.suspiciousActivityWindow }
        )
      }
    })

  } catch (error) {
    console.error('Error detecting suspicious logins:', error.message)
  }
}

async function monitorVPNConnections() {
  if (!SECURITY_CONFIG.vpnMonitoringEnabled) return

  try {
    // Check VPN connections (this is a simplified example)
    // In a real implementation, you'd integrate with your VPN server's API
    const vpnResult = await new Promise((resolve, reject) => {
      execFile('netstat', ['-an'], { timeout: 5000 }, (error, stdout) => {
        if (error) return reject(error)
        resolve(stdout)
      })
    })

    const vpnConnections = []
    const lines = vpnResult.split('\n')

    lines.forEach(line => {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 5) {
        const localAddress = parts[1]
        const foreignAddress = parts[2]
        const state = parts[3]

        // Look for VPN-related ports (PPTP: 1723, L2TP: 1701, OpenVPN: 1194, etc.)
        if (state === 'ESTABLISHED') {
          const [ip, port] = foreignAddress.split(':')
          const vpnPorts = ['1723', '1701', '1194', '500', '4500']
          
          if (ip && port && vpnPorts.includes(port)) {
            vpnConnections.push({ ip, port, localAddress })
          }
        }
      }
    })

    // Log VPN connections
    if (vpnConnections.length > 0) {
      vpnConnections.forEach(conn => {
        logSecurityEvent(
          'vpn_connection',
          'info',
          'VPN Connection Detected',
          `VPN connection established to ${conn.ip}:${conn.port}`,
          conn.ip,
          { port: conn.port, localAddress: conn.localAddress }
        )
      })
    }

  } catch (error) {
    console.error('Error monitoring VPN connections:', error.message)
  }
}

async function detectUnauthorizedAccess() {
  if (!SECURITY_CONFIG.intrusionDetectionEnabled) return

  try {
    // Check for unusual network activity patterns
    const devices = await deviceDB.getAll()
    const now = new Date().toISOString()

    // Look for devices that are suddenly online/offline frequently
    devices.forEach(device => {
      // This is a simplified check - in reality you'd track historical patterns
      if (device.status === 'offline' && device.lastSeen) {
        const lastSeen = new Date(device.lastSeen)
        const timeSinceLastSeen = Date.now() - lastSeen.getTime()
        
        // If device was recently online but now offline, might indicate tampering
        if (timeSinceLastSeen < 300000) { // 5 minutes
          logSecurityEvent(
            'device_tampering',
            'medium',
            'Potential Device Tampering',
            `Device ${device.name} (${device.ip}) went offline recently`,
            device.ip,
            { deviceId: device.id, deviceName: device.name }
          )
        }
      }
    })

  } catch (error) {
    console.error('Error detecting unauthorized access:', error.message)
  }
}

// WebSocket event broadcasting (using existing WebSocket server)
let wss = null

function setWebSocketServer(server) {
  wss = server
}

function sendWebSocketEvent(event) {
  if (wss) {
    const payload = JSON.stringify(event)
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(payload)
      }
    })
  }
}

// Security monitoring service
let securityInterval = null
let isMonitoring = false

function startSecurityMonitoring() {
  if (isMonitoring) return
  isMonitoring = true

  console.log('Starting security monitoring...')

  securityInterval = setInterval(async () => {
    try {
      await detectPortScanning()
      await detectSuspiciousLogins()
      await monitorVPNConnections()
      await detectUnauthorizedAccess()
    } catch (error) {
      console.error('Error in security monitoring:', error.message)
    }
  }, 60000) // Check every minute
}

function stopSecurityMonitoring() {
  if (securityInterval) {
    clearInterval(securityInterval)
    securityInterval = null
  }
  isMonitoring = false
  console.log('Security monitoring stopped')
}

// API endpoints for security features
export function setupSecurityRoutes(app) {
  // Get security events
  app.get('/api/security/events', async (req, res) => {
    try {
      const events = await eventDB.getAll()
      const securityEvents = events.filter(e => e.type === 'security_event')
      res.json(securityEvents)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Get security alerts
  app.get('/api/security/alerts', async (req, res) => {
    try {
      const alerts = await alertDB.getAll()
      const securityAlerts = alerts.filter(a => a.type === 'security_threat')
      res.json(securityAlerts)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Get security statistics
  app.get('/api/security/stats', async (req, res) => {
    try {
      const events = await eventDB.getAll()
      const securityEvents = events.filter(e => e.type === 'security_event')
      
      const stats = {
        totalEvents: securityEvents.length,
        bySeverity: {
          critical: securityEvents.filter(e => e.severity === 'critical').length,
          high: securityEvents.filter(e => e.severity === 'high').length,
          medium: securityEvents.filter(e => e.severity === 'medium').length,
          low: securityEvents.filter(e => e.severity === 'low').length,
          info: securityEvents.filter(e => e.severity === 'info').length,
        },
        byType: {
          port_scan: securityEvents.filter(e => e.title.includes('Port Scanning')).length,
          brute_force: securityEvents.filter(e => e.title.includes('Brute Force')).length,
          vpn_connection: securityEvents.filter(e => e.title.includes('VPN')).length,
          device_tampering: securityEvents.filter(e => e.title.includes('Tampering')).length,
        },
        recentEvents: securityEvents.slice(-10),
      }

      res.json(stats)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Security configuration
  app.get('/api/security/config', async (req, res) => {
    try {
      const config = {
        portScanThreshold: await settingsDB.get('security_portScanThreshold') || SECURITY_CONFIG.portScanThreshold,
        failedLoginThreshold: await settingsDB.get('security_failedLoginThreshold') || SECURITY_CONFIG.failedLoginThreshold,
        suspiciousActivityWindow: await settingsDB.get('security_suspiciousActivityWindow') || SECURITY_CONFIG.suspiciousActivityWindow,
        vpnMonitoringEnabled: await settingsDB.get('security_vpnMonitoringEnabled') === 'true',
        intrusionDetectionEnabled: await settingsDB.get('security_intrusionDetectionEnabled') === 'true',
      }
      res.json(config)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  app.put('/api/security/config', async (req, res) => {
    try {
      const updates = {
        security_portScanThreshold: String(req.body.portScanThreshold || SECURITY_CONFIG.portScanThreshold),
        security_failedLoginThreshold: String(req.body.failedLoginThreshold || SECURITY_CONFIG.failedLoginThreshold),
        security_suspiciousActivityWindow: String(req.body.suspiciousActivityWindow || SECURITY_CONFIG.suspiciousActivityWindow),
        security_vpnMonitoringEnabled: String(req.body.vpnMonitoringEnabled === true),
        security_intrusionDetectionEnabled: String(req.body.intrusionDetectionEnabled === true),
      }

      await settingsDB.update(updates)
      
      // Update runtime config
      SECURITY_CONFIG.portScanThreshold = parseInt(updates.security_portScanThreshold)
      SECURITY_CONFIG.failedLoginThreshold = parseInt(updates.security_failedLoginThreshold)
      SECURITY_CONFIG.suspiciousActivityWindow = parseInt(updates.security_suspiciousActivityWindow)
      SECURITY_CONFIG.vpnMonitoringEnabled = updates.security_vpnMonitoringEnabled === 'true'
      SECURITY_CONFIG.intrusionDetectionEnabled = updates.security_intrusionDetectionEnabled === 'true'

      res.json({ message: 'Security configuration updated', config: updates })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Manual security scan
  app.post('/api/security/scan', async (req, res) => {
    try {
      await detectPortScanning()
      await detectSuspiciousLogins()
      await monitorVPNConnections()
      await detectUnauthorizedAccess()
      
      res.json({ message: 'Security scan completed' })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
}

export {
  startSecurityMonitoring,
  stopSecurityMonitoring,
  setWebSocketServer,
  logSecurityEvent,
  detectPortScanning,
  detectSuspiciousLogins,
  monitorVPNConnections,
  detectUnauthorizedAccess,
}