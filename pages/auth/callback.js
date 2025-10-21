import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../../lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Verifying your email...')
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const supabase = createClient()
        
        // Get the session from the URL hash
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          setError('Email verification failed. Please try again.')
          setStatus('Verification failed')
          return
        }

        if (data.session) {
          setStatus('Email verified successfully!')
          // Store session in localStorage
          localStorage.setItem('tennews_session', JSON.stringify(data.session))
          localStorage.setItem('tennews_user', JSON.stringify(data.session.user))
          
          // Redirect to home page after 2 seconds
          setTimeout(() => {
            router.push('/')
          }, 2000)
        } else {
          setError('No session found. Please try signing up again.')
          setStatus('Verification failed')
        }
      } catch (err) {
        console.error('Callback error:', err)
        setError('An error occurred. Please try again.')
        setStatus('Verification failed')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '90%'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '20px'
        }}>
          {error ? '❌' : status.includes('successfully') ? '✅' : '⏳'}
        </div>
        
        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '16px'
        }}>
          {status}
        </h1>
        
        {error && (
          <p style={{
            color: '#dc2626',
            fontSize: '16px',
            marginBottom: '20px'
          }}>
            {error}
          </p>
        )}
        
        {status.includes('successfully') && (
          <p style={{
            color: '#059669',
            fontSize: '16px',
            marginBottom: '20px'
          }}>
            Redirecting you to Ten News...
          </p>
        )}
        
        {error && (
          <button
            onClick={() => router.push('/')}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Go to Home
          </button>
        )}
      </div>
    </div>
  )
}
