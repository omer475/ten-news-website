import { useState, useEffect, useRef } from 'react';

export default function NewFirstPage({ onContinue }) {
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  const [readerCount, setReaderCount] = useState(2347);
  const [alertCount] = useState(23);
  const [currentStory, setCurrentStory] = useState(0);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [autoRotationEnabled, setAutoRotationEnabled] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [wordPositions, setWordPositions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const headlineRef = useRef(null);
  const categoryScrollRef = useRef(null);

  // Categories data with specific colors
  const categories = [
    { name: 'All', color: '#6366F1' },
    { name: 'Politics', color: '#DC2626' },
    { name: 'Technology', color: '#3B82F6' },
    { name: 'Business', color: '#059669' },
    { name: 'Science', color: '#8B5CF6' },
    { name: 'Health', color: '#EC4899' },
    { name: 'Sports', color: '#F97316' },
    { name: 'Entertainment', color: '#EAB308' },
    { name: 'World', color: '#06B6D4' }
  ];

  // ============================================================
  // LIVE READER COUNT SIMULATION
  // ============================================================
  useEffect(() => {
    const interval = setInterval(() => {
      setReaderCount(prev => prev + Math.floor(Math.random() * 7) - 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ============================================================
  // DATA CONFIGURATION
  // ============================================================
  
  // Story headlines (can be dynamically loaded)
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

  // What's Happening card data
  const whatsHappening = [
    { 
      text: 'NATO-Russia tensions escalate in Eastern Europe', 
      color: '#EF4444',
      urgent: true 
    },
    { 
      text: 'Global markets surge 3% on trade deal optimism', 
      color: '#10B981',
      urgent: false 
    },
    { 
      text: 'Tech giants announce joint AI safety initiative', 
      color: '#3B82F6',
      urgent: false 
    },
  ];

  // Today in History card data
  const historicalEvents = [
    { year: '1789', event: 'U.S. Constitution ratified by required states' },
    { year: '1957', event: 'Sputnik 1 launched, starting Space Age' },
    { year: '1991', event: 'World Wide Web made publicly available' },
  ];

  // ============================================================
  // CALCULATE WORD POSITIONS FOR BLUR ANIMATION
  // ============================================================
  useEffect(() => {
    if (!headlineRef.current) return;

    const calculatePositions = () => {
      const spans = headlineRef.current.querySelectorAll('.word-span');
      const positions = [];
      let currentRow = 0;
      let lastTop = null;

      spans.forEach((span, index) => {
        const rect = span.getBoundingClientRect();
        const parentRect = headlineRef.current.getBoundingClientRect();
        
        const relativeTop = rect.top - parentRect.top;
        const relativeLeft = rect.left - parentRect.left;
        
        // Detect new row
        if (lastTop !== null && Math.abs(relativeTop - lastTop) > 10) {
          currentRow++;
        }
        lastTop = relativeTop;

        positions.push({
          left: relativeLeft,
          top: relativeTop,
          width: rect.width,
          height: rect.height,
          row: currentRow,
          index: index
        });
      });

      setWordPositions(positions);
    };

    // Calculate on mount and resize
    calculatePositions();
    window.addEventListener('resize', calculatePositions);
    
    // Small delay to ensure fonts are loaded
    setTimeout(calculatePositions, 100);

    return () => window.removeEventListener('resize', calculatePositions);
  }, [currentStory]);

  // ============================================================
  // GREETING LOGIC (Time-based)
  // ============================================================
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Goood morning!';
    if (hour >= 12 && hour < 18) return 'Goood afternoon!';
    return 'Goood evening!';
  };

  // ============================================================
  // CAROUSEL AUTO-ROTATION (Every 4 seconds)
  // ============================================================
  useEffect(() => {
    if (!autoRotationEnabled) return;
    
    const interval = setInterval(() => {
      setCurrentCardIndex(prev => (prev + 1) % 2);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [autoRotationEnabled]);

  // ============================================================
  // MANUAL CARD SWITCHING (Stops auto-rotation)
  // ============================================================
  const switchCard = (index) => {
    setAutoRotationEnabled(false);
    setCurrentCardIndex(index);
  };

  // ============================================================
  // TOUCH SWIPE HANDLERS (Left/Right swipe detection)
  // ============================================================
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
    
    setTouchStart(0);
    setTouchEnd(0);
  };

  // ============================================================
  // GENERATE KEYFRAMES BASED ON WORD POSITIONS
  // ============================================================
  const generateKeyframes = () => {
    if (wordPositions.length === 0) return '';

    let keyframes = '@keyframes travel-headline-dynamic {\n';
    
    // Group words by row
    const rowGroups = {};
    wordPositions.forEach(pos => {
      if (!rowGroups[pos.row]) rowGroups[pos.row] = [];
      rowGroups[pos.row].push(pos);
    });
    
    const rows = Object.keys(rowGroups).map(Number).sort((a, b) => a - b);
    const totalRows = rows.length;
    const percentPerRow = 100 / totalRows;
    
    rows.forEach((rowNum, rowIndex) => {
      const wordsInRow = rowGroups[rowNum];
      const startPercent = rowIndex * percentPerRow;
      const endPercent = (rowIndex + 1) * percentPerRow;
      const rowDuration = endPercent - startPercent;
      
      wordsInRow.forEach((pos, wordIndex) => {
        const wordProgress = (wordIndex / wordsInRow.length) * rowDuration;
        const percent = startPercent + wordProgress;
        
        keyframes += `  ${percent.toFixed(2)}% {\n`;
        keyframes += `    left: ${pos.left + pos.width/2}px;\n`;
        keyframes += `    top: ${pos.top + pos.height/2}px;\n`;
        keyframes += `    opacity: 1;\n`;
        keyframes += `  }\n`;
      });
      
      // At end of row (except last row), disappear
      if (rowIndex < totalRows - 1) {
        const lastWord = wordsInRow[wordsInRow.length - 1];
        keyframes += `  ${(endPercent - 0.1).toFixed(2)}% {\n`;
        keyframes += `    left: ${lastWord.left + lastWord.width}px;\n`;
        keyframes += `    top: ${lastWord.top + lastWord.height/2}px;\n`;
        keyframes += `    opacity: 1;\n`;
        keyframes += `  }\n`;
        
        keyframes += `  ${endPercent.toFixed(2)}% {\n`;
        keyframes += `    left: ${lastWord.left + lastWord.width}px;\n`;
        keyframes += `    top: ${lastWord.top + lastWord.height/2}px;\n`;
        keyframes += `    opacity: 0;\n`;
        keyframes += `  }\n`;
        
        // At start of next row, appear
        const nextRowWords = rowGroups[rows[rowIndex + 1]];
        const firstNextWord = nextRowWords[0];
        keyframes += `  ${(endPercent + 0.1).toFixed(2)}% {\n`;
        keyframes += `    left: ${firstNextWord.left}px;\n`;
        keyframes += `    top: ${firstNextWord.top + firstNextWord.height/2}px;\n`;
        keyframes += `    opacity: 1;\n`;
        keyframes += `  }\n`;
      }
    });
    
    // Final position - disappear
    keyframes += `  100% {\n`;
    const lastPos = wordPositions[wordPositions.length - 1];
    keyframes += `    left: ${lastPos.left + lastPos.width}px;\n`;
    keyframes += `    top: ${lastPos.top + lastPos.height/2}px;\n`;
    keyframes += `    opacity: 0;\n`;
    keyframes += `  }\n`;
    keyframes += '}';
    
    return keyframes;
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
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

        ${generateKeyframes()}
      `}</style>
      
      {/* Background blur effects */}
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

      {/* Main content */}
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
          padding: '0 20px 32px',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          
          {/* CATEGORY BAR */}
          <div 
            ref={categoryScrollRef}
            style={{ 
              display: 'flex', 
              gap: '8px', 
              overflowX: 'auto', 
              paddingBottom: '4px',
              marginBottom: '20px',
              marginTop: '12px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
            className="scrollbar-hide"
          >
            {categories.map((category) => {
              const isSelected = selectedCategory === category.name;
              return (
                <button
                  key={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    background: isSelected 
                      ? category.color
                      : '#E5E7EB',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: isSelected ? '#FFFFFF' : '#6B7280',
                    fontSize: '13px',
                    fontWeight: isSelected ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxShadow: isSelected 
                      ? `0 2px 8px ${category.color}40`
                      : 'none'
                  }}
                >
                  {category.name}
                </button>
              );
            })}
          </div>

          <div style={{ marginBottom: '30px' }}>
            
            <h2 style={{
              fontSize: '28px',
              fontWeight: '700',
              marginBottom: '16px',
              marginTop: '8px',
              background: 'linear-gradient(to right, #3B82F6, #60A5FA)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {getGreeting()}
            </h2>

            {/* Headline with dynamic blur */}
            <div ref={headlineRef} style={{ position: 'relative', marginBottom: '8px', overflow: 'visible' }}>
              
              {/* Traveling blur based on calculated positions */}
              {wordPositions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  width: '120px',
                  height: '50px',
                  background: 'radial-gradient(ellipse 120px 50px at center, rgba(59, 130, 246, 0.5), rgba(59, 130, 246, 0.3) 50%, transparent 75%)',
                  filter: 'blur(15px)',
                  pointerEvents: 'none',
                  zIndex: 3,
                  animation: 'travel-headline-dynamic 4.8s linear infinite',
                  transform: 'translate(-50%, -50%)'
                }}></div>
              )}

              {/* Headline text with word tracking */}
              <h1 style={{ 
                fontSize: '36px', 
                fontWeight: '800', 
                lineHeight: '1.2', 
                color: '#111827', 
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)', 
                position: 'relative', 
                zIndex: 2
              }}>
                {stories[currentStory].title.split(' ').map((word, index) => (
                  <span key={index} className="word-span" style={{ display: 'inline-block', marginRight: '0.3em' }}>
                    {word}
                  </span>
                ))}
              </h1>
            </div>
          </div>

          {/* Today's Briefing */}
          <div style={{ 
            marginBottom: '20px'
          }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '700', 
              color: '#111827',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Today's Briefing
            </h3>
          </div>

          {/* Carousel */}
          <div style={{ 
            position: 'relative', 
            width: '100%', 
            overflow: 'hidden', 
            marginBottom: '12px', 
            borderRadius: '20px'
          }}>
            
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
              
              {/* Card 1: What's Happening */}
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
                <div style={{ 
                  fontSize: '10px', 
                  fontWeight: '700', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1px', 
                  color: '#F97316', 
                  marginBottom: '12px' 
                }}>
                  WHAT'S HAPPENING
                </div>

                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px' 
                }}>
                  {whatsHappening.map((item, i) => (
                    <div key={i} style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '10px', 
                      paddingLeft: '4px' 
                    }}>
                      <div style={{ 
                        width: '5px', 
                        height: '5px', 
                        background: '#F97316', 
                        borderRadius: '50%', 
                        marginTop: '7px', 
                        flexShrink: 0, 
                        animation: item.urgent ? 'pulse 2s infinite' : 'none' 
                      }}></div>
                      
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

              {/* Card 2: Today in History */}
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
                <div style={{ 
                  fontSize: '10px', 
                  fontWeight: '700', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1px', 
                  color: '#10B981', 
                  marginBottom: '12px' 
                }}>
                  TODAY IN HISTORY
                </div>

                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px' 
                }}>
                  {historicalEvents.slice(0, 3).map((event, i) => (
                    <div key={i} style={{ 
                      display: 'flex', 
                      gap: '12px', 
                      paddingLeft: '4px' 
                    }}>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: '700', 
                        color: '#10B981', 
                        minWidth: '45px', 
                        flexShrink: 0 
                      }}>
                        {event.year}
                      </span>
                      
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

          {/* Card indicators */}
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
                  background: currentCardIndex === index 
                    ? '#000000'
                    : '#D1D5DB',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
