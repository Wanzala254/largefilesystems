import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, getToken, getTokenUser, logout } from '../api/client'
import styles from './Layout.module.css'

interface LayoutProps {
  children: React.ReactNode
}

interface NavItem {
  path: string
  label: string
  badge?: number
}

interface AdminNotification {
  id: string
  message: string
}

interface NotificationItem {
  id: string
  title: string
  detail: string
  timestamp: string
  read: boolean
  path?: string
}

interface TicketSnapshot {
  status: string
  adminResponse?: string | null
  updatedAt: string
}

interface NotificationPrefState {
  inAppEnabled: boolean
  emailEnabled: boolean
  ticketUpdates: boolean
  alertUpdates: boolean
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeAlertCount, setActiveAlertCount] = useState(0)
  const [pendingTicketCount, setPendingTicketCount] = useState(0)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [notificationCenter, setNotificationCenter] = useState<NotificationItem[]>([])
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false)
  const [notificationPref, setNotificationPref] = useState<NotificationPrefState | null>(null)
  const [user, setUser] = useState<{ id: string; username: string; role: string } | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const knownActiveAlertIds = useRef<Set<string>>(new Set())
  const knownPendingTicketIds = useRef<Set<string>>(new Set())
  const hasInitializedNotificationBaseline = useRef(false)
  const hasInitializedUserMessageBaseline = useRef(false)
  const knownAdminMessageStates = useRef<Map<string, TicketSnapshot>>(new Map())
  const knownUserMessageStates = useRef<Map<string, TicketSnapshot>>(new Map())

  const isAdmin = user?.role === 'admin'
  const isStaff = Boolean(user?.role && user.role !== 'user')
  const dashboardPath = isStaff ? '/admin/dashboard' : '/user/dashboard'
  const unreadCount = notificationCenter.filter((n) => !n.read).length
  const streamBase = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '')

  useEffect(() => {
    setUser(getTokenUser())
  }, [location.pathname])

  useEffect(() => {
    if (!user) return
    api
      .getNotificationPreferences()
      .then((pref) =>
        setNotificationPref({
          inAppEnabled: pref.inAppEnabled,
          emailEnabled: pref.emailEnabled,
          ticketUpdates: pref.ticketUpdates,
          alertUpdates: pref.alertUpdates,
        })
      )
      .catch(() => setNotificationPref(null))
  }, [user])

  const pushNotification = (
    title: string,
    detail: string,
    options?: { showToast?: boolean; path?: string }
  ) => {
    if (notificationPref && !notificationPref.inAppEnabled) return
    const showToast = options?.showToast !== false
    const id = `${Date.now()}-${Math.random()}`
    const timestamp = new Date().toISOString()
    setNotificationCenter((prev) =>
      [{ id, title, detail, timestamp, read: false, path: options?.path }, ...prev].slice(0, 50)
    )
    if (showToast) {
      setNotifications((prev) => [...prev, { id, message: `${title}: ${detail}` }])
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
      }, 6000)
    }
  }

  useEffect(() => {
    if (!notificationCenterOpen) return
    setNotificationCenter((prev) =>
      prev.map((n) => (n.read ? n : { ...n, read: true }))
    )
  }, [notificationCenterOpen])

  useEffect(() => {
    let cancelled = false
    if (!isStaff) {
      setActiveAlertCount(0)
      setPendingTicketCount(0)
      hasInitializedNotificationBaseline.current = false
      knownActiveAlertIds.current = new Set()
      knownPendingTicketIds.current = new Set()
      knownAdminMessageStates.current = new Map()
      return
    }

    const notifyAdmin = (message: string, path?: string) => {
      if (message.toLowerCase().includes('alert') && notificationPref && !notificationPref.alertUpdates) return
      if (message.toLowerCase().includes('ticket') && notificationPref && !notificationPref.ticketUpdates) return
      pushNotification('Admin Alert', message, { path })

      if (typeof window !== 'undefined' && 'Notification' in window) {
        const sendBrowserNotification = () => {
          new Notification('Network Tracker Alert', { body: message })
        }

        if (Notification.permission === 'granted') {
          sendBrowserNotification()
        } else if (Notification.permission === 'default') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') sendBrowserNotification()
          })
        }
      }
    }

    const loadAdminNotifications = async () => {
      try {
        const [alerts, messages] = await Promise.all([
          api.getAlerts('active'),
          api.getMessages(),
        ])
        if (cancelled) return

        setActiveAlertCount(alerts.length)
        const pendingTickets = messages.filter((m) => m.status === 'pending')
        setPendingTicketCount(pendingTickets.length)

        const currentActiveAlertIds = new Set(alerts.map((a) => a.id))
        const currentPendingTicketIds = new Set(pendingTickets.map((m) => m.id))
        const latestMessageState = new Map<string, TicketSnapshot>()
        for (const msg of messages) {
          latestMessageState.set(msg.id, {
            status: msg.status,
            adminResponse: msg.adminResponse || null,
            updatedAt: msg.updatedAt,
          })
        }

        if (hasInitializedNotificationBaseline.current) {
          for (const alert of alerts) {
            if (!knownActiveAlertIds.current.has(alert.id)) {
              notifyAdmin(`New alert: ${alert.title}`, '/alerts')
            }
          }
          for (const ticket of pendingTickets) {
            if (!knownPendingTicketIds.current.has(ticket.id)) {
              notifyAdmin(`New ticket from ${ticket.userName}`, '/tickets')
            }
          }
          for (const msg of messages) {
            const previous = knownAdminMessageStates.current.get(msg.id)
            if (!previous) continue
            if (previous.status !== msg.status) {
              notifyAdmin(
                `Ticket ${msg.id} moved from ${previous.status} to ${msg.status}`,
                '/tickets'
              )
            }
          }
        } else {
          hasInitializedNotificationBaseline.current = true
        }

        knownActiveAlertIds.current = currentActiveAlertIds
        knownPendingTicketIds.current = currentPendingTicketIds
        knownAdminMessageStates.current = latestMessageState
      } catch (e) {
        if (!cancelled) {
          setActiveAlertCount(0)
          setPendingTicketCount(0)
        }
      }
    }

    loadAdminNotifications()
    const interval = setInterval(loadAdminNotifications, 5000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isStaff, notificationPref])

  useEffect(() => {
    let cancelled = false
    if (!user || isStaff) {
      hasInitializedUserMessageBaseline.current = false
      knownUserMessageStates.current = new Map()
      return
    }

    const notifyUser = (message: string) => {
      if (notificationPref && !notificationPref.ticketUpdates) return
      pushNotification('Ticket Update', message, { path: '/report' })
    }

    const loadUserTicketUpdates = async () => {
      try {
        const messages = await api.getMyMessages()
        if (cancelled) return
        const latestState = new Map<string, TicketSnapshot>()
        for (const msg of messages) {
          latestState.set(msg.id, {
            status: msg.status,
            adminResponse: msg.adminResponse || null,
            updatedAt: msg.updatedAt,
          })
        }

        if (hasInitializedUserMessageBaseline.current) {
          for (const msg of messages) {
            const previous = knownUserMessageStates.current.get(msg.id)
            if (!previous) continue
            if (previous.status !== msg.status) {
              notifyUser(`Ticket ${msg.id} is now ${msg.status}.`)
            } else if ((previous.adminResponse || '') !== (msg.adminResponse || '')) {
              notifyUser(`Admin responded on ticket ${msg.id}.`)
            }
          }
        } else {
          hasInitializedUserMessageBaseline.current = true
        }

        knownUserMessageStates.current = latestState
      } catch (e) {
        // keep silent on polling failures
      }
    }

    loadUserTicketUpdates()
    const interval = setInterval(loadUserTicketUpdates, 5000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user, isStaff, notificationPref])

  useEffect(() => {
    if (!user) return
    const token = getToken()
    if (!token) return
    const eventSource = new EventSource(`${streamBase}/stream?token=${encodeURIComponent(token)}`)

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (!payload?.type || payload.type === 'connected') return
        if (payload.type === 'ticket.created' && user.role !== 'user') {
          if (notificationPref && !notificationPref.ticketUpdates) return
          pushNotification('Live Ticket', `New ticket ${payload.ticketId} created`, { path: '/tickets' })
        } else if (payload.type === 'ticket.updated') {
          if (notificationPref && !notificationPref.ticketUpdates) return
          pushNotification('Live Update', `Ticket ${payload.ticketId} changed to ${payload.status}`, {
            path: user.role === 'user' ? '/report' : '/tickets',
          })
        } else if (payload.type === 'alert.updated' && user.role !== 'user') {
          if (notificationPref && !notificationPref.alertUpdates) return
          pushNotification('Live Alert', `Alert ${payload.alertId} changed to ${payload.status}`, { path: '/alerts' })
        }
      } catch {
        // ignore stream parse errors
      }
    }

    return () => eventSource.close()
  }, [user, notificationPref, streamBase])

  const adminItems = useMemo<NavItem[]>(
    () => {
      const items: NavItem[] = [
        { path: '/admin/dashboard', label: 'Dashboard' },
        { path: '/devices', label: 'Devices' },
        { path: '/topology', label: 'Topology' },
        { path: '/security', label: 'Security' },
        { path: '/alerts', label: 'Alerts', badge: activeAlertCount > 0 ? activeAlertCount : undefined },
        { path: '/tickets', label: 'Tickets', badge: pendingTicketCount > 0 ? pendingTicketCount : undefined },
      ]
      if (isAdmin) {
        items.push({ path: '/admin/users', label: 'Users' })
        items.push({ path: '/audit-logs', label: 'Audit Logs' })
        items.push({ path: '/settings', label: 'Settings' })
      }
      return items
    },
    [activeAlertCount, pendingTicketCount, isAdmin]
  )

  const userItems: NavItem[] = [
    { path: '/user/dashboard', label: 'Dashboard' },
    { path: '/speed', label: 'Network Speed' },
    { path: '/events', label: 'Events' },
    { path: '/report', label: 'Report Issue' },
  ]

  const isActive = (path: string) => {
    if (path === '/devices' && location.pathname.startsWith('/devices')) return true
    return location.pathname === path
  }

  const handleLogout = () => {
    logout()
    setUser(null)
    navigate('/login')
  }

  const handleNotificationClick = (item: NotificationItem) => {
    setNotificationCenter((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    )
    if (item.path) {
      setNotificationCenterOpen(false)
      navigate(item.path)
    }
  }

  return (
    <div className={styles.wrapper}>
      {user && (
        <aside className={styles.sidebar}>
          <Link to={dashboardPath} className={styles.logo}>
            <span className={styles.logoIcon}>*</span>
            Network Tracker
          </Link>

          {isStaff && (
            <div className={styles.group}>
              <button className={styles.groupToggle} onClick={() => setAdminOpen((v) => !v)} type="button">
                Staff Pages
                <span className={styles.chevron}>{adminOpen ? 'v' : '>'}</span>
              </button>
              {adminOpen && (
                <nav className={styles.groupItems}>
                  {adminItems.map(({ path, label, badge }) => (
                    <Link
                      key={path}
                      to={path}
                      className={`${styles.navLink} ${isActive(path) ? styles.navLinkActive : ''}`}
                    >
                      {label}
                      {badge !== undefined && badge > 0 && <span className={styles.badge}>{badge}</span>}
                    </Link>
                  ))}
                </nav>
              )}
            </div>
          )}

          <div className={styles.group}>
            <button className={styles.groupToggle} onClick={() => setUserOpen((v) => !v)} type="button">
              User Pages
              <span className={styles.chevron}>{userOpen ? 'v' : '>'}</span>
            </button>
            {userOpen && (
              <nav className={styles.groupItems}>
                {userItems.map(({ path, label }) => (
                  <Link
                    key={path}
                    to={path}
                    className={`${styles.navLink} ${isActive(path) ? styles.navLinkActive : ''}`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <button type="button" onClick={handleLogout} className={`${styles.navLink} ${styles.logoutButton}`}>
            Logout ({user.username})
          </button>
        </aside>
      )}

      <div className={styles.content}>
        {user && (
          <div className={styles.notificationBellWrap}>
            <button
              type="button"
              className={styles.notificationBell}
              onClick={() => setNotificationCenterOpen((v) => !v)}
              aria-label="Toggle notifications"
            >
              <span className={styles.bellIcon} aria-hidden="true">{'\u{1F514}'}</span>
              <span className={styles.bellText}>Notifications</span>
              {unreadCount > 0 && <span className={styles.notificationBadge}>{unreadCount}</span>}
            </button>
            {notificationCenterOpen && (
              <div className={styles.notificationPanel}>
                <div className={styles.notificationPanelHeader}>
                  <strong>Notifications</strong>
                  <button
                    type="button"
                    className={styles.notificationPanelClear}
                    onClick={() => setNotificationCenter([])}
                  >
                    Clear All
                  </button>
                </div>
                {notificationCenter.length === 0 ? (
                  <div className={styles.notificationEmpty}>No notifications yet.</div>
                ) : (
                  <div className={styles.notificationList}>
                    {notificationCenter.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={`${styles.notificationItem} ${item.read ? '' : styles.notificationItemUnread}`}
                        onClick={() => handleNotificationClick(item)}
                      >
                        <div className={styles.notificationTitle}>{item.title}</div>
                        <div className={styles.notificationDetail}>{item.detail}</div>
                        <div className={styles.notificationTime}>
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {notifications.length > 0 && (
          <div className={styles.notifications}>
            {notifications.map((n) => (
              <div key={n.id} className={styles.notificationToast}>
                {n.message}
              </div>
            ))}
          </div>
        )}
        {!user && (
          <header className={styles.header}>
            <Link to="/login" className={styles.logo}>
              <span className={styles.logoIcon}>*</span>
              Network Tracker
            </Link>
            <div className={styles.headerLinks}>
              <Link to="/login" className={styles.navLink}>Login</Link>
              <Link to="/signup" className={styles.navLink}>Sign Up</Link>
            </div>
          </header>
        )}
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  )
}

