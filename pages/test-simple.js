import { useState, useEffect } from 'react';

export default function TestSimple() {
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
          const processedStories = data.articles.slice(0, 3).map((article, index) => ({
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

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Test Swipe Functionality</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={toggleBulletPoints}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
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
          borderRadius: '8px' 
        }}>
          <h3>{story.title}</h3>
          <div style={{ marginTop: '10px' }}>
            {!globalBulletPointsMode ? (
              <p>{story.summary}</p>
            ) : (
              <div>
                {story.summary_bullets && story.summary_bullets.length > 0 ? (
                  <ul>
                    {story.summary_bullets.map((bullet, i) => (
                      <li key={i} style={{ marginBottom: '8px' }}>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontStyle: 'italic', color: '#666' }}>
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
