import { useEffect, useState, useRef } from 'react'
import { useWebSocket } from '../services/websocketService'
import { api } from '../api/client'
import type { NetworkDevice } from '../types/network'
import styles from './Topology.module.css'

interface Node {
  id: string
  name: string
  type: string
  status: string
  ip: string
  parentId?: string
  x?: number
  y?: number
}

interface Link {
  source: string
  target: string
}

export default function Topology() {
  const [devices, setDevices] = useState<NetworkDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<NetworkDevice | null>(null)
  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const [connectionTarget, setConnectionTarget] = useState<string | null>(null)
  const { on } = useWebSocket()
  const svgRef = useRef<SVGSVGElement>(null)
  const nodesRef = useRef<Map<string, Node>>(new Map())
  const linksRef = useRef<Link[]>([])
  const zoomRef = useRef<number>(1)
  const panRef = useRef({ x: 0, y: 0 })

  const loadDevices = async () => {
    try {
      setLoading(true)
      const deviceList = await api.getDevices()
      setDevices(deviceList)
      initializeGraph(deviceList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
  }, [])

  useEffect(() => {
    // Set up WebSocket listeners for real-time updates
    const unsubscribeDeviceStatus = on('device.status.update', (data: any) => {
      setDevices(prev => prev.map(device => 
        device.id === data.deviceId 
          ? { ...device, status: data.status, latencyMs: data.latencyMs }
          : device
      ))
    })

    const unsubscribeConnectionUpdate = on('device.connection.update', () => {
      // Refresh the entire device list when connections change
      loadDevices()
    })

    return () => {
      if (unsubscribeDeviceStatus) unsubscribeDeviceStatus()
      if (unsubscribeConnectionUpdate) unsubscribeConnectionUpdate()
    }
  }, [on, loadDevices])

  const initializeGraph = (deviceList: NetworkDevice[]) => {
    const nodes = new Map<string, Node>()
    const links: Link[] = []

    // Create nodes
    deviceList.forEach(device => {
      nodes.set(device.id, {
        id: device.id,
        name: device.name,
        type: device.type,
        status: device.status,
        ip: device.ip,
        parentId: device.parentId
      })
    })

    // Create links based on parent-child relationships
    deviceList.forEach(device => {
      if (device.parentId) {
        links.push({
          source: device.parentId,
          target: device.id
        })
      }
    })

    nodesRef.current = nodes
    linksRef.current = links
  }

  const getDeviceColor = (status: string) => {
    if (status === 'online') return '#22c55e' // green
    if (status === 'offline') return '#ef4444' // red
    if (status === 'degraded') return '#f59e0b' // yellow
    return '#9ca3af' // gray for unknown
  }

  const getDeviceShape = (type: string) => {
    switch (type) {
      case 'router': return 'hexagon'
      case 'switch': return 'square'
      case 'server': return 'rectangle'
      case 'workstation': return 'circle'
      default: return 'circle'
    }
  }

  const getDeviceSize = (type: string) => {
    switch (type) {
      case 'router': return 40
      case 'switch': return 35
      case 'server': return 35
      case 'workstation': return 25
      default: return 25
    }
  }

  const handleDeviceClick = (device: NetworkDevice) => {
    setSelectedDevice(device)
  }

  const handleConnectionClick = (deviceId: string) => {
    setConnectionTarget(deviceId)
    setShowConnectionModal(true)
  }

  const updateConnection = async (parentId: string | null) => {
    if (!connectionTarget) return

    try {
      await api.updateDeviceConnection(connectionTarget, parentId || undefined)
      // Refresh the device list to get updated connections
      await loadDevices()
      setShowConnectionModal(false)
      setConnectionTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update connection')
    }
  }

  const handleZoom = (direction: 'in' | 'out') => {
    const factor = direction === 'in' ? 1.2 : 0.8
    zoomRef.current = Math.max(0.5, Math.min(3, zoomRef.current * factor))
    // Trigger re-render
    setDevices([...devices])
  }


  if (loading) return <div className={styles.centered}>Loading topology...</div>
  if (error) return <div className={styles.error}>Error: {error}</div>

  return (
    <div className={styles.topologyContainer}>
      <div className={styles.topologyHeader}>
        <h1>Network Topology</h1>
        <div className={styles.controls}>
          <button onClick={() => handleZoom('in')} className={styles.controlBtn}>
            +
          </button>
          <button onClick={() => handleZoom('out')} className={styles.controlBtn}>
            -
          </button>
          <span className={styles.zoomLevel}>Zoom: {Math.round(zoomRef.current * 100)}%</span>
        </div>
      </div>

      <div className={styles.topologyView}>
        <svg ref={svgRef} className={styles.svgContainer}>
          <g transform={`translate(${panRef.current.x}, ${panRef.current.y}) scale(${zoomRef.current})`}>
            {/* Draw connections */}
            {linksRef.current.map((link, index) => {
              const source = nodesRef.current.get(link.source)
              const target = nodesRef.current.get(link.target)
              
              if (!source || !target) return null

              return (
                <line
                  key={index}
                  x1={source.x || 0}
                  y1={source.y || 0}
                  x2={target.x || 0}
                  y2={target.y || 0}
                  stroke="#64748b"
                  strokeWidth={2}
                  strokeDasharray="5,5"
                />
              )
            })}

            {/* Draw devices */}
            {Array.from(nodesRef.current.values()).map((node, index) => {
              const x = (index % 10) * 100 + 50
              const y = Math.floor(index / 10) * 100 + 50
              node.x = x
              node.y = y

              const color = getDeviceColor(node.status)
              const size = getDeviceSize(node.type)
              const shape = getDeviceShape(node.type)

              return (
                <g key={node.id} transform={`translate(${x}, ${y})`}>
                  {/* Device shape */}
                  {shape === 'circle' && (
                    <circle
                      r={size}
                      fill={color}
                      stroke="#1e293b"
                      strokeWidth={2}
                      className={styles.deviceNode}
                      onClick={() => handleDeviceClick(devices.find(d => d.id === node.id)!)}
                    />
                  )}
                  {shape === 'square' && (
                    <rect
                      x={-size}
                      y={-size}
                      width={size * 2}
                      height={size * 2}
                      fill={color}
                      stroke="#1e293b"
                      strokeWidth={2}
                      className={styles.deviceNode}
                      onClick={() => handleDeviceClick(devices.find(d => d.id === node.id)!)}
                    />
                  )}
                  {shape === 'rectangle' && (
                    <rect
                      x={-size}
                      y={-size / 2}
                      width={size * 2}
                      height={size}
                      fill={color}
                      stroke="#1e293b"
                      strokeWidth={2}
                      className={styles.deviceNode}
                      onClick={() => handleDeviceClick(devices.find(d => d.id === node.id)!)}
                    />
                  )}
                  {shape === 'hexagon' && (
                    <polygon
                      points="0,-30 26,-15 26,15 0,30 -26,15 -26,-15"
                      fill={color}
                      stroke="#1e293b"
                      strokeWidth={2}
                      className={styles.deviceNode}
                      onClick={() => handleDeviceClick(devices.find(d => d.id === node.id)!)}
                    />
                  )}

                  {/* Device label */}
                  <text
                    x={0}
                    y={size + 20}
                    textAnchor="middle"
                    className={styles.deviceLabel}
                  >
                    {node.name}
                  </text>
                  
                  <text
                    x={0}
                    y={size + 35}
                    textAnchor="middle"
                    className={styles.deviceIp}
                  >
                    {node.ip}
                  </text>

                  {/* Connection button */}
                  <circle
                    cx={size + 15}
                    cy={-size - 15}
                    r={10}
                    fill="#3b82f6"
                    stroke="#1e40af"
                    strokeWidth={2}
                    className={styles.connectBtn}
                    onClick={() => handleConnectionClick(node.id)}
                  />
                  <text
                    x={size + 15}
                    y={-size - 12}
                    textAnchor="middle"
                    className={styles.connectText}
                  >
                    +
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {/* Device Details Panel */}
      {selectedDevice && (
        <div className={styles.detailsPanel}>
          <h2>Device Details</h2>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Name:</span>
            <span>{selectedDevice.name}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>IP:</span>
            <span>{selectedDevice.ip}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Type:</span>
            <span>{selectedDevice.type}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Status:</span>
            <span className={`${styles.status} ${styles[selectedDevice.status]}`}>
              {selectedDevice.status}
            </span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Latency:</span>
            <span>{selectedDevice.latencyMs || 'N/A'} ms</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Location:</span>
            <span>{selectedDevice.location || 'N/A'}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Last Seen:</span>
            <span>{new Date(selectedDevice.lastSeen).toLocaleString()}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Parent:</span>
            <span>
              {selectedDevice.parentId 
                ? devices.find(d => d.id === selectedDevice.parentId)?.name || 'Unknown'
                : 'None'
              }
            </span>
          </div>
        </div>
      )}

      {/* Connection Modal */}
      {showConnectionModal && connectionTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Connect Device</h3>
            <p>Select parent device for connection:</p>
            
            <div className={styles.deviceList}>
              {devices.map(device => (
                <div
                  key={device.id}
                  className={`${styles.deviceOption} ${
                    device.id === connectionTarget ? styles.disabled : ''
                  }`}
                  onClick={() => updateConnection(device.id)}
                >
                  <span className={styles.deviceName}>{device.name}</span>
                  <span className={styles.deviceType}>{device.type}</span>
                  <span className={`${styles.status} ${styles[device.status]}`}>
                    {device.status}
                  </span>
                </div>
              ))}
              <div
                className={styles.deviceOption}
                onClick={() => updateConnection(null)}
              >
                <span className={styles.deviceName}>No Parent</span>
                <span className={styles.deviceType}>Disconnect</span>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button onClick={() => {
                setShowConnectionModal(false)
                setConnectionTarget(null)
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}