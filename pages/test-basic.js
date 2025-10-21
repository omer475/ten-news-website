import { useState } from 'react';

export default function TestBasic() {
  const [globalBulletPointsMode, setGlobalBulletPointsMode] = useState(false);

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

  const testStory = {
    title: "Test News Story",
    summary: "This is a test summary paragraph that should be displayed when in paragraph mode. It contains important information about the news story.",
    summary_bullets: [
      "First bullet point with important information",
      "Second bullet point with additional details",
      "Third bullet point with more context",
      "Fourth bullet point with final information"
    ]
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Basic Swipe Test</h1>
      
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
        <p><strong>Instructions:</strong></p>
        <p>• Swipe left or right on the summary below to toggle between paragraph and bullet points</p>
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

      <div style={{ 
        marginBottom: '30px', 
        padding: '20px', 
        border: '1px solid #ddd', 
        borderRadius: '8px',
        backgroundColor: '#fff'
      }}>
        <h3 style={{ marginTop: 0 }}>{testStory.title}</h3>
        
        <div 
          style={{ 
            marginTop: '10px',
            padding: '15px',
            backgroundColor: '#f9f9f9',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
          onTouchStart={handleTouchStart}
        >
          <div style={{ marginBottom: '10px', fontSize: '12px', color: '#666' }}>
            Swipe left/right to toggle
          </div>
          
          {!globalBulletPointsMode ? (
            <p style={{ margin: 0, fontSize: '16px', lineHeight: '1.6' }}>
              {testStory.summary}
            </p>
          ) : (
            <div>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {testStory.summary_bullets.map((bullet, i) => (
                  <li key={i} style={{ marginBottom: '8px', fontSize: '16px', lineHeight: '1.6' }}>
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
