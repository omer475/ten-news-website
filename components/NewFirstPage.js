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
          {/* Greeting Section - Refined Hierarchy */}
          <div style={{ marginBottom: '16px', marginTop: '40px' }}>
            {/* Main Headline - LARGER than greeting */}
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'white', marginBottom: '20px', lineHeight: '1.2', textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)' }}>
              {stories[currentStory].title}
            </h1>
            
            {/* Greeting - SMALLER than headline */}
            <h2 style={{
              fontSize: '24px',
              fontWeight: 700,
              marginBottom: '12px',
              background: 'linear-gradient(to right, #60a5fa, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {getGreeting()}
            </h2>
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

          {/* VERY GLASSY BLUE-TINTED BOX - Today's 10 News */}
          <div 
            style={{ 
              background: 'rgba(59, 130, 246, 0.25)', 
              backdropFilter: 'blur(25px)', 
              WebkitBackdropFilter: 'blur(25px)',
              border: '1px solid rgba(96, 165, 250, 0.3)', 
              borderRadius: '16px', 
              boxShadow: '0 12px 40px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)', 
              padding: '20px', 
              marginBottom: '40px', 
              textAlign: 'center',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 16px 48px rgba(59, 130, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'white', marginBottom: '6px', textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}>Today's 10 News to Know</div>
            <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>2-minute daily summary</div>
          </div>

          {/* EDITORIAL-STYLE LAYOUT - NO BOXES, LARGER TYPOGRAPHY */}
          <div style={{ marginBottom: '50px' }}>
            {/* Editorial Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
              <span style={{ fontSize: '26px' }}>✨</span>
              <span style={{ fontSize: '26px', fontWeight: 800, color: 'white', textShadow: '0 2px 6px rgba(0, 0, 0, 0.3)', letterSpacing: '-0.5px' }}>Today's Briefing</span>
            </div>

            {/* What's Happening - Editorial Style */}
            <div style={{ marginBottom: '40px' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '24px', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', paddingBottom: '8px' }}>WHAT'S HAPPENING</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {whatsHappening.map((item, i) => (
                  <div key={i} style={{ paddingLeft: '24px', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: '8px', width: '10px', height: '10px', background: i === 0 ? '#EF4444' : 'white', borderRadius: '50%', boxShadow: i === 0 ? '0 2px 8px rgba(239, 68, 68, 0.6)' : '0 2px 6px rgba(255, 255, 255, 0.4)', animation: i === 0 ? 'pulse 2s infinite' : 'none' }}></div>
                    <span style={{ fontSize: '18px', fontWeight: 600, lineHeight: '1.6', color: 'white', textShadow: '0 1px 4px rgba(0, 0, 0, 0.3)' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Today in History - Editorial Style */}
            <div style={{ marginBottom: '40px' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '24px', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📅</span>
                <span>TODAY IN HISTORY</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {historicalEvents.slice(0, 3).map((event, i) => (
                  <div key={i} style={{ paddingLeft: '24px', position: 'relative' }}>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#c4b5fd', marginBottom: '6px', letterSpacing: '0.5px' }}>{event.year}</div>
                    <div style={{ fontSize: '17px', fontWeight: 600, color: 'white', lineHeight: '1.5', textShadow: '0 1px 4px rgba(0, 0, 0, 0.3)' }}>{event.event}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts Button - Strong Glassmorphism */}
            <button 
              style={{
                width: '100%',
                padding: '18px',
                background: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(25px)',
                WebkitBackdropFilter: 'blur(25px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '16px',
                fontWeight: 800,
                fontSize: '17px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 12px 40px rgba(31, 38, 135, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                color: 'white'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 16px 48px rgba(31, 38, 135, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(31, 38, 135, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ fontSize: '22px' }}>🔔</span>
                  <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '26px', height: '26px', background: '#EF4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 2s infinite', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.5)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'white' }}>{alertCount > 99 ? '99+' : alertCount}</span>
                  </div>
                </div>
                <span>{alertCount} New {alertCount === 1 ? 'Alert' : 'Alerts'}</span>
              </div>
            </button>
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