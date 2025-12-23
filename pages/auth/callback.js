import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../../lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Processing...')
  const [error, setError] = useState(null)
  const [isPasswordReset, setIsPasswordReset] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    
    // Check if this is a password reset (recovery) flow
    const urlParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const type = urlParams.get('type') || hashParams.get('type')
    
    console.log('Callback type:', type)
    console.log('URL:', window.location.href)
    
    if (type === 'recovery') {
      // This is a password reset flow
      setIsPasswordReset(true)
      setStatus('Reset Your Password')
      
      // Still need to set the session from the tokens
      handleSession(supabase, true)
    } else {
      // Regular email verification
      setStatus('Verifying your email...')
      handleSession(supabase, false)
    }
  }, [])

  const handleSession = async (supabase, isRecovery) => {
    try {
      // If there's a hash fragment with tokens, set session
      if (window.location.hash && window.location.hash.includes('access_token')) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const access_token = hashParams.get('access_token')
        const refresh_token = hashParams.get('refresh_token')
        
        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token
          })
          
          if (error) {
            setError(`Session setup failed: ${error.message}`)
            return
          }
          
          if (data?.session && !isRecovery) {
            // Only auto-redirect for email verification, not password reset
            localStorage.setItem('tennews_session', JSON.stringify(data.session))
            localStorage.setItem('tennews_user', JSON.stringify(data.session.user))
            setStatus('Email verified successfully!')
            setTimeout(() => router.push('/?verified=true'), 1500)
          }
          return
        }
      }
      
      // Check for code in query params
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        
        if (error) {
          setError(`Verification failed: ${error.message}`)
          return
        }
        
        if (data?.session && !isRecovery) {
          localStorage.setItem('tennews_session', JSON.stringify(data.session))
          localStorage.setItem('tennews_user', JSON.stringify(data.session.user))
          setStatus('Email verified successfully!')
          setTimeout(() => router.push('/?verified=true'), 1500)
        }
      }
    } catch (err) {
      setError(`An error occurred: ${err.message}`)
    }
  }

  const handlePasswordReset = async (e) => {
    e.preventDefault()
    setPasswordError('')
    
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    
    setLoading(true)
    
    try {
      const supabase = createClient()
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) {
        setPasswordError(error.message)
        setLoading(false)
        return
      }
      
      setPasswordSuccess(true)
      setStatus('Password updated successfully!')
      
      // Redirect to home after 2 seconds
      setTimeout(() => {
        router.push('/')
      }, 2000)
      
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Password Reset Form
  if (isPasswordReset && !passwordSuccess) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '20px'
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: '360px',
          width: '100%'
        }}>
          <div style={{ marginBottom: '24px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#000000',
            marginBottom: '8px'
          }}>
            Reset Your Password
          </h1>
          
          <p style={{
            color: '#666666',
            fontSize: '14px',
            marginBottom: '24px'
          }}>
            Enter your new password below
          </p>
          
          <form onSubmit={handlePasswordReset}>
            <div style={{ marginBottom: '16px', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: '16px',
                  border: '1px solid #d2d2d7',
                  borderRadius: '8px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: '16px',
                  border: '1px solid #d2d2d7',
                  borderRadius: '8px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            {passwordError && (
              <p style={{
                color: '#dc2626',
                fontSize: '14px',
                marginBottom: '16px',
                textAlign: 'left'
              }}>
                {passwordError}
              </p>
            )}
            
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#000000',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Success/Error/Loading View
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '360px',
        width: '100%'
      }}>
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center' }}>
          {error ? (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          ) : status.includes('successfully') ? (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="9 12 11 14 15 10"></polyline>
            </svg>
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8"></circle>
            </svg>
          )}
        </div>
        
        <h1 style={{
          fontSize: '20px',
          fontWeight: '500',
          color: '#000000',
          marginBottom: '8px'
        }}>
          {status}
        </h1>
        
        {status.includes('successfully') && (
          <p style={{ color: '#666666', fontSize: '14px', marginTop: '8px' }}>
            Redirecting...
          </p>
        )}
        
        {error && (
          <div style={{ marginTop: '16px' }}>
            <p style={{ color: '#666666', fontSize: '14px', marginBottom: '24px' }}>
              {error}
            </p>
            <button
              onClick={() => router.push('/')}
              style={{
                backgroundColor: '#000000',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Go Home
            </button>
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
