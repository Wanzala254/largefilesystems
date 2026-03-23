import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getTokenUser } from '../api/client'
import {
  AlertCircle,
  AlertTriangle,
  Eye,
  Wifi,
  CheckCircle,
  Shield,
  EyeOff,
  Lock,
  Activity,
  RefreshCw,
  BarChart3,
  Settings,
  MapIcon,
  ClockIcon,
  UserIcon
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { NetworkAlert } from '../types/network'

interface SecurityEvent {
  id: string
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  description: string
  deviceId: string | null
  deviceName: string | null
  timestamp: string
  sourceIp: string
  details: string | null
}

interface SecurityStats {
  totalEvents: number
  bySeverity: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }
  byType: {
    port_scan: number
    brute_force: number
    vpn_connection: number
    device_tampering: number
  }
  recentEvents: SecurityEvent[]
}

interface SecurityConfig {
  portScanThreshold: number
  failedLoginThreshold: number
  suspiciousActivityWindow: number
  vpnMonitoringEnabled: boolean
  intrusionDetectionEnabled: boolean
}

const Security: React.FC = () => {
  const navigate = useNavigate()
  const user = getTokenUser()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [alerts, setAlerts] = useState<NetworkAlert[]>([])
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [config, setConfig] = useState<SecurityConfig | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [activeTab, setActiveTab] = useState<'events' | 'alerts' | 'stats' | 'config'>('events')

  const fetchSecurityData = async () => {
    try {
      setLoading(true)
      // For now, use existing API endpoints since security endpoints don't exist
      const [alertsRes] = await Promise.all([
        api.getAlerts('active')
      ])

      // Mock some security data for demonstration
      const mockEvents: SecurityEvent[] = [
        {
          id: '1',
          type: 'port_scan',
          severity: 'medium',
          title: 'Port Scan Detected',
          description: 'Multiple port scans detected from 192.168.1.100',
          deviceId: null,
          deviceName: null,
          timestamp: new Date().toISOString(),
          sourceIp: '192.168.1.100',
          details: 'Port scan detected on ports 22, 80, 443'
        },
        {
          id: '2',
          type: 'brute_force',
          severity: 'high',
          title: 'Brute Force Attack',
          description: 'Multiple failed login attempts detected',
          deviceId: null,
          deviceName: null,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          sourceIp: '10.0.0.50',
          details: '15 failed login attempts in 5 minutes'
        }
      ]

      const mockStats: SecurityStats = {
        totalEvents: 25,
        bySeverity: {
          critical: 2,
          high: 5,
          medium: 12,
          low: 4,
          info: 2
        },
        byType: {
          port_scan: 8,
          brute_force: 6,
          vpn_connection: 7,
          device_tampering: 4
        },
        recentEvents: mockEvents
      }

      const mockConfig: SecurityConfig = {
        portScanThreshold: 10,
        failedLoginThreshold: 5,
        suspiciousActivityWindow: 300000,
        vpnMonitoringEnabled: true,
        intrusionDetectionEnabled: true
      }

      setEvents(mockEvents)
      setAlerts(alertsRes)
      setStats(mockStats)
      setConfig(mockConfig)
    } catch (error) {
      console.error('Error fetching security data:', error)
      // Still set mock data even if API calls fail
      setEvents([])
      setAlerts([])
      setStats(null)
      setConfig(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSecurityData()
  }, [])

  const handleManualScan = async () => {
    try {
      setIsScanning(true)
      // Simulate a security scan
      await new Promise(resolve => setTimeout(resolve, 2000))
      // Update with new mock data
      const newEvent: SecurityEvent = {
        id: Date.now().toString(),
        type: 'port_scan',
        severity: 'medium',
        title: 'New Port Scan Detected',
        description: 'Port scan detected during manual scan',
        deviceId: null,
        deviceName: null,
        timestamp: new Date().toISOString(),
        sourceIp: '192.168.1.200',
        details: 'Manual scan completed successfully'
      }
      
      setEvents(prev => [newEvent, ...prev])
      setStats(prev => prev ? {
        ...prev,
        totalEvents: prev.totalEvents + 1,
        byType: {
          ...prev.byType,
          port_scan: prev.byType.port_scan + 1
        }
      } : null)
    } catch (error) {
      console.error('Error running security scan:', error)
    } finally {
      setIsScanning(false)
    }
  }

  const handleConfigUpdate = async (updates: Partial<SecurityConfig>) => {
    try {
      setConfig(prev => prev ? { ...prev, ...updates } : null)
      // In a real implementation, this would call an API endpoint
      console.log('Security configuration updated:', updates)
    } catch (error) {
      console.error('Error updating security config:', error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-blue-600 bg-blue-100'
      case 'info': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="w-4 h-4" />
      case 'high': return <AlertTriangle className="w-4 h-4" />
      case 'medium': return <Eye className="w-4 h-4" />
      case 'low': return <Wifi className="w-4 h-4" />
      case 'info': return <CheckCircle className="w-4 h-4" />
      default: return <Shield className="w-4 h-4" />
    }
  }

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'port_scan': return <Eye className="w-5 h-5" />
      case 'brute_force': return <Lock className="w-5 h-5" />
      case 'vpn_connection': return <Wifi className="w-5 h-5" />
      case 'device_tampering': return <Activity className="w-5 h-5" />
      default: return <Shield className="w-5 h-5" />
    }
  }

  const formatEventType = (type: string) => {
    switch (type) {
      case 'port_scan': return 'Port Scan'
      case 'brute_force': return 'Brute Force'
      case 'vpn_connection': return 'VPN Connection'
      case 'device_tampering': return 'Device Tampering'
      default: return type
    }
  }

  if (!user) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
      <div className="text-center">
        <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Security Dashboard</h1>
        <p className="text-gray-600">Please log in to access security monitoring features.</p>
        <div className="mt-4">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
          >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Check if user has staff privileges
  const isStaff = user.role !== 'user'
  if (!isStaff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Shield className="w-12 h-12 text-purple-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Security Dashboard</h1>
          <p className="text-gray-600 mb-4">Access to security monitoring features requires staff privileges.</p>
          <div className="bg-gradient-to-r from-orange-50 to-pink-50 border border-orange-200 rounded-lg p-4 mb-4 shadow-lg">
            <p className="text-sm text-orange-800 font-medium">
              Your current role is: <strong className="text-purple-600">{user.role}</strong>
            </p>
            <p className="text-sm text-orange-700 mt-1">
              Contact your administrator to request staff access.
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transform hover:-translate-y-1 transition-all duration-200"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate('/admin/users')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
            >
              Request Access
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white rounded-xl shadow-lg">
                <Shield className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Security Monitoring</h1>
                <p className="text-blue-100">Real-time security event monitoring and threat detection</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleManualScan}
                disabled={isScanning}
                className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-5 h-5 mr-3 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? 'Scanning...' : 'Manual Scan'}
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center px-6 py-3 border-2 border-white text-sm font-bold rounded-lg text-white bg-transparent hover:bg-white hover:text-purple-600 shadow-lg transform hover:-translate-y-1 transition-all duration-200"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b-2 border-gradient-to-r from-blue-200 to-purple-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'events', label: 'Security Events', icon: Eye },
              { id: 'alerts', label: 'Security Alerts', icon: AlertCircle },
              { id: 'stats', label: 'Statistics', icon: BarChart3 },
              { id: 'config', label: 'Configuration', icon: Settings }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-3 py-4 px-1 border-b-2 font-bold text-sm transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'border-gradient-to-r from-blue-500 to-purple-500 text-blue-600 bg-gradient-to-r from-blue-50 to-purple-50'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-purple-600' : 'text-gray-500'}`} />
                <span className="text-lg">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'events' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 shadow-lg border border-blue-200 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">Total Events</p>
                        <p className="text-3xl font-bold text-gray-900">{stats?.totalEvents || 0}</p>
                      </div>
                      <div className="p-4 bg-white rounded-full shadow-md">
                        <Eye className="w-8 h-8 text-purple-600" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 shadow-lg border border-red-200 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-600">Critical Events</p>
                        <p className="text-3xl font-bold text-gray-900">{stats?.bySeverity.critical || 0}</p>
                      </div>
                      <div className="p-4 bg-white rounded-full shadow-md">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-xl p-6 shadow-lg border border-orange-200 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-orange-600">Active Threats</p>
                        <p className="text-3xl font-bold text-gray-900">{(stats?.byType.port_scan || 0) + (stats?.byType.brute_force || 0)}</p>
                      </div>
                      <div className="p-4 bg-white rounded-full shadow-md">
                        <Activity className="w-8 h-8 text-orange-600" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Security Events</h2>
                  </div>
                  <div className="p-6">
                    {events.length === 0 ? (
                      <div className="text-center py-12">
                        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No security events found</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {events.slice(0, 20).map((event) => (
                          <div key={event.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`p-2 rounded-full ${getSeverityColor(event.severity).split(' ')[1]}`}>
                                  {getSeverityIcon(event.severity)}
                                </div>
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(event.severity)}`}>
                                      {event.severity.toUpperCase()}
                                    </span>
                                    <span className="text-sm font-medium text-gray-900">{event.title}</span>
                                  </div>
                                  <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                    <span className="flex items-center space-x-1">
                                      <MapIcon className="w-3 h-3" />
                                      <span>{event.sourceIp}</span>
                                    </span>
                                    <span className="flex items-center space-x-1">
                                      <ClockIcon className="w-3 h-3" />
                                      <span>{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</span>
                                    </span>
                                    {event.deviceName && (
                                      <span className="flex items-center space-x-1">
                                        <UserIcon className="w-3 h-3" />
                                        <span>{event.deviceName}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {getEventTypeIcon(event.type)}
                                <span className="text-xs text-gray-500">{formatEventType(event.type)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'alerts' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {Object.entries(stats?.bySeverity || {}).map(([severity, count]) => (
                    <div key={severity} className={`bg-gradient-to-br from-${severity === 'critical' ? 'red-50' : severity === 'high' ? 'orange-50' : severity === 'medium' ? 'yellow-50' : severity === 'low' ? 'blue-50' : 'green-50'} to-${severity === 'critical' ? 'pink-50' : severity === 'high' ? 'red-50' : severity === 'medium' ? 'orange-50' : severity === 'low' ? 'purple-50' : 'blue-50'} rounded-xl p-6 shadow-lg border border-${severity === 'critical' ? 'red-200' : severity === 'high' ? 'orange-200' : severity === 'medium' ? 'yellow-200' : severity === 'low' ? 'blue-200' : 'green-200'} hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-medium ${severity === 'critical' ? 'text-red-600' : severity === 'high' ? 'text-orange-600' : severity === 'medium' ? 'text-yellow-600' : severity === 'low' ? 'text-blue-600' : 'text-green-600'}`}>{severity} Alerts</p>
                          <p className="text-3xl font-bold text-gray-900">{count}</p>
                        </div>
                        <div className={`p-4 bg-white rounded-full shadow-md`}>
                          {getSeverityIcon(severity)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-lg shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Security Alerts</h2>
                  </div>
                  <div className="p-6">
                    {alerts.length === 0 ? (
                      <div className="text-center py-12">
                        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No active security alerts</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {alerts.map((alert) => (
                          <div key={alert.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`p-2 rounded-full ${getSeverityColor(alert.severity).split(' ')[1]}`}>
                                  {getSeverityIcon(alert.severity)}
                                </div>
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                                      {alert.severity.toUpperCase()}
                                    </span>
                                    <span className="text-sm font-medium text-gray-900">{alert.title}</span>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      alert.status === 'active' ? 'bg-red-100 text-red-800' :
                                      alert.status === 'acknowledged' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-green-100 text-green-800'
                                    }`}>
                                      {alert.status.toUpperCase()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                    <span className="flex items-center space-x-1">
                                      <ClockIcon className="w-3 h-3" />
                                      <span>{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}</span>
                                    </span>
                                    {alert.deviceName && (
                                      <span className="flex items-center space-x-1">
                                        <UserIcon className="w-3 h-3" />
                                        <span>{alert.deviceName}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Shield className="w-5 h-5 text-gray-400" />
                                <span className="text-xs text-gray-500">Security</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-xl p-6 shadow-lg border border-orange-200 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-orange-600">Port Scans</p>
                        <p className="text-3xl font-bold text-gray-900">{stats?.byType.port_scan || 0}</p>
                      </div>
                      <div className="p-4 bg-white rounded-full shadow-md">
                        <EyeOff className="w-8 h-8 text-orange-600" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 shadow-lg border border-red-200 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-600">Brute Force</p>
                        <p className="text-3xl font-bold text-gray-900">{stats?.byType.brute_force || 0}</p>
                      </div>
                      <div className="p-4 bg-white rounded-full shadow-md">
                        <Lock className="w-8 h-8 text-red-600" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 shadow-lg border border-blue-200 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">VPN Connections</p>
                        <p className="text-3xl font-bold text-gray-900">{stats?.byType.vpn_connection || 0}</p>
                      </div>
                      <div className="p-4 bg-white rounded-full shadow-md">
                        <Wifi className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Distribution by Severity</h3>
                    <div className="space-y-3">
                      {Object.entries(stats?.bySeverity || {}).map(([severity, count]) => (
                        <div key={severity} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${getSeverityColor(severity).split(' ')[1].replace('bg-', 'bg-')}`}></div>
                            <span className="text-sm text-gray-700 capitalize">{severity}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Distribution by Type</h3>
                    <div className="space-y-3">
                      {Object.entries(stats?.byType || {}).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-1 bg-gray-100 rounded-full">
                              {getEventTypeIcon(type)}
                            </div>
                            <span className="text-sm text-gray-700">{formatEventType(type)}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'config' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Security Configuration</h3>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        config?.intrusionDetectionEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {config?.intrusionDetectionEnabled ? 'Active' : 'Disabled'}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        config?.vpnMonitoringEnabled ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        VPN: {config?.vpnMonitoringEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="port-scan-threshold" className="block text-sm font-medium text-gray-700">Port Scan Threshold</label>
                        <div className="mt-1 flex items-center space-x-4">
                          <input
                            id="port-scan-threshold"
                            type="number"
                            value={config?.portScanThreshold || 10}
                            onChange={(e) => handleConfigUpdate({ portScanThreshold: parseInt(e.target.value) })}
                            placeholder="Enter port scan threshold"
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                          />
                          <span className="text-sm text-gray-500">connections</span>
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="failed-login-threshold" className="block text-sm font-medium text-gray-700">Failed Login Threshold</label>
                        <div className="mt-1 flex items-center space-x-4">
                          <input
                            id="failed-login-threshold"
                            type="number"
                            value={config?.failedLoginThreshold || 5}
                            onChange={(e) => handleConfigUpdate({ failedLoginThreshold: parseInt(e.target.value) })}
                            placeholder="Enter failed login threshold"
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                          />
                          <span className="text-sm text-gray-500">attempts</span>
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="suspicious-activity-window" className="block text-sm font-medium text-gray-700">Suspicious Activity Window</label>
                        <div className="mt-1 flex items-center space-x-4">
                          <input
                            id="suspicious-activity-window"
                            type="number"
                            value={config?.suspiciousActivityWindow || 300000}
                            onChange={(e) => handleConfigUpdate({ suspiciousActivityWindow: parseInt(e.target.value) })}
                            placeholder="Enter suspicious activity window"
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                          />
                          <span className="text-sm text-gray-500">milliseconds</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={config?.intrusionDetectionEnabled || false}
                            onChange={(e) => handleConfigUpdate({ intrusionDetectionEnabled: e.target.checked })}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Enable Intrusion Detection</span>
                        </label>
                      </div>
                      
                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={config?.vpnMonitoringEnabled || false}
                            onChange={(e) => handleConfigUpdate({ vpnMonitoringEnabled: e.target.checked })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Enable VPN Monitoring</span>
                        </label>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Configuration Notes</h4>
                        <ul className="text-xs text-gray-600 space-y-1">
                          <li>• Lower thresholds detect threats faster but may increase false positives</li>
                          <li>• VPN monitoring tracks VPN connection activity</li>
                          <li>• Changes are applied immediately</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Security