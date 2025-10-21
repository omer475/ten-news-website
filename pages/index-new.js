import { useState, useEffect } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState([]);
  const [globalBulletPointsMode, setGlobalBulletPointsMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🔄 Loading data...');
        const response = await fetch('/api/news');
        const data = await response.json();
        console.log('📰 Data received:', data);
        
        if (data.articles && data.articles.length > 0) {
          const processedStories = data.articles.slice(0, 10).map((article, index) => ({
            id: article.id || `article_${index}`,
            type: 'news',
            number: article.rank || (index + 1),
            category: (article.category || 'WORLD NEWS').toUpperCase(),
            emoji: article.emoji || '📰',
            title: article.title || 'News Story',
            summary: article.summary || 'News summary will appear here.',
            summary_bullets: article.summary_bullets || [],
            details: article.details || [],
            source: article.source || 'Today+',
            url: article.url || '#',
            urlToImage: article.urlToImage,
            timeline: article.timeline && article.timeline.length > 0 ? article.timeline : [
              {"date": "Background", "event": "Initial situation develops"},
              {"date": "Today", "event": "Major developments break"},
              {"date": "Next week", "event": "Follow-up expected"}
            ]
          }));
          
          console.log('📰 Processed stories:', processedStories);
          setStories(processedStories);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const toggleBulletPoints = () => {
    setGlobalBulletPointsMode(prev => !prev);
  };

  const handleTouchStart = (e) => {
    const startX = e.touches[0].clientX;
    const startY = e.touches[0].clientY;
    let hasMoved = false;

    const handleTouchMove = (e) => {
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = Math.abs(currentX - startX);
      const deltaY = Math.abs(currentY - startY);
      
      if (deltaX > deltaY && deltaX > 10) {
        hasMoved = true;
      }
    };

    const handleTouchEnd = (e) => {
      const endX = e.changedTouches[0].clientX;
      const deltaX = endX - startX;
      
      if (hasMoved && Math.abs(deltaX) > 50) {
        console.log('Swipe detected, toggling mode');
        toggleBulletPoints();
      }
      
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
  };

  const renderBoldText = (text, category) => {
    if (!text) return '';
    
    // Simple bold text rendering for categories
    const categoryWords = category ? category.split(' ') : [];
    let result = text;
    
    categoryWords.forEach(word => {
      if (word.length > 2) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        result = result.replace(regex, `<strong>${word}</strong>`);
      }
    });
    
    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ marginTop: '20px', fontSize: '16px', color: '#64748b' }}>
          Loading latest news...
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{ fontSize: '18px', color: '#64748b' }}>
          No news available at the moment.
        </div>
      </div>
    );
  }

  const currentStory = stories[currentIndex];

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderBottom: '1px solid #e2e8f0',
        textAlign: 'center'
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '24px', 
          fontWeight: 'bold',
          background: 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Ten News
        </h1>
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#64748b' }}>
          Story {currentIndex + 1} of {stories.length}
        </div>
      </div>

      {/* Controls */}
      <div style={{
        backgroundColor: 'white',
        padding: '15px 20px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: currentIndex === 0 ? '#e2e8f0' : '#3b82f6',
              color: currentIndex === 0 ? '#94a3b8' : 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          <button 
            onClick={() => setCurrentIndex(Math.min(stories.length - 1, currentIndex + 1))}
            disabled={currentIndex === stories.length - 1}
            style={{
              padding: '8px 16px',
              backgroundColor: currentIndex === stories.length - 1 ? '#e2e8f0' : '#3b82f6',
              color: currentIndex === stories.length - 1 ? '#94a3b8' : 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: currentIndex === stories.length - 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            fontSize: '12px',
            color: '#64748b',
            backgroundColor: '#f1f5f9',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            {globalBulletPointsMode ? 'Bullets' : 'Paragraph'}
          </div>
          <button 
            onClick={toggleBulletPoints}
            style={{
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Toggle View
          </button>
        </div>
      </div>

      {/* Story Content */}
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Story Header */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '10px'
            }}>
              <span style={{ fontSize: '24px' }}>{currentStory.emoji}</span>
              <div style={{
                fontSize: '12px',
                color: '#3b82f6',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                background: 'rgba(59, 130, 246, 0.1)',
                padding: '4px 8px',
                borderRadius: '4px'
              }}>
                {currentStory.category}
              </div>
            </div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '24px', 
              fontWeight: 'bold',
              lineHeight: '1.3',
              color: '#1e293b'
            }}>
              {currentStory.title}
            </h2>
          </div>

          {/* Summary Content */}
          <div 
            style={{ 
              marginTop: '20px',
              padding: '20px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              cursor: 'pointer',
              border: '2px solid transparent',
              transition: 'border-color 0.2s'
            }}
            onTouchStart={handleTouchStart}
            onClick={() => window.open(currentStory.url, '_blank')}
            onMouseEnter={(e) => e.target.style.borderColor = '#3b82f6'}
            onMouseLeave={(e) => e.target.style.borderColor = 'transparent'}
          >
            <div style={{ 
              marginBottom: '15px', 
              fontSize: '12px', 
              color: '#64748b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>Swipe left/right to toggle • Click to open source</span>
              <span style={{
                fontSize: '10px',
                color: '#3b82f6',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                background: 'rgba(59, 130, 246, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                {globalBulletPointsMode ? 'Bullets' : 'Paragraph'}
              </span>
            </div>
            
            {!globalBulletPointsMode ? (
              <p style={{ 
                margin: 0, 
                fontSize: '16px', 
                lineHeight: '1.6',
                color: '#374151'
              }}>
                {renderBoldText(currentStory.summary, currentStory.category)}
              </p>
            ) : (
              <div>
                {currentStory.summary_bullets && currentStory.summary_bullets.length > 0 ? (
                  <ul style={{ 
                    margin: 0, 
                    paddingLeft: '20px',
                    listStyleType: 'disc'
                  }}>
                    {currentStory.summary_bullets.map((bullet, i) => (
                      <li key={i} style={{ 
                        marginBottom: '8px', 
                        fontSize: '16px', 
                        lineHeight: '1.6',
                        color: '#374151'
                      }}>
                        {renderBoldText(bullet, currentStory.category)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ 
                    margin: 0, 
                    fontStyle: 'italic', 
                    color: '#6b7280' 
                  }}>
                    No bullet points available
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Story Footer */}
          <div style={{ 
            marginTop: '20px', 
            paddingTop: '20px', 
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '14px',
            color: '#64748b'
          }}>
            <span>Source: {currentStory.source}</span>
            <span>Story #{currentStory.number}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
