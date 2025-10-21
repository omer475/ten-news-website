import { useState, useEffect } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState([]);
  const [globalBulletPointsMode, setGlobalBulletPointsMode] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🔄 Loading data...');
        const response = await fetch('/api/news');
        const data = await response.json();
        console.log('📰 Data received:', data);
        
        if (data.articles && data.articles.length > 0) {
          const processedStories = data.articles.slice(0, 5).map((article, index) => ({
            id: article.id || `article_${index}`,
            title: article.title || 'News Story',
            summary: article.summary || 'News summary will appear here.',
            summary_bullets: article.summary_bullets || [],
            category: article.category || 'WORLD NEWS'
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

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading latest news...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Ten News - Swipe Test</h1>
      
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
        <p><strong>Instructions:</strong></p>
        <p>• Swipe left or right on any news summary to toggle between paragraph and bullet points</p>
        <p>• Click the button below to toggle manually</p>
        <p>• Current mode: <strong>{globalBulletPointsMode ? 'Bullets' : 'Paragraph'}</strong></p>
        
        <button 
          onClick={toggleBulletPoints}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Toggle Mode: {globalBulletPointsMode ? 'Bullets' : 'Paragraph'}
        </button>
      </div>

      {stories.map((story, index) => (
        <div key={story.id} style={{ 
          marginBottom: '30px', 
          padding: '20px', 
          border: '1px solid #ddd', 
          borderRadius: '8px',
          backgroundColor: '#fff'
        }}>
          <h3 style={{ marginTop: 0 }}>{story.title}</h3>
          
          <div 
            style={{ 
              marginTop: '10px',
              padding: '15px',
              backgroundColor: '#f9f9f9',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
            onTouchStart={handleTouchStart}
            onClick={() => window.open(story.url || '#', '_blank')}
          >
            <div style={{ marginBottom: '10px', fontSize: '12px', color: '#666' }}>
              Swipe left/right to toggle • Click to open source
            </div>
            
            {!globalBulletPointsMode ? (
              <p style={{ margin: 0, fontSize: '16px', lineHeight: '1.6' }}>
                {story.summary}
              </p>
            ) : (
              <div>
                {story.summary_bullets && story.summary_bullets.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {story.summary_bullets.map((bullet, i) => (
                      <li key={i} style={{ marginBottom: '8px', fontSize: '16px', lineHeight: '1.6' }}>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: 0, fontStyle: 'italic', color: '#666' }}>
                    No bullet points available
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
