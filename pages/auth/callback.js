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
    
    let sessionHandled = false
    
    // Set up auth state change listener to catch the session when it's set
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      addDebugInfo(`🔄 Auth state changed: ${event} ${session ? '(Session exists)' : '(No session)'}`)
      
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && !sessionHandled) {
        sessionHandled = true
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
          router.push('/?verified=true')
        }, 1500)
      }
    })
    
    // Also try to get session immediately
    const checkSession = async () => {
      try {
        // If there's a hash fragment with tokens, manually extract and set session
        if (window.location.hash && window.location.hash.includes('access_token')) {
          addDebugInfo('🔑 Hash fragment detected, manually parsing tokens...')
          
          // Parse the hash fragment
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const access_token = hashParams.get('access_token')
          const refresh_token = hashParams.get('refresh_token')
          
          if (access_token && refresh_token) {
            addDebugInfo('🔓 Tokens found, setting session...')
            
            // Manually set the session with the tokens
            const { data, error } = await supabase.auth.setSession({
              access_token,
              refresh_token
            })
            
            if (error) {
              addDebugInfo(`❌ Error setting session: ${error.message}`)
              setError(`Session setup failed: ${error.message}`)
              setStatus('Verification failed')
              return
            }
            
            if (data?.session) {
              addDebugInfo(`✅ Session created! User: ${data.session.user.email}`)
              setStatus('Email verified successfully!')
              
              localStorage.setItem('tennews_session', JSON.stringify(data.session))
              localStorage.setItem('tennews_user', JSON.stringify(data.session.user))
              addDebugInfo('💾 Session saved to localStorage')
              
              addDebugInfo('🔄 Redirecting to home page...')
              setTimeout(() => {
                router.push('/?verified=true')
              }, 1500)
              return
            }
          } else {
            addDebugInfo('⚠️ Tokens not found in hash fragment')
          }
        }
        
        // Check for code in query params
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        
        if (code) {
          addDebugInfo('📧 Found code in URL, exchanging for session...')
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          
          if (exchangeError) {
            addDebugInfo(`❌ Code exchange error: ${exchangeError.message}`)
            setError(`Code exchange failed: ${exchangeError.message}`)
          } else if (data.session) {
            addDebugInfo('✅ Session obtained from code exchange!')
            setStatus('Email verified successfully!')
            
            localStorage.setItem('tennews_session', JSON.stringify(data.session))
            localStorage.setItem('tennews_user', JSON.stringify(data.session.user))
            addDebugInfo('💾 Session saved to localStorage')
            
            addDebugInfo('🔄 Redirecting to home page...')
            setTimeout(() => {
              router.push('/?verified=true')
            }, 1500)
            return
          }
        }
        
        // Try getting session
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
            router.push('/?verified=true')
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
      backgroundColor: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '360px',
        width: '100%'
      }}>
        {/* Icon */}
        <div style={{
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          {error ? (
            // Error X Icon
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          ) : status.includes('successfully') ? (
            // Success Check Icon
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="9 12 11 14 15 10"></polyline>
            </svg>
          ) : (
            // Loading Spinner Icon
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8"></circle>
            </svg>
          )}
        </div>
        
        {/* Title */}
        <h1 style={{
          fontSize: '20px',
          fontWeight: '500',
          color: '#000000',
          marginBottom: '8px',
          letterSpacing: '-0.3px'
        }}>
          {status}
        </h1>
        
        {/* Subtitle */}
        {!error && status.includes('successfully') && (
          <p style={{
            color: '#666666',
            fontSize: '14px',
            fontWeight: '400',
            marginTop: '8px'
          }}>
            Redirecting...
          </p>
        )}
        
        {/* Error Message */}
        {error && (
          <div style={{ marginTop: '16px' }}>
            <p style={{
              color: '#666666',
              fontSize: '14px',
              marginBottom: '24px',
              lineHeight: '1.5'
            }}>
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
                cursor: 'pointer',
                transition: 'opacity 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.opacity = '0.8'}
              onMouseOut={(e) => e.target.style.opacity = '1'}
            >
              Go Home
            </button>
          </div>
        )}
        
        {/* Loading Dots */}
        {!error && !status.includes('successfully') && (
          <div style={{
            marginTop: '24px',
            display: 'flex',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#000000',
              animation: 'dot1 1.4s infinite'
            }} />
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#000000',
              animation: 'dot2 1.4s infinite'
            }} />
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#000000',
              animation: 'dot3 1.4s infinite'
            }} />
          </div>
        )}
      </div>
      
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes dot1 {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }
        
        @keyframes dot2 {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
          0% { animation-delay: 0.2s; }
        }
        
        @keyframes dot3 {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
          0% { animation-delay: 0.4s; }
        }
      `}</style>
    </div>
  )
}
