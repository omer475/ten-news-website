import { useEffect, useState } from 'react'

export default function TestSafeArea() {
  const [debugInfo, setDebugInfo] = useState({})

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const viewport = document.querySelector('meta[name="viewport"]')
      const info = {
        viewportContent: viewport ? viewport.content : 'NOT FOUND',
        hasViewportFit: viewport ? viewport.content.includes('viewport-fit=cover') : false,
        bodyPaddingTop: window.getComputedStyle(document.body).paddingTop,
        htmlPaddingTop: window.getComputedStyle(document.documentElement).paddingTop,
      }
      setDebugInfo(info)
      console.log('🔍 Debug Info:', info)
    }
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(to bottom, #ff0000, #0000ff)'
    }}>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: '#ffff00',
        paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
        paddingBottom: '20px',
        textAlign: 'center',
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#000'
      }}>
        TOP - Should be below notch
      </div>
      
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#00ff00',
        paddingTop: '20px',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        textAlign: 'center',
        color: '#000',
        fontSize: '20px',
        fontWeight: 'bold'
      }}>
        BOTTOM - Should be above home indicator
      </div>

      <div style={{
        position: 'fixed',
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        background: '#ff00ff',
        paddingLeft: 'calc(10px + env(safe-area-inset-left, 0px))',
        paddingRight: '10px',
        paddingTop: '20px',
        paddingBottom: '20px',
        color: '#fff',
        fontSize: '16px',
        fontWeight: 'bold',
        writingMode: 'vertical-rl'
      }}>
        LEFT
      </div>

      <div style={{
        position: 'fixed',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        background: '#00ffff',
        paddingRight: 'calc(10px + env(safe-area-inset-right, 0px))',
        paddingLeft: '10px',
        paddingTop: '20px',
        paddingBottom: '20px',
        color: '#000',
        fontSize: '16px',
        fontWeight: 'bold',
        writingMode: 'vertical-rl'
      }}>
        RIGHT
      </div>

      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '20px',
        borderRadius: '12px',
        textAlign: 'center',
        maxWidth: '90%',
        fontSize: '14px'
      }}>
        <h1 style={{ fontSize: '24px', marginBottom: '10px', color: '#000' }}>
          Safe Area Test
        </h1>
        <div style={{ marginBottom: '15px', color: '#666' }}>
          <p style={{ margin: '5px 0' }}>• Yellow bar below notch ✅</p>
          <p style={{ margin: '5px 0' }}>• Green bar above home indicator ✅</p>
          <p style={{ margin: '5px 0' }}>• No black bars ✅</p>
          <p style={{ margin: '5px 0' }}>• Edge-to-edge background ✅</p>
        </div>
        
        {debugInfo.viewportContent && (
          <div style={{ 
            marginTop: '15px', 
            padding: '10px', 
            background: '#f0f0f0', 
            borderRadius: '6px',
            fontSize: '11px',
            textAlign: 'left',
            wordBreak: 'break-all'
          }}>
            <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Debug Info:</p>
            <p style={{ margin: '5px 0' }}>
              <strong>viewport-fit=cover:</strong> {debugInfo.hasViewportFit ? '✅ YES' : '❌ NO'}
            </p>
            <p style={{ margin: '5px 0', fontSize: '10px' }}>
              {debugInfo.viewportContent}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

