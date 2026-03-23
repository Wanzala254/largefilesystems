import { Suspense } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import Dashboard from '../pages/Dashboard'
import styles from './DashboardWrapper.module.css'

export function DashboardWrapper() {
  return (
    <ErrorBoundary
      fallbackRender={({ error, errorInfo }) => (
        <div className={styles.errorFallback}>
          <h3 className={styles.errorTitle}>Dashboard Error</h3>
          <p>The dashboard encountered an error. Please refresh the page or try again later.</p>
          {import.meta.env.DEV && error && (
            <details className={styles.errorDetails}>
              <summary>Details</summary>
              <pre className={styles.errorPre}>
                {error.toString()}
                {errorInfo?.componentStack}
              </pre>
            </details>
          )}
          <button onClick={() => window.location.reload()} className={styles.retryButton}>
            Refresh Page
          </button>
        </div>
      )}
    >
      <Suspense 
        fallback={
          <div className={styles.loadingFallback}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading dashboard...</p>
          </div>
        }
      >
        <Dashboard />
      </Suspense>
    </ErrorBoundary>
  )
}
