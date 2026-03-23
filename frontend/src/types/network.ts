export type DeviceStatus = 'online' | 'offline' | 'degraded' | 'unknown'

export interface NetworkDevice {
  id: string
  name: string
  ip: string
  mac?: string
  parentId?: string
  type: 'router' | 'switch' | 'server' | 'workstation' | 'other'
  status: DeviceStatus
  lastSeen: string
  latencyMs?: number
  location?: string
}

export interface DeviceProbeResult {
  device: NetworkDevice
  probe: {
    reachable: boolean
    latencyMs: number | null
    method?: string
    hint?: string | null
  }
}

export interface NetworkStats {
  totalDevices: number
  onlineCount: number
  offlineCount: number
  avgLatencyMs: number
  lastUpdated: string
}

export interface TrafficSample {
  timestamp: string
  bytesIn: number
  bytesOut: number
}

export interface NetworkSpeed {
  downloadMbps: number
  uploadMbps: number
  timestamp: string
}

export interface SpeedStats {
  currentDownloadMbps: number
  currentUploadMbps: number
  avgDownloadMbps: number
  avgUploadMbps: number
  maxDownloadMbps: number
  maxUploadMbps: number
  lastUpdated: string
}

export type MessageStatus = 'pending' | 'in_progress' | 'resolved' | 'closed'

export interface NetworkMessage {
  id: string
  userName: string
  userEmail?: string
  message: string
  attachmentName?: string
  attachmentContentType?: string
  attachmentData?: string
  status: MessageStatus
  adminResponse?: string
  estimatedFixTime?: string
  slaTargetMinutes?: number
  slaDueAt?: string
  firstResponseAt?: string
  resolvedAt?: string
  closedAt?: string
  slaBreached?: boolean
  isOverdue?: boolean
  createdAt: string
  updatedAt: string
}

export interface TicketNotificationResult {
  sent: boolean
  configured: boolean
  error?: string
}

export type TicketUpdateResponse = NetworkMessage & {
  notification?: TicketNotificationResult | null
}

export type AlertType = 'device_offline' | 'device_degraded' | 'low_speed' | 'high_latency' | 'network_down'
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'
export type AlertStatus = 'active' | 'acknowledged' | 'resolved'

export interface NetworkAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  status: AlertStatus
  title: string
  message: string
  deviceId?: string
  deviceName?: string
  value?: number
  threshold?: number
  createdAt: string
  acknowledgedAt?: string
  resolvedAt?: string
}

export interface NetworkHealth {
  score: number // 0-100
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  factors: {
    deviceUptime: number
    networkSpeed: number
    latency: number
    deviceHealth: number
  }
  lastUpdated: string
}

export interface DeviceHistory {
  timestamp: string
  status: DeviceStatus
  latencyMs?: number
  downloadMbps?: number
  uploadMbps?: number
}

export interface DeviceDetails extends NetworkDevice {
  uptime: number // percentage
  avgLatency: number
  history: DeviceHistory[]
  totalAlerts: number
  lastAlert?: string
}

export type EventType = 'device_online' | 'device_offline' | 'device_degraded' | 'alert_created' | 'alert_resolved' | 'speed_change' | 'latency_spike'

export interface NetworkEvent {
  id: string
  type: EventType
  title: string
  description: string
  deviceId?: string
  deviceName?: string
  severity: 'info' | 'warning' | 'error'
  timestamp: string
}

export interface Settings {
  alertThresholds: {
    latencyMs: number
    downloadMbps: number
    uploadMbps: number
  }
  autoRefresh: boolean
  refreshInterval: number // seconds
  notifications: {
    email: boolean
    browser: boolean
  }
  topology: {
    maxDepth: number
  }
  ticketing: {
    slaHours: number
  }
}

export interface AppUser {
  id: string
  username: string
  role: 'admin' | 'technician' | 'viewer' | 'user'
  createdAt: string
}

export interface NotificationPreferences {
  userId: string
  inAppEnabled: boolean
  emailEnabled: boolean
  ticketUpdates: boolean
  alertUpdates: boolean
  updatedAt: string
}

export interface TicketAnalytics {
  total: number
  overdue: number
  breached: number
  breachRate: number
  avgFirstResponseMs: number | null
  avgResolutionMs: number | null
  byStatus: Record<string, number>
  generatedAt: string
}

export interface AuditLogItem {
  id: string
  actorUserId?: string
  actorUsername?: string
  actorRole?: string
  action: string
  targetType?: string
  targetId?: string
  details?: Record<string, unknown> | null
  ip?: string
  userAgent?: string
  createdAt: string
}
