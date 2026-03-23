const rawApiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api'
const API_BASE = rawApiBase.replace(/\/+$/, '')

function apiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${normalizedPath}`
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nt_token') : null
  const headers = new Headers(options?.headers as HeadersInit)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
  })
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('nt_token')
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    const error = await res.json().catch(() => ({ error: `API error: ${res.status}` }))
    throw new Error(error.error || `API error: ${res.status}`)
  }
  return res.json()
}

function base64UrlDecode(input: string) {
  input = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = input.length % 4
  if (pad) input += '='.repeat(4 - pad)
  // atob exists in browser
  return atob(input)
}

export async function login(username: string, password: string) {
  const res = await fetch(apiUrl('/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Login failed' }))
    throw new Error(err.error || 'Login failed')
  }
  const data = await res.json()
  localStorage.setItem('nt_token', data.token)
  return data
}

export async function signup(username: string, password: string) {
  const res = await fetch(apiUrl('/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Signup failed' }))
    throw new Error(err.error || 'Signup failed')
  }
  const data = await res.json()
  localStorage.setItem('nt_token', data.token)
  return data
}

export function logout() {
  localStorage.removeItem('nt_token')
}

export function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('nt_token') : null
}

export function getTokenUser() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nt_token') : null
  if (!token) return null
  try {
    const [b] = token.split('.')
    if (!b) return null
    const json = base64UrlDecode(b)
    const p = JSON.parse(json)
    if (!p?.id || !p?.username || !p?.role) {
      localStorage.removeItem('nt_token')
      return null
    }
    if (p.exp && Date.now() > p.exp) {
      localStorage.removeItem('nt_token')
      return null
    }
    return { id: p.id, username: p.username, role: p.role }
  } catch (e) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nt_token')
    }
    return null
  }
}

export async function forgotPassword(username: string, email?: string) {
  const res = await fetch(apiUrl('/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Password recovery failed')
  }
  return data as {
    message: string
    resetToken?: string
    expiresAt?: string
    emailSent?: boolean
    emailConfigured?: boolean
  }
}

export async function resetPassword(resetToken: string, newPassword: string) {
  const res = await fetch(apiUrl('/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resetToken, newPassword }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Reset password failed')
  }
  return data as { message: string }
}

export const api = {
  getStats: () => fetchApi<import('../types/network').NetworkStats>('/stats'),
  getDevices: () => fetchApi<import('../types/network').NetworkDevice[]>('/devices'),
  getDevice: (id: string) =>
    fetchApi<import('../types/network').NetworkDevice>(`/devices/${id}`),
  getTraffic: () =>
    fetchApi<import('../types/network').TrafficSample[]>('/traffic'),
  createDevice: (data: {
    name: string
    ip: string
    type: import('../types/network').NetworkDevice['type']
    location?: string
    mac?: string
    parentId?: string
  }) =>
    fetchApi<import('../types/network').NetworkDevice>('/devices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteDevice: (id: string) =>
    fetchApi<{ message: string; device: import('../types/network').NetworkDevice }>(
      `/devices/${id}`,
      { method: 'DELETE' }
    ),
  testDevice: (id: string) =>
    fetchApi<import('../types/network').DeviceProbeResult>(`/devices/${id}/test`, {
      method: 'POST',
    }),
  updateDeviceConnection: (id: string, parentId?: string) =>
    fetchApi<import('../types/network').NetworkDevice>(`/devices/${id}/connection`, {
      method: 'PUT',
      body: JSON.stringify({ parentId: parentId || null }),
    }),
  getMessages: () =>
    fetchApi<import('../types/network').NetworkMessage[]>('/messages'),
  getMyMessages: () =>
    fetchApi<import('../types/network').NetworkMessage[]>('/messages/mine'),
  getMessage: (id: string) =>
    fetchApi<import('../types/network').NetworkMessage>(`/messages/${id}`),
  createMessage: (data: {
    userName: string
    userEmail?: string
    message: string
    attachment?: {
      name?: string
      contentType?: string
      data?: string
    }
  }) =>
    fetchApi<import('../types/network').NetworkMessage>('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateMessage: (
    id: string,
    data: {
      status?: import('../types/network').MessageStatus
      adminResponse?: string
      estimatedFixTime?: string
    }
  ) =>
    fetchApi<import('../types/network').TicketUpdateResponse>(`/messages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getSpeed: () =>
    fetchApi<import('../types/network').SpeedStats>('/speed'),
  getSpeedHistory: () =>
    fetchApi<import('../types/network').NetworkSpeed[]>('/speed/history'),
  getHealth: () =>
    fetchApi<import('../types/network').NetworkHealth>('/health'),
  getAlerts: (status?: string) =>
    fetchApi<import('../types/network').NetworkAlert[]>(
      `/alerts${status ? `?status=${status}` : ''}`
    ),
  getAlert: (id: string) =>
    fetchApi<import('../types/network').NetworkAlert>(`/alerts/${id}`),
  updateAlert: (id: string, data: { status?: import('../types/network').AlertStatus }) =>
    fetchApi<import('../types/network').NetworkAlert>(`/alerts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteAlert: (id: string) =>
    fetchApi<{ message: string; alert: import('../types/network').NetworkAlert }>(
      `/alerts/${id}`,
      { method: 'DELETE' }
    ),
  getDeviceDetails: (id: string) =>
    fetchApi<import('../types/network').DeviceDetails>(`/devices/${id}/details`),
  getEvents: (limit?: number) =>
    fetchApi<import('../types/network').NetworkEvent[]>(
      `/events${limit ? `?limit=${limit}` : ''}`
    ),
  getEvent: (id: string) =>
    fetchApi<import('../types/network').NetworkEvent>(`/events/${id}`),
  getSettings: () =>
    fetchApi<import('../types/network').Settings>('/settings'),
  updateSettings: (data: Partial<import('../types/network').Settings>) =>
    fetchApi<import('../types/network').Settings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    fetchApi<{ message: string }>('/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAdminUsers: () => fetchApi<import('../types/network').AppUser[]>('/admin/users'),
  createAdminUser: (data: { username: string; password: string; role: 'admin' | 'technician' | 'viewer' | 'user' }) =>
    fetchApi<import('../types/network').AppUser>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAdminUserPassword: (id: string, newPassword: string) =>
    fetchApi<{ message: string }>(`/admin/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    }),
  updateAdminUserRole: (id: string, role: 'admin' | 'technician' | 'viewer' | 'user') =>
    fetchApi<{ message: string }>(`/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  deleteAdminUser: (id: string) =>
    fetchApi<{ message: string }>(`/admin/users/${id}`, {
      method: 'DELETE',
    }),
  getTicketAnalytics: () =>
    fetchApi<import('../types/network').TicketAnalytics>('/tickets/analytics'),
  getAuditLogs: (limit = 200) =>
    fetchApi<import('../types/network').AuditLogItem[]>(`/audit-logs?limit=${limit}`),
  getNotificationPreferences: () =>
    fetchApi<import('../types/network').NotificationPreferences>('/me/notification-preferences'),
  updateNotificationPreferences: (
    data: Partial<import('../types/network').NotificationPreferences>
  ) =>
    fetchApi<import('../types/network').NotificationPreferences>('/me/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}

export default api
