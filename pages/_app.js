import '../styles/globals.css'
import React from 'react'

// Error Boundary to catch and handle JavaScript errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorCount: 0 }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo)
    // Increment error count
    this.setState(prev => ({ errorCount: prev.errorCount + 1 }))
  }

  render() {
    if (this.state.hasError) {
      // Show fallback UI
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#000000',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          padding: '24px',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '40px',
            fontWeight: '800',
            letterSpacing: '-1px',
            color: '#f5f5f7',
            marginBottom: '12px'
          }}>
            today<span style={{ color: '#CC2E22' }}>+</span>
          </h1>
          <p style={{ 
            fontSize: '17px', 
            color: '#86868b',
            marginBottom: '24px',
            maxWidth: '400px'
          }}>
            Something went wrong. Please refresh the page.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, errorCount: 0 })
              window.location.reload()
            }}
            style={{
              padding: '12px 24px',
              fontSize: '17px',
              fontWeight: '500',
              background: '#007aff',
              color: 'white',
              border: 'none',
              borderRadius: '980px',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default function App({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <Component {...pageProps} />
    </ErrorBoundary>
  )
}
