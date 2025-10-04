/**
 * ============================================================================
 * COMPLETE FIRST PAGE DESIGN CODE
 * ============================================================================
 * 
 * Features Included:
 * - Ultra-smooth continuous blue blur animation on headline
 * - Swipeable carousel (touch swipe left/right + click)
 * - Auto-rotation every 4 seconds
 * - Glassmorphism card designs
 * - Animated background blur effects (red, blue, purple)
 * - Time-based greeting (morning/afternoon/evening)
 * - Live indicator with pulse animation
 * - Touch-optimized interactions
 * - Smooth rounded corners
 * - Card indicators (dots)
 * 
 * ============================================================================
 */

import { useState, useEffect } from 'react';

export default function NewFirstPage({ onContinue }) {
  // ========== STATE MANAGEMENT ==========
  const [readerCount, setReaderCount] = useState(2347);
  const [alertCount] = useState(23);
  const [currentStory, setCurrentStory] = useState(0);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [autoRotationEnabled, setAutoRotationEnabled] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // ========== DATA ==========
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

  // ========== EFFECTS ==========
  // Simulate live reader count updates
  useEffect(() => {
    const interval = setInterval(() => {
      setReaderCount(prev => prev + Math.floor(Math.random() * 7) - 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-rotation for cards (every 4 seconds)
  useEffect(() => {
    if (!autoRotationEnabled) return;
    
    const interval = setInterval(() => {
      setCurrentCardIndex(prev => (prev + 1) % 2);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [autoRotationEnabled]);

  // ========== FUNCTIONS ==========
  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Goood morning!';
    if (hour >= 12 && hour < 18) return 'Goood afternoon!';
    return 'Goood evening!';
  };

  // Manual card switch - stops auto-rotation
  const switchCard = (index) => {
    setAutoRotationEnabled(false);
    setCurrentCardIndex(index);
  };

  // Touch handlers for swipe functionality
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe && currentCardIndex < 1) {
      switchCard(currentCardIndex + 1);
    }
    
    if (isRightSwipe && currentCardIndex > 0) {
      switchCard(currentCardIndex - 1);
    }
    
    // Reset
    setTouchStart(0);
    setTouchEnd(0);
  };

  // ========== RENDER ==========
  return (
    <>
      {/* ========== ANIMATIONS & STYLES ========== */}
      <style>{`
        /* Pulse animation for live indicator and urgent items */
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Marquee animation (unused but available) */
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }

        /* Hide scrollbar */
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /* Floating animation for background blurs */
        @keyframes float-soft {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(30px, -30px); }
          66% { transform: translate(-30px, 30px); }
        }

        /* Ultra-smooth continuous blue blur traveling animation */
        @keyframes travel-multi-row {
          /* Start position - before first word */
          0% {
            left: -100px;
            top: 0;
            opacity: 0;
          }
          
          /* Fade in as it enters */
          2% {
            opacity: 1;
          }
          
          /* Travel across first row */
          0%, 35% {
            top: 0;
          }
          
          /* Transition to second row */
          35%, 70% {
            top: 43px;
          }
          
          /* Transition to third row */
          70%, 95% {
            top: 86px;
          }
          
          /* Fade out before loop */
          98% {
            opacity: 1;
          }
          
          /* End position - after last word */
          100% {
            left: calc(100% + 100px);
            opacity: 0;
          }
        }
      `}</style>
      
      {/* ========== BACKGROUND BLUR EFFECTS ========== */}
      {/* Red/Pink blur - top right */}
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

      {/* Blue blur - middle left */}
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

      {/* Purple blur - bottom right */}
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

      {/* ========== MAIN CONTENT CONTAINER ========== */}
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
          
          {/* ========== GREETING SECTION ========== */}
          <div style={{ marginBottom: '30px', marginTop: '20px' }}>
            {/* Time-based greeting with gradient */}
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

            {/* Main headline with ultra-smooth blue blur animation */}
            <div style={{ position: 'relative', marginBottom: '8px', overflow: 'visible' }}>
              {/* Traveling blue blur spotlight */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100px',
                height: '48px',
                background: 'radial-gradient(ellipse 100px 48px at center, rgba(59, 130, 246, 0.4), rgba(59, 130, 246, 0.2) 50%, transparent 75%)',
                filter: 'blur(12px)',
                pointerEvents: 'none',
                zIndex: 3,
                animation: 'travel-multi-row 10s linear infinite'
              }}></div>

              {/* Headline text */}
              <h1 style={{ 
                fontSize: '36px', 
                fontWeight: '800', 
                lineHeight: '1.2', 
                color: '#111827', 
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)', 
                position: 'relative', 
                zIndex: 2 
              }}>
                {stories[currentStory].title}
              </h1>
            </div>
          </div>

          {/* ========== TODAY'S BRIEFING HEADER ========== */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#000000' }}>
                Today's Briefing
              </h3>
              {/* Live indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ 
                  width: '6px', 
                  height: '6px', 
                  background: '#10B981', 
                  borderRadius: '50%', 
                  animation: 'pulse 2s infinite' 
                }}></div>
                <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>Live</span>
              </div>
            </div>
          </div>

          {/* ========== SWIPEABLE CAROUSEL CONTAINER ========== */}
          <div style={{ 
            position: 'relative', 
            width: '100%', 
            overflow: 'hidden', 
            marginBottom: '12px', 
            borderRadius: '20px' 
          }}>
            {/* Flex container for cards */}
            <div 
              style={{ 
                display: 'flex', 
                transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                transform: `translateX(-${currentCardIndex * 100}%)`,
                touchAction: 'pan-x',
                willChange: 'transform',
                cursor: 'pointer'
              }}
              onClick={() => switchCard((currentCardIndex + 1) % 2)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              
              {/* ========== CARD 1: WHAT'S HAPPENING ========== */}
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(13px)',
                WebkitBackdropFilter: 'blur(13px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '20px',
                padding: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1), inset 0 0 22px 11px rgba(255, 255, 255, 0.11)',
                position: 'relative',
                overflow: 'hidden',
                minWidth: '100%',
                width: '100%',
                flexShrink: 0,
                boxSizing: 'border-box',
                margin: 0
              }}>
                {/* Card title */}
                <div style={{ 
                  fontSize: '10px', 
                  fontWeight: '700', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1px', 
                  color: '#000000', 
                  marginBottom: '12px' 
                }}>
                  WHAT'S HAPPENING
                </div>

                {/* News items with colored dots */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {whatsHappening.map((item, i) => (
                    <div key={i} style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '10px', 
                      paddingLeft: '4px' 
                    }}>
                      {/* Colored dot indicator */}
                      <div style={{ 
                        width: '5px', 
                        height: '5px', 
                        background: item.color, 
                        borderRadius: '50%', 
                        marginTop: '7px', 
                        flexShrink: 0, 
                        animation: item.urgent ? 'pulse 2s infinite' : 'none' 
                      }}></div>
                      {/* News text */}
                      <span style={{ 
                        fontSize: '13px', 
                        fontWeight: 500, 
                        lineHeight: '1.5', 
                        color: '#000000' 
                      }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ========== CARD 2: TODAY IN HISTORY ========== */}
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(13px)',
                WebkitBackdropFilter: 'blur(13px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '20px',
                padding: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1), inset 0 0 22px 11px rgba(255, 255, 255, 0.11)',
                position: 'relative',
                overflow: 'hidden',
                minWidth: '100%',
                width: '100%',
                flexShrink: 0,
                boxSizing: 'border-box',
                margin: 0
              }}>
                {/* Card title */}
                <div style={{ 
                  fontSize: '10px', 
                  fontWeight: '700', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1px', 
                  color: '#000000', 
                  marginBottom: '12px' 
                }}>
                  TODAY IN HISTORY
                </div>

                {/* Historical events with year labels */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {historicalEvents.slice(0, 3).map((event, i) => (
                    <div key={i} style={{ 
                      display: 'flex', 
                      gap: '12px', 
                      paddingLeft: '4px' 
                    }}>
                      {/* Year in purple */}
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: '700', 
                        color: '#A855F7', 
                        minWidth: '45px', 
                        flexShrink: 0 
                      }}>
                        {event.year}
                      </span>
                      {/* Event description */}
                      <span style={{ 
                        fontSize: '13px', 
                        fontWeight: 500, 
                        lineHeight: '1.5', 
                        color: '#000000' 
                      }}>
                        {event.event}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ========== CARD INDICATORS (DOTS) ========== */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '8px', 
            marginBottom: '30px' 
          }}>
            {[0, 1].map((index) => (
              <div
                key={index}
                onClick={() => switchCard(index)}
                style={{
                  width: currentCardIndex === index ? '20px' : '6px',
                  height: '6px',
                  borderRadius: currentCardIndex === index ? '3px' : '50%',
                  background: currentCardIndex === index ? 'rgba(59, 130, 246, 0.8)' : 'rgba(255, 255, 255, 0.3)',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>

          {/* ========== SCROLL HINT ========== */}
          <div style={{ 
            textAlign: 'center', 
            fontSize: '10px', 
            opacity: 0.5, 
            marginBottom: '16px' 
          }}>
            SCROLL TO CONTINUE ↓
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * ============================================================================
 * DESIGN SPECIFICATIONS
 * ============================================================================
 * 
 * COLORS:
 * - Greeting Gradient: #3B82F6 → #A855F7
 * - Headline Text: #111827
 * - Live Indicator: #10B981
 * - Urgent News Dot: #EF4444 (red)
 * - Positive News Dot: #10B981 (green)
 * - Info News Dot: #3B82F6 (blue)
 * - History Year: #A855F7 (purple)
 * - Glass Background: rgba(255, 255, 255, 0.12)
 * - Glass Border: rgba(255, 255, 255, 0.3)
 * 
 * ANIMATIONS:
 * - Blue Blur Travel: 10s linear infinite
 * - Background Float: 25s-35s ease-in-out
 * - Pulse: 2s infinite
 * - Card Auto-Rotate: 4s interval
 * - Card Transition: 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)
 * 
 * GLASSMORPHISM:
 * - Backdrop Blur: 13px
 * - Border: 1px solid rgba(255, 255, 255, 0.3)
 * - Border Radius: 20px
 * - Multiple inset shadows for depth
 * 
 * TOUCH INTERACTIONS:
 * - Swipe Left: Next card (min 50px distance)
 * - Swipe Right: Previous card (min 50px distance)
 * - Tap: Toggle between cards
 * - Dot Tap: Jump to specific card
 * 
 * TYPOGRAPHY:
 * - Greeting: 28px, weight 700
 * - Headline: 36px, weight 800
 * - Section Title: 18px, weight 700
 * - Card Title: 10px, weight 700, uppercase
 * - News Text: 13px, weight 500
 * - Year Label: 11px, weight 700
 * 
 * ============================================================================
 */
