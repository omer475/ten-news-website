import { useState, useEffect } from 'react';

export default function NewFirstPage({ onContinue }) {
  const darkMode = false; // Dark mode removed
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
        height: '100vh',
        background: 'transparent',
        color: '#111827',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 20px'
      }}>
          {/* Greeting Section - COMPRESSED FOR 100VH */}
          <div style={{ marginBottom: '12px', flexShrink: 0 }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              marginBottom: '10px',
              background: 'linear-gradient(to right, #3B82F6, #A855F7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {getGreeting()}
            </h2>
            <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1.2', color: 'white', textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)' }}>
              {stories[currentStory].title}
            </h1>
          </div>

          {/* Today's Briefing - ADVANCED GLASSMORPHISM BOX */}
          <div style={{ 
            background: 'linear-gradient(-75deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05))', 
            backdropFilter: 'blur(2px)', 
            WebkitBackdropFilter: 'blur(2px)',
            border: '1px solid rgba(255, 255, 255, 0.5)', 
            borderRadius: '20px', 
            padding: '14px', 
            marginBottom: '12px',
            boxShadow: 'inset 0 0.125em 0.125em rgba(0, 0, 0, 0.05), inset 0 -0.125em 0.125em rgba(255, 255, 255, 0.5), 0 0.25em 0.125em -0.125em rgba(0, 0, 0, 0.2), 0 0 0.1em 0.25em inset rgba(255, 255, 255, 0.2)',
            position: 'relative',
            flex: 1,
            overflowY: 'auto',
            minHeight: 0
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px' }}>✨</span>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'white', textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>Today's Briefing</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '5px', height: '5px', background: '#10B981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 600 }}>Live</span>
              </div>
            </div>

            {/* What's Happening - BLACK TEXT */}
            <div style={{ marginBottom: '12px', position: 'relative', zIndex: 2 }}>
              <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#374151', marginBottom: '8px' }}>WHAT'S HAPPENING</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {whatsHappening.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '2px' }}>
                    <div style={{ width: '4px', height: '4px', background: item.color, borderRadius: '50%', marginTop: '5px', flexShrink: 0, animation: item.urgent ? 'pulse 2s infinite' : 'none' }}></div>
                    <span style={{ fontSize: '11px', fontWeight: 500, lineHeight: '1.4', color: '#000000' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Today in History - BLACK TEXT */}
            <div style={{ marginBottom: 0, position: 'relative', zIndex: 2 }}>
              <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#374151', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px' }}>📅</span>
                TODAY IN HISTORY
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {historicalEvents.slice(0, 3).map((event, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', paddingLeft: '2px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#7c3aed', minWidth: '40px' }}>{event.year}</span>
                    <span style={{ fontSize: '11px', fontWeight: 500, lineHeight: '1.4', color: '#000000' }}>{event.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scroll Hint */}
          <div style={{ textAlign: 'center', fontSize: '9px', color: 'rgba(255, 255, 255, 0.5)', padding: '8px 0', letterSpacing: '1px', flexShrink: 0 }}>
            SCROLL TO CONTINUE ↓
          </div>
      </div>
    </>
  );
}