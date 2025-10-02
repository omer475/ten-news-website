import { useState, useEffect } from 'react';

export default function NewFirstPage({ onContinue }) {
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
        maxHeight: '100vh',
        background: 'transparent',
        color: '#111827',
        overflow: 'hidden',
        padding: '0 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
          {/* Greeting Section - COMPRESSED FOR 100VH */}
          <div style={{ marginBottom: '15px', marginTop: '10px' }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              marginBottom: '8px',
              marginTop: '4px',
              background: 'linear-gradient(to right, #3B82F6, #A855F7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {getGreeting()}
            </h2>
            <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1.1', color: '#111827', marginBottom: '4px', textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)' }}>
              {stories[currentStory].title}
            </h1>
          </div>

          {/* Today's Briefing - COMPRESSED FOR 100VH */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '10px',
            boxShadow: '0 8px 32px rgba(31, 38, 135, 0.15)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px' }}>✨</span>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#000000', textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>Today's Briefing</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '4px', height: '4px', background: '#10B981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                <span style={{ fontSize: '9px', color: '#10B981', fontWeight: 600 }}>Live</span>
              </div>
            </div>

            {/* What's Happening - COMPRESSED */}
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#000000', marginBottom: '4px' }}>WHAT'S HAPPENING</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {whatsHappening.slice(0, 2).map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', paddingLeft: '2px' }}>
                    <div style={{ width: '3px', height: '3px', background: item.color, borderRadius: '50%', marginTop: '3px', flexShrink: 0, animation: item.urgent ? 'pulse 2s infinite' : 'none' }}></div>
                    <span style={{ fontSize: '11px', fontWeight: 500, lineHeight: '1.2', color: '#000000' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Today in History - COMPRESSED */}
            <div style={{ marginBottom: 0 }}>
              <div style={{ fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#000000', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px' }}>📅</span>
                TODAY IN HISTORY
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {historicalEvents.slice(0, 2).map((event, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', paddingLeft: '2px' }}>
                    <span style={{ fontSize: '9px', fontWeight: '700', color: '#A855F7', minWidth: '35px' }}>{event.year}</span>
                    <span style={{ fontSize: '11px', fontWeight: 500, lineHeight: '1.2', color: '#000000' }}>{event.event}</span>
                  </div>
                ))}
              </div>
            </div>
        </div>
      </div>
    </>
  );
}