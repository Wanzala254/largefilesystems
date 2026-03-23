import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login, logout } from '../api/client'
import styles from './Login.module.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<'admin' | 'user'>('user')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const data = await login(username, password)
      const role = data?.user?.role
      if (role !== selectedRole) {
        logout()
        setError(`This account is not a ${selectedRole}. Please select the correct role.`)
        return
      }
      if (data?.welcomeMessage) {
        alert(data.welcomeMessage)
      } else {
        alert(`Welcome, ${username}.`)
      }
      navigate(role === 'user' ? '/user/dashboard' : '/admin/dashboard')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    }
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.container}>
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <fieldset className={styles.roleTabs}>
            <legend className={styles.roleLegend}>Sign in as</legend>
            <label className={`${styles.roleTab} ${selectedRole === 'user' ? styles.roleTabActive : ''}`}>
              <input
                type="radio"
                name="login-role"
                value="user"
                checked={selectedRole === 'user'}
                onChange={() => setSelectedRole('user')}
                className={styles.roleInput}
              />
              User
            </label>
            <label className={`${styles.roleTab} ${selectedRole === 'admin' ? styles.roleTabActive : ''}`}>
              <input
                type="radio"
                name="login-role"
                value="admin"
                checked={selectedRole === 'admin'}
                onChange={() => setSelectedRole('admin')}
                className={styles.roleInput}
              />
              Admin
            </label>
          </fieldset>
          <div className={styles.field}>
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              className={styles.input}
              placeholder="Enter username"
              aria-label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className={styles.input}
              placeholder="Enter password"
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.button} type="submit">Sign In</button>
          <div className={styles.footer}>
            <Link className={styles.signupLink} to="/forgot-password">Forgot password?</Link>
          </div>
        </form>
        <div className={styles.footer}>
          <Link className={styles.signupLink} to="/signup">Don't have an account? Create one</Link>
        </div>
      </div>
    </div>
  )
}
