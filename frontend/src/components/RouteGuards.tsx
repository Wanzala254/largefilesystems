import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getTokenUser } from '../api/client'

interface GuardProps {
  children: ReactNode
}

export function RequireAuth({ children }: GuardProps) {
  const location = useLocation()
  const user = getTokenUser()
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

export function RequireAdmin({ children }: GuardProps) {
  const user = getTokenUser()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/user/dashboard" replace />
  return <>{children}</>
}

export function RequireStaff({ children }: GuardProps) {
  const user = getTokenUser()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'user') return <Navigate to="/user/dashboard" replace />
  return <>{children}</>
}

export function RequireGuest({ children }: GuardProps) {
  const user = getTokenUser()
  if (!user) return <>{children}</>
  return <Navigate to={user.role === 'user' ? '/user/dashboard' : '/admin/dashboard'} replace />
}

export function RoleHomeRedirect() {
  const user = getTokenUser()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'user' ? '/user/dashboard' : '/admin/dashboard'} replace />
}
