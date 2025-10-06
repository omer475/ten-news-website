import { useState, useEffect, useRef } from 'react';

export default function NewFirstPage({ onContinue }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedCard, setExpandedCard] = useState(null);
  const categoryScrollRef = useRef(null);

  // Categories with light, subtle colors inspired by modern platforms
  const categories = [
    { name: 'All', color: '#6366F1', bgColor: '#EEF2FF' },
    { name: 'Politics', color: '#DC2626', bgColor: '#FEF2F2' },
    { name: 'Technology', color: '#3B82F6', bgColor: '#EFF6FF' },
    { name: 'Business', color: '#059669', bgColor: '#ECFDF5' },
    { name: 'Science', color: '#8B5CF6', bgColor: '#F5F3FF' },
    { name: 'Health', color: '#EC4899', bgColor: '#FDF2F8' },
    { name: 'Sports', color: '#F97316', bgColor: '#FFF7ED' },
    { name: 'Entertainment', color: '#EAB308', bgColor: '#FEFCE8' },
    { name: 'World', color: '#06B6D4', bgColor: '#F0FDFA' }
  ];

  const whatsHappening = [
    { 
      text: 'NATO-Russia tensions escalate in Eastern Europe', 
      category: 'Politics'
    },
    { 
      text: 'Global markets surge 3% on trade deal optimism', 
      category: 'Business'
    },
    { 
      text: 'Tech giants announce joint AI safety initiative', 
      category: 'Technology'
    },
  ];

  const historicalEvents = [
    { year: '1789', event: 'U.S. Constitution ratified by required states' },
    { year: '1957', event: 'Sputnik 1 launched, starting Space Age' },
    { year: '1991', event: 'World Wide Web made publicly available' },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
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

        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .gradient-text {
          background: linear-gradient(135deg, #667EEA 0%, #764BA2 25%, #F093FB 50%, #667EEA 75%, #764BA2 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 8s ease infinite;
        }

        @media (max-width: 768px) {
          .mobile-stack {
            flex-direction: column !important;
          }
        }
      `}</style>
      
      {/* Main Container */}
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #FAFAFA 0%, #F3F4F6 100%)',
        color: '#000000'
      }}>
        {/* Category Navigation */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          padding: '16px 0'
        }}>
          <div style={{
            maxWidth: '680px',
            margin: '0 auto',
            padding: '0 24px'
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
            >
              {categories.map((category) => {
                const isSelected = selectedCategory === category.name;
                return (
                  <button
                    key={category.name}
                    onClick={() => setSelectedCategory(category.name)}
                    style={{
                      padding: '8px 16px',
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
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#F9FAFB';
                        e.currentTarget.style.borderColor = '#D1D5DB';
                        e.currentTarget.style.color = '#374151';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = '#E5E7EB';
                        e.currentTarget.style.color = '#6B7280';
                      }
                    }}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main style={{
          maxWidth: '680px',
          margin: '0 auto',
          padding: '24px'
        }}>
          {/* Greeting Section */}
          <div style={{ marginBottom: '32px' }} className="fade-in">
            <h2 style={{
              fontSize: '24px',
              fontWeight: '500',
              marginBottom: '32px',
              letterSpacing: '-0.02em',
              lineHeight: '1.2',
              background: 'linear-gradient(to right, #3B82F6 0%, #93C5FD 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {getGreeting()}
            </h2>

            {/* Main Headline - Visual Treatment */}
            <div style={{
              marginBottom: '48px',
              position: 'relative'
            }}>
              <h1 className="slide-up" style={{
                fontSize: 'clamp(32px, 6vw, 48px)',
                fontWeight: '700',
                lineHeight: '1.15',
                letterSpacing: '-0.04em',
                position: 'relative',
                zIndex: 1,
                color: '#111827'
              }}>
                <span style={{
                  background: 'linear-gradient(to right, #DC2626 0%, #EF4444 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>Critical NATO-Russia tensions</span>
                {' '}
                <span style={{ color: '#6B7280', fontWeight: '500' }}>
                  dominate today's headlines
                </span>
              </h1>
            </div>
          </div>

          {/* Today's Briefing - Mobile Optimized with Swipeable Cards */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              marginBottom: '20px',
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
              >
                {/* Breaking Updates Card */}
                <div 
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    border: '1px solid rgba(0, 0, 0, 0.04)',
                    minWidth: '100%',
                    scrollSnapAlign: 'start',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '20px'
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

                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px'
                  }}>
                    {whatsHappening.map((item, i) => (
                      <div key={i} style={{
                        paddingBottom: '12px',
                        borderBottom: i < whatsHappening.length - 1 ? '1px solid #F3F4F6' : 'none'
                      }}>
                        <p style={{
                          fontSize: '14px',
                          lineHeight: '1.6',
                          color: '#374151',
                          margin: '0 0 6px 0'
                        }}>
                          {item.text}
                        </p>
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
                    ))}
                  </div>
                </div>

                {/* Historical Events Card */}
                <div 
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    border: '1px solid rgba(0, 0, 0, 0.04)',
                    minWidth: '100%',
                    scrollSnapAlign: 'start',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '20px'
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

                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px'
                  }}>
                    {historicalEvents.map((event, i) => (
                      <div key={i} style={{
                        paddingBottom: '12px',
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
                          <p style={{
                            fontSize: '14px',
                            lineHeight: '1.6',
                            color: '#374151',
                            margin: 0,
                            flex: 1
                          }}>
                            {event.event}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Swipe Indicator Dots */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '6px',
                marginTop: '16px'
              }}>
                <div style={{
                  width: '24px',
                  height: '4px',
                  borderRadius: '2px',
                  background: '#374151',
                  transition: 'all 0.3s'
                }}></div>
                <div style={{
                  width: '6px',
                  height: '4px',
                  borderRadius: '2px',
                  background: '#E5E7EB',
                  transition: 'all 0.3s'
                }}></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
