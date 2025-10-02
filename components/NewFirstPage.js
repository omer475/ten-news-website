import { useState, useEffect } from 'react';

export default function NewFirstPage({ darkMode, toggleDarkMode, onContinue }) {
  const [readerCount, setReaderCount] = useState(2347);
  const [alertCount] = useState(23);
  const [currentStory, setCurrentStory] = useState(0);

  // Simulate live reader count updates
  useEffect(() => {
    const interval = setInterval(() => {
      setReaderCount(prev => prev + Math.floor(Math.random() * 7) - 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const stories = [
    {
      title: "Critical NATO-Russia tensions dominate today's headlines.",
      subtitle: "NATO Issues Stern Wa...",
    },
    {
      title: "Global markets rally on breakthrough trade agreement.",
      subtitle: "Markets surge as deal...",
    },
    {
      title: "AI breakthrough transforms medical diagnostics worldwide.",
      subtitle: "Revolutionary AI tech...",
    },
  ];

  const whatsHappening = [
    { text: 'NATO-Russia tensions escalate in Eastern Europe', color: '#EF4444', urgent: true },
    { text: 'Global markets surge 3% on trade deal optimism', color: '#10B981', urgent: false },
    { text: 'Tech giants announce joint AI safety initiative', color: '#3B82F6', urgent: false },
  ];

  const historicalEvents = [
    { year: '1789', event: 'U.S. Constitution ratified by required states' },
    { year: '1957', event: 'Sputnik 1 launched, starting Space Age' },
    { year: '1991', event: 'World Wide Web made publicly available' },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning!';
    if (hour >= 12 && hour < 18) return 'Good afternoon!';
    return 'Good evening!';
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
          transition: all 0.3s ease;
        }
        .glass-card:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(31, 38, 135, 0.2);
        }
      `}</style>
      
      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        color: darkMode ? '#ffffff' : '#111827',
        padding: '20px',
        paddingTop: '40px'
      }}>
        {/* Greeting Section with Glass Effect */}
        <div style={{
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: '800',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.5px'
          }}>
            {getGreeting()}
          </h1>
        </div>

        {/* Main Headline Card - Glassmorphism */}
        <div 
          className="glass-card"
          style={{
            borderRadius: '24px',
            padding: '32px 24px',
            marginBottom: '20px',
            textAlign: 'center'
          }}
        >
          <p style={{ 
            fontSize: '24px', 
            fontWeight: '700', 
            lineHeight: '1.4', 
            color: darkMode ? 'white' : '#1f2937',
            marginBottom: '16px'
          }}>
            {stories[currentStory].title}
          </p>
          
          {/* Story Navigation Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
            {stories.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStory(i)}
                style={{
                  width: i === currentStory ? '32px' : '8px',
                  height: '8px',
                  background: i === currentStory 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                    : 'rgba(255, 255, 255, 0.3)',
                  borderRadius: '4px',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: 'none',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)'
                }}
              />
            ))}
          </div>
        </div>

        {/* Today's 10 News Widget - Enhanced Glass */}
        <div 
          className="glass-card"
          onClick={onContinue}
          style={{ 
            borderRadius: '20px',
            padding: '24px', 
            marginBottom: '20px', 
            textAlign: 'center',
            cursor: 'pointer',
            background: 'rgba(59, 130, 246, 0.12)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: darkMode ? 'white' : '#1e40af', marginBottom: '8px' }}>
            📰 Today's 10 News to Know
          </div>
          <div style={{ fontSize: '14px', color: darkMode ? 'rgba(255,255,255,0.7)' : '#64748b', marginBottom: '16px' }}>
            2-minute daily summary
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            padding: '8px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}>
            <span style={{ fontSize: '24px' }}>▶️</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: darkMode ? 'white' : '#1f2937' }}>Start Reading</span>
          </div>
        </div>

        {/* Today's Briefing Card - Glassmorphism */}
        <div 
          className="glass-card"
          style={{
            borderRadius: '24px',
            padding: '24px',
            marginBottom: '20px'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>✨</span>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: darkMode ? 'white' : '#1f2937' }}>Today's Briefing</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', background: '#10B981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
              <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>Live</span>
            </div>
          </div>

          {/* What's Happening - Glass Subsection */}
          <div 
            className="glass-card"
            style={{
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '16px',
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.15)'
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.6, marginBottom: '12px', letterSpacing: '1px' }}>
              WHAT'S HAPPENING
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {whatsHappening.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ 
                    width: '6px', 
                    height: '6px', 
                    background: item.color, 
                    borderRadius: '50%', 
                    marginTop: '6px', 
                    flexShrink: 0, 
                    animation: item.urgent ? 'pulse 2s infinite' : 'none',
                    boxShadow: item.urgent ? `0 0 10px ${item.color}` : 'none'
                  }}></div>
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    lineHeight: '1.5',
                    color: darkMode ? 'rgba(255,255,255,0.9)' : '#1f2937'
                  }}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Today in History - Glass Subsection */}
          <div 
            className="glass-card"
            style={{
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '16px',
              background: 'rgba(168, 85, 247, 0.08)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(168, 85, 247, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '16px' }}>📅</span>
              <div style={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.6, letterSpacing: '1px' }}>
                TODAY IN HISTORY
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historicalEvents.slice(0, 3).map((event, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: 'bold', 
                    color: '#A855F7',
                    minWidth: '45px'
                  }}>
                    {event.year}
                  </span>
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    lineHeight: '1.5',
                    color: darkMode ? 'rgba(255,255,255,0.85)' : '#374151'
                  }}>
                    {event.event}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts Button - Glass Style */}
          <button 
            className="glass-card"
            style={{
              width: '100%',
              padding: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              backdropFilter: 'blur(15px)',
              WebkitBackdropFilter: 'blur(15px)',
              borderRadius: '16px',
              fontWeight: 'bold',
              fontSize: '15px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              cursor: 'pointer',
              transition: 'all 0.3s',
              color: darkMode ? '#ffffff' : '#1f2937',
              boxShadow: '0 8px 32px rgba(239, 68, 68, 0.15)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ fontSize: '20px' }}>🔔</span>
                <div style={{ 
                  position: 'absolute', 
                  top: '-4px', 
                  right: '-4px', 
                  width: '18px', 
                  height: '18px', 
                  background: '#EF4444', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  animation: 'pulse 2s infinite',
                  boxShadow: '0 0 15px rgba(239, 68, 68, 0.5)'
                }}>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'white' }}>
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                </div>
              </div>
              <span>{alertCount} New {alertCount === 1 ? 'Alert' : 'Alerts'}</span>
            </div>
          </button>
        </div>

        {/* Live Reader Counter - Glass Badge */}
        <div 
          className="glass-card"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 20px',
            borderRadius: '20px',
            marginBottom: '20px',
            marginLeft: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(16, 185, 129, 0.1)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}
        >
          <span style={{ fontSize: '18px' }}>👥</span>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#10B981' }}>
            {readerCount.toLocaleString()}
          </span>
          <span style={{ fontSize: '14px', color: darkMode ? 'rgba(255,255,255,0.7)' : '#6B7280' }}>
            reading now
          </span>
          <div style={{ 
            width: '8px', 
            height: '8px', 
            background: '#10B981', 
            borderRadius: '50%', 
            animation: 'pulse 2s infinite',
            boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
          }}></div>
        </div>

        {/* Scroll Hint - Glass Badge */}
        <div style={{ 
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          <div 
            className="glass-card"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: '600',
              color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)',
              letterSpacing: '1px',
              background: 'rgba(255, 255, 255, 0.08)',
              animation: 'float 3s ease-in-out infinite'
            }}
          >
            SCROLL TO CONTINUE ↓
          </div>
        </div>
      </div>
    </>
  );
}