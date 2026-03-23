import { useEffect, useState } from 'react'
import { api, getTokenUser } from '../api/client'
import type { AppUser } from '../types/network'

export default function AdminUsers() {
  const current = getTokenUser()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'user' as 'admin' | 'technician' | 'viewer' | 'user',
  })

  const loadUsers = async () => {
    try {
      setError(null)
      const data = await api.getAdminUsers()
      setUsers(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.createAdminUser(newUser)
      setNewUser({ username: '', password: '', role: 'user' })
      await loadUsers()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create user')
    }
  }

  const handleResetPassword = async (id: string) => {
    const next = prompt('Enter new password for this user (min 6 characters):')
    if (!next) return
    try {
      setBusyUserId(id)
      await api.updateAdminUserPassword(id, next)
      alert('Password updated.')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update password')
    } finally {
      setBusyUserId(null)
    }
  }

  const handleRoleChange = async (
    id: string,
    role: 'admin' | 'technician' | 'viewer' | 'user'
  ) => {
    try {
      setBusyUserId(id)
      await api.updateAdminUserRole(id, role)
      await loadUsers()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update role')
    } finally {
      setBusyUserId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return
    try {
      setBusyUserId(id)
      await api.deleteAdminUser(id)
      await loadUsers()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete user')
    } finally {
      setBusyUserId(null)
    }
  }

  if (loading) return <div style={styles.centered}>Loading users...</div>
  if (error) return <div style={styles.error}>Error: {error}</div>

  return (
    <div>
      <h1 style={styles.title}>User Management</h1>
      <p style={styles.subtitle}>
        Admin can add users, reset passwords, change roles, and delete accounts.
      </p>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Add User</h2>
        <form onSubmit={handleCreateUser} style={styles.formRow}>
          <input
            style={styles.input}
            placeholder="Username"
            value={newUser.username}
            onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
            required
          />
          <input
            style={styles.input}
            placeholder="Password"
            type="password"
            minLength={6}
            value={newUser.password}
            onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
            required
          />
          <select
            style={styles.select}
            value={newUser.role}
            onChange={(e) =>
              setNewUser((p) => ({
                ...p,
                role: e.target.value as 'admin' | 'technician' | 'viewer' | 'user',
              }))
            }
          >
            <option value="user">User</option>
            <option value="viewer">Viewer</option>
            <option value="technician">Technician</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" style={styles.button}>Add</button>
        </form>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Users</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Username</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Created</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isCurrentUser = current?.id === u.id
              const busy = busyUserId === u.id
              return (
                <tr key={u.id}>
                  <td style={styles.td}>{u.username}</td>
                  <td style={styles.td}>
                    <select
                      style={styles.selectSmall}
                      value={u.role}
                      disabled={busy || isCurrentUser}
                      onChange={(e) =>
                        handleRoleChange(
                          u.id,
                          e.target.value as 'admin' | 'technician' | 'viewer' | 'user'
                        )
                      }
                    >
                      <option value="user">User</option>
                      <option value="viewer">Viewer</option>
                      <option value="technician">Technician</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={styles.td}>{new Date(u.createdAt).toLocaleString()}</td>
                  <td style={styles.td}>
                    <button
                      style={styles.secondaryButton}
                      disabled={busy}
                      onClick={() => handleResetPassword(u.id)}
                    >
                      Reset Password
                    </button>
                    <button
                      style={styles.dangerButton}
                      disabled={busy || isCurrentUser}
                      onClick={() => handleDelete(u.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  title: { marginBottom: '0.5rem', fontSize: '1.75rem' },
  subtitle: { marginBottom: '1rem', color: 'var(--text-secondary)' },
  centered: { textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' },
  error: { color: 'var(--danger)', padding: '1rem' },
  card: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1rem',
    marginBottom: '1rem',
  },
  sectionTitle: { marginTop: 0, fontSize: '1.1rem' },
  formRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  input: {
    padding: '0.6rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
  },
  select: {
    padding: '0.6rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
  },
  selectSmall: {
    padding: '0.35rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
  },
  button: {
    padding: '0.6rem 1rem',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '0.4rem 0.7rem',
    marginRight: '0.4rem',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
  },
  dangerButton: {
    padding: '0.4rem 0.7rem',
    background: 'rgba(248,81,73,0.18)',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '0.55rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  },
  td: { padding: '0.55rem', borderBottom: '1px solid var(--border)' },
}
