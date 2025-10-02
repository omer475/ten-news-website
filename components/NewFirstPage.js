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
        .glass-card {
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          border-radius: 16px;
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .glass-card-dark {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: 16px;
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .glass-button {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
        }
        .glass-button:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-1px);
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
          <div className={darkMode ? 'glass-card-dark' : 'glass-card'} style={{ padding: '16px', marginBottom: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: darkMode ? '#ffffff' : '#1e40af', marginBottom: '4px' }}>Today's 10 News to Know</div>
            <div style={{ fontSize: '12px', color: darkMode ? 'rgba(255, 255, 255, 0.8)' : '#64748b' }}>2-minute daily summary</div>
          </div>

          {/* Today's Briefing Card */}
          <div className={darkMode ? 'glass-card-dark' : 'glass-card'} style={{ padding: '16px', marginBottom: '12px', position: 'relative', overflow: 'hidden' }}>
            {/* Decorative gradients */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: '128px', height: '128px', background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1), transparent)', filter: 'blur(40px)' }}></div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '128px', height: '128px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1), transparent)', filter: 'blur(40px)' }}></div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>✨</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Today's Briefing</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '6px', height: '6px', background: '#10B981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 600 }}>Live</span>
              </div>
            </div>

            {/* What's Happening */}
            <div style={{ background: darkMode ? 'rgba(55, 65, 81, 0.3)' : '#F9FAFB', borderRadius: '12px', padding: '10px', marginBottom: '10px', position: 'relative', zIndex: 10 }}>
              <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.75, marginBottom: '8px' }}>WHAT'S HAPPENING</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {whatsHappening.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ width: '4px', height: '4px', background: item.color, borderRadius: '50%', marginTop: '6px', flexShrink: 0, animation: item.urgent ? 'pulse 2s infinite' : 'none' }}></div>
                    <span style={{ fontSize: '10px', fontWeight: 600, lineHeight: '1.4' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Today in History */}
            <div style={{ background: darkMode ? 'rgba(55, 65, 81, 0.3)' : '#F9FAFB', borderRadius: '12px', padding: '10px', marginBottom: '12px', position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px' }}>📅</span>
                <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.75 }}>TODAY IN HISTORY</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {historicalEvents.slice(0, 3).map((event, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#A855F7' }}>{event.year}</span>
                    <span style={{ fontSize: '10px', fontWeight: 600, lineHeight: '1.4' }}>{event.event}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts Button */}
            <button 
              style={{
                width: '100%',
                padding: '12px',
                background: darkMode ? 'linear-gradient(to right, #1e3a8a, #581c87)' : 'linear-gradient(to right, #DBEAFE, #F3E8FF)',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s',
                position: 'relative',
                zIndex: 10,
                color: darkMode ? '#ffffff' : '#111827'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ fontSize: '16px' }}>🔔</span>
                  <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '16px', height: '16px', background: '#EF4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 2s infinite' }}>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'white' }}>{alertCount > 99 ? '99+' : alertCount}</span>
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