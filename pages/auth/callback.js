import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../../lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Verifying your email...')
  const [error, setError] = useState(null)
  const [debugInfo, setDebugInfo] = useState([])
  
  const addDebugInfo = (message) => {
    setDebugInfo(prev => [...prev, message])
    console.log(message)
  }

  useEffect(() => {
    const supabase = createClient()
    
    addDebugInfo('🔐 Processing email confirmation callback...')
    addDebugInfo(`📍 URL: ${window.location.href.substring(0, 100)}...`)
    
    const urlHash = window.location.hash.substring(0, 200)
    const urlSearch = window.location.search
    addDebugInfo(`📍 Hash: ${urlHash ? urlHash.substring(0, 50) + '...' : 'empty'}`)
    addDebugInfo(`📍 Search: ${urlSearch || 'empty'}`)
    
    // Set up auth state change listener to catch the session when it's set
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      addDebugInfo(`🔄 Auth state changed: ${event} ${session ? '(Session exists)' : '(No session)'}`)
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          addDebugInfo(`✅ Session obtained! User: ${session.user.email}`)
          setStatus('Email verified successfully!')
          
          // Store session in localStorage (Supabase client automatically saves to its own storage)
          localStorage.setItem('tennews_session', JSON.stringify(session))
          localStorage.setItem('tennews_user', JSON.stringify(session.user))
          addDebugInfo('💾 Session saved to localStorage')
          
          // Wait a moment to ensure session is fully set in Supabase client
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Redirect to home page
          addDebugInfo('🔄 Redirecting to home page...')
          setTimeout(() => {
            window.location.href = '/?verified=true'
          }, 1500)
        }
      }
    })
    
    // Also try to get session immediately
    const checkSession = async () => {
      try {
        // Check for code in query params first
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        
        if (code) {
          addDebugInfo('📧 Found code in URL, exchanging for session...')
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          
          if (exchangeError) {
            addDebugInfo(`❌ Code exchange error: ${exchangeError.message}`)
            setError(`Code exchange failed: ${exchangeError.message}`)
            // Continue to try getSession below
          } else if (data.session) {
            addDebugInfo('✅ Session obtained from code exchange!')
            setStatus('Email verified successfully!')
            
            // Save to localStorage (Supabase client automatically saves to its own storage)
            localStorage.setItem('tennews_session', JSON.stringify(data.session))
            localStorage.setItem('tennews_user', JSON.stringify(data.session.user))
            addDebugInfo('💾 Session saved to localStorage')
            
            // Ensure Supabase client has the session by refreshing
            await supabase.auth.refreshSession()
            addDebugInfo('🔄 Session refreshed in Supabase client')
            
            // Wait a moment to ensure session is fully set
            await new Promise(resolve => setTimeout(resolve, 500))
            
            addDebugInfo('🔄 Redirecting to home page...')
            setTimeout(() => {
              window.location.href = '/?verified=true'
            }, 1500)
            return
          }
        }
        
        // Try getting session (handles hash fragments automatically)
        addDebugInfo('📧 Getting session from Supabase...')
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          addDebugInfo(`❌ Get session error: ${error.message}`)
          setError(`Email verification failed: ${error.message}`)
          setStatus('Verification failed')
          return
        }
        
        if (data.session) {
          addDebugInfo(`✅ Session found! User: ${data.session.user.email}`)
          setStatus('Email verified successfully!')
          
          // Save to localStorage (Supabase client automatically saves to its own storage)
          localStorage.setItem('tennews_session', JSON.stringify(data.session))
          localStorage.setItem('tennews_user', JSON.stringify(data.session.user))
          addDebugInfo('💾 Session saved to localStorage')
          
          // Ensure Supabase client has the session by refreshing
          await supabase.auth.refreshSession()
          addDebugInfo('🔄 Session refreshed in Supabase client')
          
          // Wait a moment to ensure session is fully set
          await new Promise(resolve => setTimeout(resolve, 500))
          
          addDebugInfo('🔄 Redirecting to home page...')
          setTimeout(() => {
            window.location.href = '/?verified=true'
          }, 1500)
        } else {
          addDebugInfo('⏳ No session yet, waiting for auth state change...')
          // Wait a bit for the auth state change listener to fire
          setTimeout(async () => {
            const { data: retryData } = await supabase.auth.getSession()
            if (!retryData?.session) {
              addDebugInfo('❌ No session found after waiting')
              setError('No session found. The confirmation link may have expired. Please try signing up again.')
              setStatus('Verification failed')
            }
          }, 3000)
        }
      } catch (err) {
        addDebugInfo(`❌ Callback error: ${err.message}`)
        setError(`An error occurred: ${err.message}`)
        setStatus('Verification failed')
      }
    }
    
    checkSession()
    
    // Cleanup listener on unmount
    return () => {
      authListener?.subscription?.unsubscribe()
    }
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
        
        {/* Debug info for mobile */}
        {debugInfo.length > 0 && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            fontSize: '12px',
            textAlign: 'left',
            maxHeight: '200px',
            overflowY: 'auto',
            fontFamily: 'monospace'
          }}>
            <strong style={{ display: 'block', marginBottom: '10px' }}>Debug Info:</strong>
            {debugInfo.map((info, idx) => (
              <div key={idx} style={{ marginBottom: '5px', color: '#6b7280' }}>
                {info}
              </div>
            ))}
          </div>
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
