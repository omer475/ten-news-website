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
        height: '100vh',
        background: 'transparent',
        color: darkMode ? '#ffffff' : '#111827',
        transition: 'all 0.5s',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100vh',
          overflowY: 'auto',
          padding: '12px 20px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Greeting Section - UPDATED HIERARCHY */}
          <div style={{ marginBottom: '20px', marginTop: '10px', flexShrink: 0 }}>
            <h2 style={{
              fontSize: '28px',
              fontWeight: '700',
              marginBottom: '12px',
              marginTop: '8px',
              background: 'linear-gradient(to right, #3B82F6, #A855F7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {getGreeting()}
            </h2>
            <h1 style={{ fontSize: '34px', fontWeight: '800', lineHeight: '1.2', color: darkMode ? '#ffffff' : 'white', marginBottom: '12px', textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)' }}>
              {stories[currentStory].title}
            </h1>
          </div>

          {/* Story Navigation Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '20px', flexShrink: 0 }}>
            {stories.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStory(i)}
                style={{
                  width: i === currentStory ? '24px' : '4px',
                  height: '4px',
                  background: i === currentStory ? 'linear-gradient(to right, #3B82F6, #A855F7)' : 'rgba(255, 255, 255, 0.3)',
                  borderRadius: '9999px',
                  transition: 'all 0.3s',
                  border: 'none',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>

          {/* Today's Briefing - GLASSMORPHISM BOX (SAME AS TIMELINE/DETAILS) */}
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.15)', 
            backdropFilter: 'blur(20px)', 
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)', 
            borderRadius: '16px', 
            padding: '18px', 
            marginBottom: '20px',
            boxShadow: '0 8px 32px rgba(31, 38, 135, 0.15)',
            flexShrink: 0
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>✨</span>
                <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'white', textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>Today's Briefing</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '6px', height: '6px', background: '#10B981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 600 }}>Live</span>
              </div>
            </div>

            {/* What's Happening - READABLE IN BOTH MODES */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '10px' }}>WHAT'S HAPPENING</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {whatsHappening.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '4px' }}>
                    <div style={{ width: '5px', height: '5px', background: item.color, borderRadius: '50%', marginTop: '6px', flexShrink: 0, animation: item.urgent ? 'pulse 2s infinite' : 'none' }}></div>
                    <span style={{ fontSize: '12px', fontWeight: 500, lineHeight: '1.5', color: darkMode ? 'white' : '#1f2937' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Today in History - READABLE IN BOTH MODES */}
            <div style={{ marginBottom: 0 }}>
              <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px' }}>📅</span>
                TODAY IN HISTORY
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {historicalEvents.slice(0, 3).map((event, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', paddingLeft: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#A855F7', minWidth: '40px' }}>{event.year}</span>
                    <span style={{ fontSize: '12px', fontWeight: 500, lineHeight: '1.5', color: darkMode ? 'white' : '#1f2937' }}>{event.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scroll Hint */}
          <div style={{ textAlign: 'center', fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', marginTop: 'auto', paddingTop: '15px', paddingBottom: '10px', letterSpacing: '1px', flexShrink: 0 }}>
            SCROLL TO CONTINUE ↓
          </div>
        </div>
      </div>
    </>
  );
}