import '../styles/globals.css'
import React from 'react'
import Head from 'next/head'

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
          background: '#f5f5f7',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>📰</div>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: '#1d1d1f',
            marginBottom: '12px'
          }}>
            TEN NEWS
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
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        {/* iOS PWA - Enable full screen and transparent status bar */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#f5f5f7" />
      </Head>
      <ErrorBoundary>
        <Component {...pageProps} />
      </ErrorBoundary>
    </>
  )
}
