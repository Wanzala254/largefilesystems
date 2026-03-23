import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signup } from '../api/client'
import styles from './Login.module.css'

export default function SignUp() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await signup(username, password)
      navigate('/user/dashboard')
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    }
  }

  return (
    <div className={styles.container}>
      <h2>Create account</h2>
      <form onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="signup-username">Username</label>
          <input
            id="signup-username"
            className={styles.input}
            placeholder="Choose a username"
            aria-label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            className={styles.input}
            placeholder="Choose a password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.button} type="submit">Create Account</button>
      </form>
    </div>
  )
}
