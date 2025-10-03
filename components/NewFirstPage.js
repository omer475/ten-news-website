import { useState, useEffect } from 'react';

export default function NewFirstPage({ onContinue }) {
  const [readerCount, setReaderCount] = useState(2347);
  const [alertCount] = useState(23);
  const [currentStory, setCurrentStory] = useState(0);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(true);

  // Simulate live reader count updates
  useEffect(() => {
    const interval = setInterval(() => {
      setReaderCount(prev => prev + Math.floor(Math.random() * 7) - 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Word-by-word blur animation for headline
  const headlineWords = stories[currentStory].title.split(' ');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightedWordIndex(prev => (prev + 1) % headlineWords.length);
    }, 700); // 700ms per word for normal reading pace
    return () => clearInterval(interval);
  }, [headlineWords.length]);


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
        @keyframes float-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-30px, 30px) scale(0.9); }
        }
        @keyframes float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 40px) scale(1.15); }
          66% { transform: translate(40px, -20px) scale(0.95); }
        }
        @keyframes float-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(25px, 35px) scale(1.05); }
          66% { transform: translate(-35px, -25px) scale(0.9); }
        }
        @keyframes headline-sweep {
          0% {
            left: -180px;
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          100% {
            left: calc(100% + 180px);
            opacity: 0;
          }
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
        color: '#111827',
        transition: 'all 0.5s',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Soft Background Color Blurs */}
        <div style={{
          position: 'fixed',
          top: '15%',
          right: '10%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(239, 68, 68, 0.15), transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'float-1 25s ease-in-out infinite'
        }}></div>
        <div style={{
          position: 'fixed',
          top: '45%',
          left: '5%',
          width: '450px',
          height: '450px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15), transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'float-2 30s ease-in-out infinite'
        }}></div>
        <div style={{
          position: 'fixed',
          bottom: '20%',
          right: '15%',
          width: '380px',
          height: '380px',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15), transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'float-3 35s ease-in-out infinite'
        }}></div>
        <div style={{
          height: '100vh',
          overflowY: 'auto',
          padding: '0 20px 32px',
          position: 'relative',
          zIndex: 1
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
              <h1 style={{ fontSize: '36px', fontWeight: '800', lineHeight: '1.2', color: '#111827', position: 'relative', zIndex: 2 }}>
                {headlineWords.map((word, index) => (
                  <span
                    key={index}
                    style={{
                      display: 'inline-block',
                      marginRight: '0.3em',
                      position: 'relative',
                      transition: 'all 0.3s ease-in-out',
                      filter: index === highlightedWordIndex
                        ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.8)) drop-shadow(0 0 15px rgba(59, 130, 246, 0.6)) drop-shadow(0 0 25px rgba(59, 130, 246, 0.4))'
                        : 'none',
                      transform: index === highlightedWordIndex ? 'scale(1.02)' : 'scale(1)'
                    }}
                  >
                    {word}
                  </span>
                ))}
              </h1>
            </div>
          </div>


          {/* Toggle Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              background: 'linear-gradient(-75deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05))',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              borderRadius: '999vw',
              padding: '2px',
              width: '180px'
            }}>
              <div
                onClick={() => setShowHistory(true)}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  borderRadius: '999vw',
                  background: showHistory ? 'rgba(255, 255, 255, 0.3)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 400ms cubic-bezier(0.25, 1, 0.5, 1)',
                  boxShadow: showHistory ? 'inset 0 1px 2px rgba(0, 0, 0, 0.1)' : 'none',
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'rgba(50, 50, 50, 1)'
                }}
              >
                History
              </div>
              <div
                onClick={() => setShowHistory(false)}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  borderRadius: '999vw',
                  background: !showHistory ? 'rgba(255, 255, 255, 0.3)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 400ms cubic-bezier(0.25, 1, 0.5, 1)',
                  boxShadow: !showHistory ? 'inset 0 1px 2px rgba(0, 0, 0, 0.1)' : 'none',
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'rgba(50, 50, 50, 1)'
                }}
              >
                Happening
              </div>
            </div>
          </div>

          {/* Swipeable Glassmorphism Box */}
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
            {showHistory ? (
              // Today in History
              <>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#000000', marginBottom: '12px' }}>TODAY IN HISTORY</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {historicalEvents.slice(0, 3).map((event, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', paddingLeft: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#A855F7', minWidth: '45px' }}>{event.year}</span>
                      <span style={{ fontSize: '13px', fontWeight: 500, lineHeight: '1.5', color: '#000000' }}>{event.event}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              // What's Happening
              <>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#000000', marginBottom: '12px' }}>WHAT'S HAPPENING</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {whatsHappening.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingLeft: '4px' }}>
                      <div style={{ width: '5px', height: '5px', background: item.color, borderRadius: '50%', marginTop: '7px', flexShrink: 0, animation: item.urgent ? 'pulse 2s infinite' : 'none' }}></div>
                      <span style={{ fontSize: '13px', fontWeight: 500, lineHeight: '1.5', color: '#000000' }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
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