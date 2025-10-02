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
    if (hour >= 5 && hour < 12) return 'Goood morning!';
    if (hour >= 12 && hour < 18) return 'Goood afternoon!';
    return 'Goood evening!';
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      
      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        color: darkMode ? '#ffffff' : '#111827',
        transition: 'all 0.5s',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100vh',
          overflowY: 'auto',
          padding: '0 20px 32px'
        }}>
          {/* Greeting Section - UPDATED HIERARCHY */}
          <div style={{ marginBottom: '24px', marginTop: '20px' }}>
            <h2 style={{
              fontSize: '28px',
              fontWeight: '700',
              marginBottom: '16px',
              marginTop: '8px',
              background: 'linear-gradient(to right, #3B82F6, #A855F7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {getGreeting()}
            </h2>
            <h1 style={{ fontSize: '42px', fontWeight: '800', lineHeight: '1.2', color: darkMode ? '#ffffff' : '#111827', marginBottom: '8px', textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)' }}>
              {stories[currentStory].title}
            </h1>
          </div>

          {/* Story Navigation Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '16px' }}>
            {stories.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStory(i)}
                style={{
                  width: i === currentStory ? '24px' : '4px',
                  height: '4px',
                  background: i === currentStory ? 'linear-gradient(to right, #3B82F6, #A855F7)' : '#D1D5DB',
                  borderRadius: '9999px',
                  transition: 'all 0.3s',
                  border: 'none',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>

          {/* Today's 10 News Widget - STRONG BLUE GLASSMORPHISM */}
          <div style={{ 
            background: 'rgba(59, 130, 246, 0.25)', 
            backdropFilter: 'blur(30px)', 
            WebkitBackdropFilter: 'blur(30px)',
            border: '1px solid rgba(96, 165, 250, 0.4)', 
            borderRadius: '16px', 
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)', 
            padding: '20px', 
            marginBottom: '40px', 
            textAlign: 'center' 
          }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'white', marginBottom: '6px', textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}>Today's 10 News to Know</div>
            <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)' }}>2-minute daily summary</div>
          </div>

          {/* Today's Briefing - CLEAN TEXT LAYOUT (NO BOX) */}
          <div style={{ marginBottom: '40px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>✨</span>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: darkMode ? 'white' : '#111827', textShadow: darkMode ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none' }}>Today's Briefing</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '6px', height: '6px', background: '#10B981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>Live</span>
              </div>
            </div>

            {/* What's Happening - Clean Text */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: darkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)', marginBottom: '12px' }}>WHAT'S HAPPENING</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {whatsHappening.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingLeft: '4px' }}>
                    <div style={{ width: '5px', height: '5px', background: item.color, borderRadius: '50%', marginTop: '7px', flexShrink: 0, animation: item.urgent ? 'pulse 2s infinite' : 'none' }}></div>
                    <span style={{ fontSize: '13px', fontWeight: 500, lineHeight: '1.5', color: darkMode ? 'white' : '#111827' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Today in History - Clean Text */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: darkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px' }}>📅</span>
                TODAY IN HISTORY
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {historicalEvents.slice(0, 3).map((event, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', paddingLeft: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#A855F7', minWidth: '45px' }}>{event.year}</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, lineHeight: '1.5', color: darkMode ? 'white' : '#111827' }}>{event.event}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts Button - With Glassmorphism */}
            <button 
              style={{
                width: '100%',
                padding: '14px',
                background: 'rgba(59, 130, 246, 0.2)',
                backdropFilter: 'blur(15px)',
                WebkitBackdropFilter: 'blur(15px)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '14px',
                fontWeight: '700',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                color: 'white',
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.2)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.25)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.2)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ fontSize: '18px' }}>🔔</span>
                  <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '22px', height: '22px', background: '#EF4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 2s infinite' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'white' }}>{alertCount > 99 ? '99+' : alertCount}</span>
                  </div>
                </div>
                <span>{alertCount} New {alertCount === 1 ? 'Alert' : 'Alerts'}</span>
              </div>
            </button>
          </div>

          {/* Live Reader Counter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '16px' }}>👥</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981' }}>{readerCount.toLocaleString()}</span>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>reading now</span>
            <div style={{ width: '6px', height: '6px', background: '#10B981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
          </div>

          {/* Scroll Hint */}
          <div style={{ textAlign: 'center', fontSize: '10px', opacity: 0.5, marginBottom: '16px' }}>
            SCROLL TO CONTINUE ↓
          </div>
        </div>
      </div>
    </>
  );
}