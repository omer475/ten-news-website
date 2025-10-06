import { useState, useEffect, useRef } from 'react';

export default function NewFirstPage({ onContinue }) {
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [currentCard, setCurrentCard] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const categoryScrollRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Categories with light, subtle colors and icons
  const categories = [
    { name: 'All', color: '#6366F1', bgColor: '#EEF2FF', icon: '⊞', hasNew: false },
    { name: 'Politics', color: '#DC2626', bgColor: '#FEF2F2', icon: '⚖', hasNew: true },
    { name: 'Technology', color: '#3B82F6', bgColor: '#EFF6FF', icon: '◈', hasNew: false },
    { name: 'Business', color: '#059669', bgColor: '#ECFDF5', icon: '◉', hasNew: false },
    { name: 'Science', color: '#8B5CF6', bgColor: '#F5F3FF', icon: '◎', hasNew: true },
    { name: 'Health', color: '#EC4899', bgColor: '#FDF2F8', icon: '✚', hasNew: false },
    { name: 'Sports', color: '#F97316', bgColor: '#FFF7ED', icon: '◐', hasNew: false },
    { name: 'Entertainment', color: '#EAB308', bgColor: '#FEFCE8', icon: '◆', hasNew: false },
    { name: 'World', color: '#06B6D4', bgColor: '#F0FDFA', icon: '◍', hasNew: false }
  ];

  // ============================================================
  // DATA CONFIGURATION
  // ============================================================
  
  const whatsHappening = [
    { 
      text: 'NATO-Russia tensions escalate in Eastern Europe', 
      category: 'Politics',
      source: 'Reuters',
      important: true
    },
    { 
      text: 'Global markets surge 3% on trade deal optimism', 
      category: 'Business',
      source: 'Bloomberg',
      important: false
    },
    { 
      text: 'Tech giants announce joint AI safety initiative', 
      category: 'Technology',
      source: 'TechCrunch',
      important: false
    },
  ];

  const historicalEvents = [
    { year: '1789', event: 'U.S. Constitution ratified by required states', source: 'History.com' },
    { year: '1957', event: 'Sputnik 1 launched, starting Space Age', source: 'NASA Archives' },
    { year: '1991', event: 'World Wide Web made publicly available', source: 'CERN' },
  ];

  // ============================================================
  // EFFECTS
  // ============================================================
  
  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle scroll for back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ============================================================
  // FUNCTIONS
  // ============================================================
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCardScroll = (e) => {
    const container = e.target;
    const scrollPosition = container.scrollLeft;
    const cardWidth = container.offsetWidth;
    const newIndex = Math.round(scrollPosition / cardWidth);
    setCurrentCard(newIndex);
  };

  const scrollToCard = (index) => {
    if (scrollContainerRef.current) {
      const cardWidth = scrollContainerRef.current.offsetWidth;
      scrollContainerRef.current.scrollTo({
        left: cardWidth * index,
        behavior: 'smooth'
      });
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        @keyframes fadeIn {
          from { 
            opacity: 0; 
            transform: translateY(20px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }

        .fade-in {
          animation: fadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translateY(30px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }

        .slide-up {
          animation: slideUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes slideArrow {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }

        .touch-feedback:active {
          transform: scale(0.98);
        }

        @media (max-width: 480px) {
          .mobile-compact {
            padding: 12px !important;
          }
          .headline-mobile {
            font-size: 28px !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
          }
        }

        :focus-visible {
          outline: 2px solid #3B82F6;
          outline-offset: 2px;
        }
      `}</style>
      
      {/* Main Container */}
      <div style={{
        minHeight: '100vh',
        background: '#FFFFFF',
        color: '#000000',
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Category Navigation with Shadow on Scroll - TRUE Full Width */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          paddingTop: '16px',
          paddingBottom: '16px',
          paddingLeft: '20px',
          paddingRight: '20px',
          boxShadow: showBackToTop ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
          transition: 'box-shadow 0.3s ease',
          width: '100%'
        }}>
          <div 
            ref={categoryScrollRef}
            className="scrollbar-hide"
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '2px'
            }}
            role="tablist"
            aria-label="News categories"
          >
              {categories.map((category) => {
                const isSelected = selectedCategory === category.name;
                return (
                  <button
                    key={category.name}
                    onClick={() => setSelectedCategory(category.name)}
                    role="tab"
                    aria-selected={isSelected}
                    aria-label={`${category.name} category`}
                    style={{
                      padding: '8px 14px',
                      background: isSelected ? category.bgColor : 'transparent',
                      border: isSelected ? 'none' : '1px solid #E5E7EB',
                      borderRadius: '8px',
                      color: isSelected ? category.color : '#6B7280',
                      fontSize: '13px',
                      fontWeight: isSelected ? '500' : '400',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      letterSpacing: '-0.01em',
                      outline: 'none',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#F9FAFB';
                        e.currentTarget.style.borderColor = '#D1D5DB';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = '#E5E7EB';
                      }
                    }}
                  >
                    <span style={{ fontSize: '14px', opacity: 0.7 }}>{category.icon}</span>
                    {category.name}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Main Content */}
        <main style={{
          maxWidth: '680px',
          margin: '0 auto',
          padding: '16px 20px 20px 20px',
          flex: 1,
          overflowY: 'auto',
          width: '100%'
        }}
        className="mobile-compact scrollbar-hide">
          {/* Greeting Section */}
          <div style={{ marginBottom: '16px' }} className="fade-in">
            <h2 style={{
              fontSize: '22px',
              fontWeight: '600',
              marginBottom: '16px',
              letterSpacing: '-0.02em',
              lineHeight: '1.2',
              color: '#111827'
            }}>
              {getGreeting()}
            </h2>

            {/* Main Headline */}
            <div style={{
              marginBottom: '24px',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '0',
                left: '0',
                width: '4px',
                height: '100%',
                background: 'linear-gradient(to bottom, #DC2626 0%, #FCA5A5 100%)',
                borderRadius: '2px'
              }}></div>
              
              <h1 className="slide-up headline-mobile" style={{
                fontSize: 'clamp(28px, 5.5vw, 48px)',
                fontWeight: '800',
                lineHeight: '1.1',
                letterSpacing: '-0.04em',
                position: 'relative',
                zIndex: 1,
                paddingLeft: '16px',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}>
                <span style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #991B1B 0%, #DC2626 50%, #EF4444 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontSize: '1.1em'
                }}>Critical NATO-Russia tensions</span>
                {' '}
                <span style={{ 
                  color: '#374151', 
                  fontWeight: '400',
                  fontSize: '0.75em',
                  display: 'inline-block',
                  opacity: 0.9
                }}>
                  dominate today's headlines
                </span>
              </h1>
            </div>
          </div>

          {/* Today's Briefing with Swipeable Cards */}
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '12px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: '#6B7280'
            }}>
              Today's Briefing
            </h3>

            {/* Swipeable Container */}
            <div style={{
              position: 'relative',
              width: '100%',
              overflow: 'hidden',
              borderRadius: '16px'
            }}>
              <div 
                ref={scrollContainerRef}
                style={{
                  display: 'flex',
                  gap: '16px',
                  overflowX: 'auto',
                  scrollSnapType: 'x mandatory',
                  scrollBehavior: 'smooth',
                  paddingBottom: '4px',
                  WebkitOverflowScrolling: 'touch'
                }}
                className="scrollbar-hide"
                onScroll={handleCardScroll}
              >
                {/* Breaking Updates Card */}
                <div 
                  className="touch-feedback"
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    border: '1px solid rgba(0, 0, 0, 0.04)',
                    minWidth: '100%',
                    scrollSnapAlign: 'start',
                    transition: 'all 0.3s ease',
                    height: 'fit-content'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        background: '#EF4444',
                        borderRadius: '50%',
                        boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.1)'
                      }}></div>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        letterSpacing: '0.05em',
                        color: '#111827'
                      }}>
                        BREAKING NEWS
                      </span>
                    </div>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px'
                  }}>
                    {whatsHappening.map((item, i) => (
                      <div key={i} style={{
                        paddingBottom: i < whatsHappening.length - 1 ? '12px' : '0',
                        borderBottom: i < whatsHappening.length - 1 ? '1px solid #F3F4F6' : 'none'
                      }}>
                        <p style={{
                          fontSize: '14px',
                          lineHeight: '1.6',
                          color: '#374151',
                          margin: '0 0 6px 0'
                        }}>
                          {item.text}
                          {item.important && (
                            <span style={{
                              marginLeft: '8px',
                              fontSize: '11px',
                              padding: '2px 6px',
                              background: '#FEF2F2',
                              color: '#DC2626',
                              borderRadius: '4px',
                              fontWeight: '600'
                            }}>
                              IMPORTANT
                            </span>
                          )}
                        </p>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: categories.find(c => c.name === item.category)?.bgColor || '#F3F4F6',
                            color: categories.find(c => c.name === item.category)?.color || '#6B7280',
                            fontWeight: '500'
                          }}>
                            {item.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Historical Events Card */}
                <div 
                  className="touch-feedback"
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    border: '1px solid rgba(0, 0, 0, 0.04)',
                    minWidth: '100%',
                    scrollSnapAlign: 'start',
                    transition: 'all 0.3s ease',
                    height: 'fit-content',
                    alignSelf: 'flex-start'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        background: '#10B981',
                        borderRadius: '50%',
                        boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.1)'
                      }}></div>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        letterSpacing: '0.05em',
                        color: '#111827'
                      }}>
                        TODAY IN HISTORY
                      </span>
                    </div>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px'
                  }}>
                    {historicalEvents.map((event, i) => (
                      <div key={i} style={{
                        paddingBottom: i < historicalEvents.length - 1 ? '12px' : '0',
                        borderBottom: i < historicalEvents.length - 1 ? '1px solid #F3F4F6' : 'none'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px'
                        }}>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#10B981',
                            background: '#ECFDF5',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            minWidth: 'fit-content'
                          }}>
                            {event.year}
                          </span>
                          <div style={{ flex: 1 }}>
                            <p style={{
                              fontSize: '14px',
                              lineHeight: '1.6',
                              color: '#374151',
                              margin: '0'
                            }}>
                              {event.event}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Enhanced Swipe Indicators */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '6px',
                marginTop: '16px'
              }}>
                {[0, 1].map((index) => (
                  <button
                    key={index}
                    onClick={() => scrollToCard(index)}
                    aria-label={`Go to card ${index + 1}`}
                    style={{
                      width: currentCard === index ? '24px' : '6px',
                      height: '6px',
                      borderRadius: '3px',
                      background: currentCard === index ? '#374151' : '#E5E7EB',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      padding: 0
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Back to Top Button */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            aria-label="Back to top"
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              transition: 'all 0.3s ease',
              zIndex: 30
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }}
          >
            ↑
          </button>
        )}
      </div>
    </>
  );
}
