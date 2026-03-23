import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword, resetPassword } from '../api/client'
import styles from './Login.module.css'

export default function ForgotPassword() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setGeneratedCode(null)
    setBusy(true)
    try {
      const res = await forgotPassword(username, email || undefined)
      setMessage(res.message)
      if (res.resetToken) setGeneratedCode(res.resetToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to request reset')
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const res = await resetPassword(recoveryCode, newPassword)
      setMessage(res.message)
      setRecoveryCode('')
      setNewPassword('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.container}>
        <h2>Recover Password</h2>

        <form onSubmit={handleGenerateCode}>
          <div className={styles.field}>
            <label htmlFor="recover-username">Username</label>
            <input
              id="recover-username"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="recover-email">Email (recommended)</label>
            <input
              id="recover-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <button className={styles.button} type="submit" disabled={busy}>
            {busy ? 'Please wait...' : 'Get Recovery Code'}
          </button>
        </form>

        {generatedCode && (
          <div className={styles.info}>
            Recovery code (use this if email is unavailable): <code>{generatedCode}</code>
          </div>
        )}

        <form onSubmit={handleReset} style={{ marginTop: '1rem' }}>
          <div className={styles.field}>
            <label htmlFor="reset-code">Recovery Code</label>
            <input
              id="reset-code"
              className={styles.input}
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              placeholder="Paste recovery code"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              className={styles.input}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>
          <button className={styles.button} type="submit" disabled={busy}>
            {busy ? 'Please wait...' : 'Reset Password'}
          </button>
        </form>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.info}>{message}</div>}

        <div className={styles.footer}>
          <Link className={styles.signupLink} to="/login">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
