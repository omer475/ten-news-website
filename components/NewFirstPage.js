import { useState, useEffect } from 'react';

export default function NewFirstPage({ darkMode, toggleDarkMode, onContinue }) {
  const [readerCount, setReaderCount] = useState(2347);
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

          {/* News Summary Card */}
          <div style={{ background: '#E0F2FE', borderRadius: '12px', padding: '12px', marginBottom: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E40AF', marginBottom: '4px' }}>Today's 10 News to Know</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>2-minute daily summary</div>
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