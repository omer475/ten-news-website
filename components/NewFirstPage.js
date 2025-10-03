import { useState, useEffect } from 'react';

export default function NewFirstPage({ onContinue }) {
  const [readerCount, setReaderCount] = useState(2347);
  const [alertCount] = useState(23);
  const [currentStory, setCurrentStory] = useState(0);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState(0);

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

  // Word-by-word blur animation for headline
  const headlineWords = stories[currentStory].title.split(' ');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightedWordIndex(prev => (prev + 1) % headlineWords.length);
    }, 700); // 700ms per word for normal reading pace
    return () => clearInterval(interval);
  }, [headlineWords.length]);

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
        @keyframes float-soft {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(30px, -30px); }
          66% { transform: translate(-30px, 30px); }
        }
        @keyframes sweep-headline {
          0% {
            left: -150px;
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          100% {
            left: calc(100% + 150px);
            opacity: 0;
          }
        }
      `}</style>
      
      {/* BACKGROUND BLUR EFFECTS - Soft Pastel Colors */}
      <div style={{
        position: 'fixed',
        top: '15%',
        right: '10%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(254, 202, 202, 0.25), transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0,
        animation: 'float-soft 25s ease-in-out infinite'
      }}></div>
      <div style={{
        position: 'fixed',
        top: '45%',
        left: '5%',
        width: '450px',
        height: '450px',
        background: 'radial-gradient(circle, rgba(191, 219, 254, 0.25), transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0,
        animation: 'float-soft 30s ease-in-out infinite reverse'
      }}></div>
      <div style={{
        position: 'fixed',
        bottom: '20%',
        right: '15%',
        width: '380px',
        height: '380px',
        background: 'radial-gradient(circle, rgba(221, 214, 254, 0.25), transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0,
        animation: 'float-soft 35s ease-in-out infinite'
      }}></div>

      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        color: '#111827',
        transition: 'all 0.5s',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          height: '100vh',
          overflowY: 'auto',
          padding: '0 20px 32px'
        }}>
          {/* Greeting Section - UPDATED HIERARCHY */}
          <div style={{ marginBottom: '30px', marginTop: '20px' }}>
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
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <h1 style={{ fontSize: '36px', fontWeight: '800', lineHeight: '1.2', color: '#111827', textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)', position: 'relative', zIndex: 2 }}>
                {headlineWords.map((word, index) => (
                  <span
                    key={index}
                    style={{
                      display: 'inline-block',
                      marginRight: '0.3em',
                      position: 'relative',
                      transition: 'all 0.4s ease-in-out',
                      filter: index === highlightedWordIndex
                        ? 'drop-shadow(0 0 10px rgba(59, 130, 246, 1)) drop-shadow(0 0 20px rgba(59, 130, 246, 0.8)) drop-shadow(0 0 30px rgba(59, 130, 246, 0.6))'
                        : 'none',
                      transform: index === highlightedWordIndex ? 'scale(1.05)' : 'scale(1)'
                    }}
                  >
                    {word}
                  </span>
                ))}
              </h1>
            </div>
          </div>


          {/* Today's Briefing - Header Only (No Icon) */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#000000' }}>Today's Briefing</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '6px', height: '6px', background: '#10B981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>Live</span>
              </div>
            </div>
          </div>

          {/* What's Happening - GLASSMORPHISM BOX */}
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(13px)',
            WebkitBackdropFilter: 'blur(13px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '20px',
            padding: '16px',
            marginBottom: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1), inset 0 0 22px 11px rgba(255, 255, 255, 0.11)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#000000', marginBottom: '12px' }}>WHAT'S HAPPENING</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {whatsHappening.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingLeft: '4px' }}>
                  <div style={{ width: '5px', height: '5px', background: item.color, borderRadius: '50%', marginTop: '7px', flexShrink: 0, animation: item.urgent ? 'pulse 2s infinite' : 'none' }}></div>
                  <span style={{ fontSize: '13px', fontWeight: 500, lineHeight: '1.5', color: '#000000' }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Today in History - GLASSMORPHISM BOX (No Icon) */}
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(13px)',
            WebkitBackdropFilter: 'blur(13px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '20px',
            padding: '16px',
            marginBottom: '30px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1), inset 0 0 22px 11px rgba(255, 255, 255, 0.11)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#000000', marginBottom: '12px' }}>TODAY IN HISTORY</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {historicalEvents.slice(0, 3).map((event, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', paddingLeft: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#A855F7', minWidth: '45px' }}>{event.year}</span>
                  <span style={{ fontSize: '13px', fontWeight: 500, lineHeight: '1.5', color: '#000000' }}>{event.event}</span>
                </div>
              ))}
            </div>
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