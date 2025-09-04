import { useEffect, useState, useCallback, useRef } from 'react';

export default function Home() {
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false); // Navigation menu state
  
  // Refs to track timeouts and prevent memory leaks
  const transitionTimeoutRef = useRef(null);
  const topicRotationRef = useRef(null);

  useEffect(() => {
    const loadNewsData = async () => {
      try {
        // Try to load today's generated news data
        const today = new Date();
        const dateStr = `${today.getFullYear()}_${(today.getMonth() + 1).toString().padStart(2, '0')}_${today.getDate().toString().padStart(2, '0')}`;
        const dataFilename = `tennews_data_${dateStr}.json`;
        
        let newsData = null;
        
        // Try to fetch today's data
        try {
          const response = await fetch(`/${dataFilename}`);
          if (response.ok) {
            newsData = await response.json();
            console.log('✅ Loaded today\'s generated news data');
          }
        } catch (error) {
          console.log('📰 Using sample data (generated data not found)');
        }
        
        let sampleStories = [];
        
        if (newsData && newsData.articles) {
          // Convert generated data to website format
          sampleStories = [
            {
              type: 'opening',
              date: newsData.displayDate || 'THURSDAY, AUGUST 28, 2025',
              headline: newsData.dailyGreeting || 'Good morning, today brings important global updates',
              readingTime: newsData.readingTime || '3 minute read',
              historicalEvents: newsData.historicalEvents || []
            },
            // Convert articles to news stories
            ...newsData.articles.map((article, index) => ({
              type: 'news',
              number: article.rank || (index + 1),
              category: article.category || 'WORLD NEWS',
              emoji: article.emoji || '📰',
              title: article.title,
              summary: article.summary,
              details: article.details || [],
              source: article.source,
              url: article.url
            })),
            {
              type: 'newsletter',
              content: 'Professional Newsletter Signup'
            }
          ];
        } else {
          // Fallback to sample data
          sampleStories = [
          {
            type: 'opening',
            date: 'THURSDAY, AUGUST 28, 2025',
            headline: 'Typhoon chaos hits Asia\'s coastal millions'
          },
          {
            type: 'news',
            number: 1,
            category: 'WORLD NEWS',
            emoji: '🌀',
            title: 'Typhoon Kajiki: Asia\'s Worst Storm in Decades',
            summary: 'Vietnam evacuates 586,000 people as Category 5 typhoon approaches with unprecedented 180mph winds. China\'s resort city Sanya closes all businesses, halts public transport, and grounds flights. The storm threatens to cause $2.3 billion in damages across 12 provinces, marking the region\'s most severe weather crisis this decade.',
            details: ['Wind speeds: 180mph', 'Economic impact: $2.3B', 'Areas affected: 12 provinces'],
            source: 'Reuters',
            url: 'https://reuters.com/typhoon'
          },
          {
            type: 'news',
            number: 2,
            category: 'WORLD NEWS',
            emoji: '🌾',
            title: 'Brazil Farm Crisis Threatens Global Food Security',
            summary: 'Agricultural bankruptcies surge 138% to 1,272 cases in 2024, devastating Brazil\'s farming sector. Soybean and corn exports plummet 23%, eliminating 45,000 jobs and triggering 8% global price increases. The crisis threatens worldwide food supply chains as Brazil, the world\'s largest agricultural exporter, faces its worst farming collapse in history.',
            details: ['Export drop: 23%', 'Jobs lost: 45,000', 'Global price impact: +8%'],
            source: 'Financial Times',
            url: 'https://reuters.com/brazil'
          },
          {
            type: 'news',
            number: 3,
            category: 'BUSINESS',
            emoji: '☕',
            title: 'Keurig-JDE Merger Creates Coffee Empire',
            summary: 'Keurig Dr Pepper nears $18 billion acquisition of Dutch company JDE Peet\'s, creating the world\'s second-largest coffee conglomerate. The merged entity would control 27% of the global coffee market with combined revenues of $24 billion, operating over 50 premium brands across 100 countries in an unprecedented industry consolidation.',
            details: ['Combined revenue: $24B', 'Brands: 50+', 'Market share: #2 globally'],
            source: 'Bloomberg',
            url: 'https://bloomberg.com/coffee'
          },
          {
            type: 'news',
            number: 4,
            category: 'MARKETS',
            emoji: '📈',
            title: 'S&P 500 Hits 5,800 on AI Rally',
            summary: 'The S&P 500 index surges 2.3% to record-breaking 5,800 points, driven by artificial intelligence stocks. Nvidia leads the tech sector rally with 35% year-to-date gains, pushing market valuations to 22.5 P/E ratio. Investors bet heavily on AI transformation despite concerns about stretched valuations and potential market corrections.',
            details: ['YTD gain: 18%', 'Tech sector: +35%', 'P/E ratio: 22.5'],
            source: 'CNBC',
            url: 'https://cnbc.com/markets'
          },
          {
            type: 'news',
            number: 5,
            category: 'TECH & AI',
            emoji: '🤖',
            title: 'UK\'s Bold AI Democracy Experiment',
            summary: 'Britain considers revolutionary £2 billion deal with OpenAI to provide free ChatGPT Plus access to all 67 million citizens. Minister Peter Kyle champions unprecedented AI democratization initiative, costing £30 per citizen annually. The program includes enhanced privacy safeguards and aims to bridge the digital divide by Q1 2026 launch.',
            details: ['Cost per citizen: £30/year', 'Launch date: Q1 2026', 'Privacy safeguards: Enhanced'],
            source: 'BBC',
            url: 'https://bbc.com/uk-ai'
          },
          {
            type: 'news',
            number: 6,
            category: 'SCIENCE',
            emoji: '🚀',
            title: 'NASA Finds "Second Earth" 40 Light-Years Away',
            summary: 'James Webb telescope detects water vapor and oxygen signatures on exoplanet K2-18b, located 40 light-years from Earth. The planet features Earth-like temperatures between 0-40°C, 21% oxygen atmosphere, and is 1.2 times Earth\'s size. Scientists call this the most promising candidate for extraterrestrial life discovered to date.',
            details: ['Temperature: 0-40°C', 'Atmosphere: 21% oxygen', 'Size: 1.2x Earth'],
            source: 'Nature',
            url: 'https://nasa.gov/exoplanet'
          },
          {
            type: 'news',
            number: 7,
            category: 'HEALTH',
            emoji: '🧬',
            title: 'Cancer Breakthrough: 90% Success Rate',
            summary: 'Revolutionary CAR-T immunotherapy achieves 90% success rate in late-stage cancer trials involving 2,400 patients. The treatment reprograms patients\' immune cells to target tumors, offering hope for previously untreatable cases. FDA approval expected Q4 2025, though the $150,000 price tag raises accessibility concerns for this groundbreaking therapy.',
            details: ['Patients treated: 2,400', 'FDA approval: Expected Q4', 'Cost: $150,000'],
            source: 'Nature Medicine',
            url: 'https://nature.com/cancer'
          },
          {
            type: 'news',
            number: 8,
            category: 'CLIMATE',
            emoji: '🌍',
            title: 'Carbon Capture at 99% Efficiency',
            summary: 'MIT engineers unveil atmospheric carbon removal system achieving unprecedented 99% efficiency, capable of extracting 1 billion tons of CO2 annually. The breakthrough technology costs just $50 per ton while using 40% less energy than existing methods. Commercial deployment scheduled for 2027 could revolutionize global climate change mitigation strategies.',
            details: ['Cost: $50/ton', 'Energy use: -40%', 'Deployment: 2027'],
            source: 'Science',
            url: 'https://science.org/climate'
          },
          {
            type: 'news',
            number: 9,
            category: 'SPORTS',
            emoji: '⚽',
            title: 'Paris Olympics Sets All-Time Attendance Record',
            summary: 'Paris Olympics shatters records with 15 million spectators attending events across innovative urban venues throughout the city. The games generate €4.2 billion in revenue, attract 3.5 billion TV viewers worldwide, and deliver €11 billion economic impact to France, establishing new benchmarks for future Olympic host cities.',
            details: ['Revenue: €4.2B', 'TV viewers: 3.5B', 'Economic impact: €11B'],
            source: 'Olympics.com',
            url: 'https://olympics.com/paris'
          },
          {
            type: 'news',
            number: 10,
            category: 'ENTERTAINMENT',
            emoji: '🎬',
            title: 'Disney\'s $50B Streaming Gambit',
            summary: 'Disney announces unprecedented $50 billion content investment to dominate the streaming wars against Netflix and Amazon. The entertainment giant plans 140 new shows and 60 films, targeting 300 million subscribers by 2027. This aggressive strategy represents the largest entertainment content investment in history, reshaping the global streaming landscape.',
            details: ['New shows: 140', 'Films: 60', 'Subscriber target: 300M'],
            source: 'Variety',
            url: 'https://variety.com/disney'
          },
          {
            type: 'newsletter',
            content: 'Professional Newsletter Signup'
          }
        ];
        
        setStories(sampleStories);
        setLoading(false);
      } catch (err) {
        console.error('Error loading news:', err);
        setLoading(false);
      }
    }

    loadNewsData();
  }, []);

  const goToStory = useCallback((index) => {
    if (index >= 0 && index < stories.length) {
      setCurrentIndex(index);
      setMenuOpen(false);
    }
  }, [stories.length]);

  const nextStory = useCallback(() => goToStory(currentIndex + 1), [currentIndex, goToStory]);
  const prevStory = useCallback(() => goToStory(currentIndex - 1), [currentIndex, goToStory]);

  useEffect(() => {
    let startY = 0;
    let isTransitioning = false;

    const handleTouchStart = (e) => {
      if (!isTransitioning) {
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchEnd = (e) => {
      if (isTransitioning) return;
      
      const endY = e.changedTouches[0].clientY;
      const diff = startY - endY;
      
      if (Math.abs(diff) > 30) {
        isTransitioning = true;
        if (diff > 0) {
          nextStory();
        } else {
          prevStory();
        }
        
        // Clear existing timeout
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }
        
        transitionTimeoutRef.current = setTimeout(() => {
          isTransitioning = false;
        }, 500);
      }
    };

    const handleWheel = (e) => {
      if (isTransitioning) return;
      e.preventDefault();
      
      if (Math.abs(e.deltaY) > 30) {
        isTransitioning = true;
        if (e.deltaY > 0) {
          nextStory();
        } else {
          prevStory();
        }
        
        // Clear existing timeout
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }
        
        transitionTimeoutRef.current = setTimeout(() => {
          isTransitioning = false;
        }, 500);
      }
    };

    const handleKeyDown = (e) => {
      if (isTransitioning) return;
      
      if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        isTransitioning = true;
        nextStory();
        
        // Clear existing timeout
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }
        
        transitionTimeoutRef.current = setTimeout(() => {
          isTransitioning = false;
        }, 500);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        isTransitioning = true;
        prevStory();
        
        // Clear existing timeout
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }
        
        transitionTimeoutRef.current = setTimeout(() => {
          isTransitioning = false;
        }, 500);
      } else if (e.key === 'Escape') {
        // Close menu on escape
        setMenuOpen(false);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
      
      // Clean up timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [nextStory, prevStory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      if (topicRotationRef.current) {
        clearTimeout(topicRotationRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" role="status" aria-label="Loading news content"></div>
        <div className="loading-text">Loading latest news...</div>
      </div>
    );
  }

  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <header className="header" role="banner">
        <div className="logo">
          <span className="logo-ten">TEN</span> NEWS
        </div>
        
        <nav className="header-center" role="navigation" aria-label="Main navigation">
          <span tabIndex="0" role="button" onKeyDown={(e) => e.key === 'Enter' && console.log('Navigate to WORLD')}>WORLD</span>
          <span tabIndex="0" role="button" onKeyDown={(e) => e.key === 'Enter' && console.log('Navigate to BUSINESS')}>BUSINESS</span>
          <span tabIndex="0" role="button" onKeyDown={(e) => e.key === 'Enter' && console.log('Navigate to TECH')}>TECH</span>
          <span tabIndex="0" role="button" onKeyDown={(e) => e.key === 'Enter' && console.log('Navigate to SCIENCE')}>SCIENCE</span>
          <span tabIndex="0" role="button" onKeyDown={(e) => e.key === 'Enter' && console.log('Navigate to SPORTS')}>SPORTS</span>
        </nav>
        
        <div className="header-right">
          <time className="time" dateTime={new Date().toISOString()}>{currentTime}</time>
          <button 
            className="subscribe-btn"
            aria-label="Subscribe to newsletter"
            onClick={() => console.log('Subscribe clicked')}
          >
            SUBSCRIBE
          </button>
        </div>
      </header>

      {/* Stories */}
      <main role="main">
        {stories.map((story, index) => (
          <article
            key={index}
            className="story-container"
            style={{
              transform: `${
                index === currentIndex 
                  ? 'translateY(0) scale(1)' 
                  : index < currentIndex 
                    ? 'translateY(-100%) scale(0.9)' 
                    : 'translateY(100%) scale(0.95)'
              }`,
              opacity: index === currentIndex ? 1 : 0,
              zIndex: index === currentIndex ? 10 : 1,
              pointerEvents: index === currentIndex ? 'auto' : 'none',
            }}
            aria-hidden={index !== currentIndex}
            tabIndex={index === currentIndex ? 0 : -1}
          >
            <div className="story-content">
              {story.type === 'opening' ? (
                <div className="opening-container">
                  <div className="date-header">{story.date}</div>
                  <h1 className="main-headline">
                    {story.headline}
                  </h1>
                  <div className="subheadline">
                    <div style={{ display: 'inline-block' }}>
                      <span style={{ fontWeight: 600, color: '#86868b' }}>On this day: </span>
                      <span className="rotating-topics" style={{ position: 'relative', display: 'inline-block', minWidth: '250px', height: '26px', verticalAlign: 'middle' }}>
                        {(story.historicalEvents || [
                          {year: '1485', description: 'Battle of Bosworth Field ends War of Roses'},
                          {year: '1969', description: 'Neil Armstrong walks on moon first time'},
                          {year: '1911', description: 'Mona Lisa stolen from Louvre Museum'},
                          {year: '1968', description: 'Pope Paul VI arrives in Colombia'}
                        ]).map((event, i) => (
                          <span
                            key={i}
                            className="topic-item"
                            style={{
                              position: 'absolute',
                              left: 0,
                              whiteSpace: 'nowrap',
                              opacity: 0,
                              animation: 'topicRotate 15s infinite',
                              animationDelay: `${i * 3.75}s`,
                              color: '#1d1d1f',
                              fontWeight: 700,
                              transition: 'opacity 0.5s ease-in-out'
                            }}
                          >
                            {event.year}: {event.description}
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>
                  <div className="news-info" style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    gap: '20px',
                    marginBottom: '50px',
                    fontSize: '13px',
                    color: '#86868b',
                    fontWeight: 500,
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}>
                    <span>10 Stories</span>
                    <span style={{ color: '#d2d2d7' }}>•</span>
                    <span>2 Min Read</span>
                  </div>
                  <div className="scroll-hint" aria-label="Scroll down to continue reading">Scroll to continue ↓</div>
                </div>
              ) : story.type === 'news' ? (
                <div className="news-grid">
                  {story.number === 1 && (
                    <header style={{ 
                      textAlign: 'center', 
                      padding: '32px 0',
                      borderBottom: '1px solid #e5e5e7',
                      marginBottom: '24px'
                    }}>
                      <h2 style={{ 
                        fontSize: '32px',
                        fontWeight: 800,
                        letterSpacing: '-0.5px',
                        color: '#1d1d1f'
                      }}>
                        Today's Essential Reading
                      </h2>
                    </header>
                  )}
                  
                  <div 
                    className="news-item" 
                    onClick={() => {
                      if (story.url) {
                        console.log('Opening article:', story.title, 'URL:', story.url);
                        window.open(story.url, '_blank', 'noopener,noreferrer');
                      } else {
                        console.log('No URL available for:', story.title);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (story.url) {
                          window.open(story.url, '_blank', 'noopener,noreferrer');
                        }
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Read full article: ${story.title}`}
                    style={{ cursor: story.url ? 'pointer' : 'default' }}
                  >
                    <div className="news-number" aria-hidden="true">{story.number < 10 ? `0${story.number}` : story.number}</div>
                    <div className="news-content">
                      <div className="news-category">{story.category}</div>
                      <h3 className="news-title">{story.title}</h3>
                      <p className="news-summary">{story.summary}</p>
                      <div className="news-meta">
                        {story.details && story.details.length > 0 ? (
                          story.details.map((detail, i) => {
                            // Handle both "Label: Value" and plain text formats
                            const colonIndex = detail.indexOf(':');
                            if (colonIndex > 0) {
                              const label = detail.substring(0, colonIndex).trim();
                              const value = detail.substring(colonIndex + 1).trim();
                              return (
                                <span key={i}>
                                  <strong>{label}:</strong>{value}
                                </span>
                              );
                            } else {
                              return (
                                <span key={i}>
                                  {detail}
                                </span>
                              );
                            }
                          })
                        ) : (
                          <span>
                            <strong>Source:</strong> {story.source || 'News Source'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : story.type === 'newsletter' ? (
                <div className="newsletter-container">
                  <h2 className="newsletter-title">Stay Informed</h2>
                  <p className="newsletter-subtitle">
                    Get Ten News delivered to your inbox every morning
                  </p>
                  <form 
                    className="newsletter-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      console.log('Newsletter signup submitted');
                    }}
                  >
                    <input 
                      type="email" 
                      placeholder="Enter your email" 
                      className="newsletter-input"
                      required
                      aria-label="Email address for newsletter subscription"
                    />
                    <button 
                      type="submit"
                      className="newsletter-button"
                      aria-label="Subscribe to newsletter"
                    >
                      Subscribe
                    </button>
                  </form>
                  <p className="newsletter-info">
                    Join 2.5M+ readers • No spam • Unsubscribe anytime
                  </p>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </main>

      {/* Progress Indicator */}
      <nav className="progress-indicator" role="navigation" aria-label="Story navigation">
        {stories.map((_, index) => (
          <button
            key={index}
            className={`progress-dot ${index === currentIndex ? 'active' : ''}`}
            onClick={() => goToStory(index)}
            aria-label={`Go to story ${index + 1}`}
            aria-current={index === currentIndex ? 'page' : undefined}
          />
        ))}
      </nav>
    </div>
  );
}
