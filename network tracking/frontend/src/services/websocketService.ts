import { NetworkDevice, NetworkAlert, NetworkHealth } from '../types/network'

export interface WebSocketMessage {
  type: string
  timestamp: string
}

export interface DeviceStatusUpdate extends WebSocketMessage {
  type: 'device.status.update'
  deviceId: string
  deviceName: string
  status: 'online' | 'offline' | 'degraded'
  latencyMs: number | null
}

export interface AlertCreated extends WebSocketMessage {
  type: 'alert.created'
  alert: NetworkAlert
}

export interface HealthScoreUpdate extends WebSocketMessage {
  type: 'health.score.update'
  healthScore: NetworkHealth
}

export interface NetworkTrafficUpdate extends WebSocketMessage {
  type: 'network.traffic.update'
  trafficData: Array<{
    timestamp: string
    bytesIn: number
    bytesOut: number
  }>
}

export interface NetworkSpeedUpdate extends WebSocketMessage {
  type: 'network.speed.update'
  speedData: {
    currentDownloadMbps: number
    currentUploadMbps: number
    avgDownloadMbps: number
    avgUploadMbps: number
    maxDownloadMbps: number
    maxUploadMbps: number
    lastUpdated: string
  }
}

export interface InitialState extends WebSocketMessage {
  type: 'initial_state'
  devices: NetworkDevice[]
  alerts: NetworkAlert[]
  healthScore: NetworkHealth
  speedData: any
  trafficData: any[]
}

export interface DeviceTestResult extends WebSocketMessage {
  type: 'device.test.result'
  deviceId: string
  result: {
    reachable: boolean
    latencyMs: number | null
    method: string
    hint: string | null
  }
  updatedDevice: NetworkDevice
}

export interface DeviceConnectionUpdate extends WebSocketMessage {
  type: 'device.connection.update'
  deviceId: string
  deviceName: string
  fromParentId: string | null
  toParentId: string | null
}

export interface DeviceDetails extends WebSocketMessage {
  type: 'device.details'
  deviceId: string
  details: NetworkDevice & {
    totalAlerts: number
    alerts: NetworkAlert[]
  }
}

export type WebSocketEvent = 
  | DeviceStatusUpdate
  | AlertCreated
  | HealthScoreUpdate
  | NetworkTrafficUpdate
  | NetworkSpeedUpdate
  | InitialState
  | DeviceTestResult
  | DeviceConnectionUpdate
  | DeviceDetails
  | WebSocketMessage

class WebSocketService {
  private ws: WebSocket | null = null
  private url: string
  private token: string | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private listeners: Map<string, Set<(event: WebSocketEvent) => void>> = new Map()
  private isConnecting = false
  private lastConnectTime = 0

  constructor() {
    const wsPort = process.env.NODE_ENV === 'production' ? '3002' : '3002'
    this.url = `ws://localhost:${wsPort}`
  }

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Prevent multiple simultaneous connections
      if (this.isConnecting) {
        reject(new Error('Connection already in progress'))
        return
      }

      // Rate limiting: don't connect more than once per 2 seconds
      const now = Date.now()
      if (now - this.lastConnectTime < 2000) {
        reject(new Error('Connection rate limited'))
        return
      }

      this.isConnecting = true
      this.lastConnectTime = now
      this.token = token
      
      try {
        this.ws = new WebSocket(this.url)
        
        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.reconnectAttempts = 0
          this.isConnecting = false
          resolve()
        }
        
        this.ws.onmessage = (event) => {
          try {
            const data: WebSocketEvent = JSON.parse(event.data)
            this.handleMessage(data)
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }
        
        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason)
          this.isConnecting = false
          this.handleReconnect()
        }
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.isConnecting = false
          reject(error)
        }
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error)
        this.isConnecting = false
        reject(error)
      }
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    setTimeout(() => {
      if (this.token) {
        this.connect(this.token).catch(console.error)
      }
    }, delay)
  }

  private handleMessage(event: WebSocketEvent): void {
    // Handle specific event types
    switch (event.type) {
      case 'connected':
        this.subscribe()
        break
      case 'initial_state':
        // Initial state is handled by the subscriber
        break
      default:
        // For all other events, notify listeners
        this.notifyListeners(event.type, event)
        break
    }
  }

  private subscribe(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe' }))
    }
  }

  testDevice(deviceId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'device_test',
        deviceId: deviceId
      }))
    }
  }

  getDeviceDetails(deviceId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'get_device_details',
        deviceId: deviceId
      }))
    }
  }

  on(eventType: string, callback: (event: WebSocketEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    
    this.listeners.get(eventType)!.add(callback)
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(eventType)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.listeners.delete(eventType)
        }
      }
    }
  }

  private notifyListeners(eventType: string, event: WebSocketEvent): void {
    const callbacks = this.listeners.get(eventType)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event)
        } catch (error) {
          console.error('Error in WebSocket event listener:', error)
        }
      })
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

export const websocketService = new WebSocketService()

// React hook for using WebSocket in components
export function useWebSocket() {
  const connect = (token: string) => websocketService.connect(token)
  const disconnect = () => websocketService.disconnect()
  const on = (eventType: string, callback: (event: WebSocketEvent) => void) => websocketService.on(eventType, callback)
  const testDevice = (deviceId: string) => websocketService.testDevice(deviceId)
  const getDeviceDetails = (deviceId: string) => websocketService.getDeviceDetails(deviceId)
  const isConnected = () => websocketService.isConnected()

  return {
    connect,
    disconnect,
    on,
    testDevice,
    getDeviceDetails,
    isConnected
  }
}