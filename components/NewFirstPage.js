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
          {/* Greeting Section */}
          <div style={{ marginBottom: '16px' }}>
            <h1 style={{
              fontSize: '36px',
              fontWeight: 'bold',
              marginBottom: '12px',
              background: 'linear-gradient(to right, #3B82F6, #A855F7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {getGreeting()}
            </h1>
            <p style={{ fontSize: '20px', fontWeight: 'bold', lineHeight: '1.3', padding: '0 8px', marginBottom: '8px' }}>
              {stories[currentStory].title}
            </p>
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

          {/* Today's 10 News Widget */}
          <div style={{ background: '#DBEAFE', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '16px', marginBottom: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e40af', marginBottom: '4px' }}>Today's 10 News to Know</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>2-minute daily summary</div>
          </div>

          {/* Today's Briefing Section - NO GLASS CONTAINER, LARGER TYPOGRAPHY */}
          <div style={{ marginBottom: '24px' }}>
            {/* Main Briefing Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <span style={{ fontSize: '22px' }}>✨</span>
              <span style={{ fontSize: '22px', fontWeight: 800, color: 'white', textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}>Today's Briefing</span>
            </div>

            {/* What's Happening */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '16px' }}>WHAT'S HAPPENING</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {whatsHappening.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', paddingLeft: '20px', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: '6px', width: '8px', height: '8px', background: i === 0 ? '#EF4444' : 'white', borderRadius: '50%', flexShrink: 0, animation: i === 0 ? 'pulse 2s infinite' : 'none' }}></div>
                    <span style={{ fontSize: '16px', fontWeight: 600, lineHeight: '1.5', color: 'white', textShadow: '0 1px 3px rgba(0, 0, 0, 0.2)' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Today in History */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📅</span>
                <span>TODAY IN HISTORY</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {historicalEvents.slice(0, 3).map((event, i) => (
                  <div key={i} style={{ paddingLeft: '20px', position: 'relative' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#a78bfa', marginBottom: '4px' }}>{event.year}</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'white', lineHeight: '1.4', textShadow: '0 1px 3px rgba(0, 0, 0, 0.2)' }}>{event.event}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts Button - Glassmorphism */}
            <button 
              style={{
                width: '100%',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '14px',
                fontWeight: 700,
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 8px 32px rgba(31, 38, 135, 0.15)',
                color: 'white'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ fontSize: '20px' }}>🔔</span>
                  <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '20px', height: '20px', background: '#EF4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 2s infinite' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'white' }}>{alertCount > 99 ? '99+' : alertCount}</span>
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