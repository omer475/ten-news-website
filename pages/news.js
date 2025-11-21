import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function SingleNewsPage() {
  const router = useRouter();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [languageMode, setLanguageMode] = useState('advanced'); // 'advanced' or 'b2'
  const [showLanguageOptions, setShowLanguageOptions] = useState(false);

  useEffect(() => {
    const loadArticle = async () => {
      try {
        setLoading(true);
        
        // Get article ID from URL or use first article
        const articleId = router.query.id;
        
        const response = await fetch(`/api/news?t=${Date.now()}`);
        
        if (response.ok) {
          const newsData = await response.json();
          
          if (newsData.articles && newsData.articles.length > 0) {
            // If specific ID requested, find that article, otherwise use first
            const selectedArticle = articleId 
              ? newsData.articles.find(a => a.id === articleId) || newsData.articles[0]
              : newsData.articles[0];
            
            setArticle(selectedArticle);
          } else {
            setError('No articles available');
          }
        } else {
          setError('Failed to load article');
        }
      } catch (err) {
        setError('Error loading article');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadArticle();
  }, [router.query.id]);

  // Close language options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showLanguageOptions && !event.target.closest('.reading-mode-wrapper')) {
        setShowLanguageOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLanguageOptions]);

  const handleBack = () => {
    router.push('/');
  };

  const handleReadMore = () => {
    if (article?.url && article.url !== '#') {
      window.open(article.url, '_blank');
    }
  };

  const toggleTimeline = () => {
    setShowTimeline(!showTimeline);
  };

  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  const startReading = () => {
    setIsReading(true);
    // Auto-scroll to content after animation
    setTimeout(() => {
      const content = document.querySelector('.article-content');
      if (content) {
        content.scrollIntoView({ behavior: 'smooth' });
      }
    }, 500);
  };

  const toggleLanguageOptions = () => {
    setShowLanguageOptions(!showLanguageOptions);
  };

  const setLanguage = (mode) => {
    setLanguageMode(mode);
    setShowLanguageOptions(false);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading article...</div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="error-container">
        <div className="error-content">
          <h1>Article Not Found</h1>
          <p>{error || 'The requested article could not be found.'}</p>
          <button className="back-btn" onClick={handleBack}>
            ← Back to News
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="single-news-page">
      {/* Header */}
      <header className="news-header">
        <div className="header-content">
          <button className="back-button" onClick={handleBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          
          <div className="header-info">
            <div className="article-meta">
              <span className="category">{article.category || 'WORLD NEWS'}</span>
              <span className="source">{article.source || 'News Source'}</span>
              <span className="date">
                {new Date(article.publishedAt || Date.now()).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
          </div>
          
          <div className="header-actions">
            {/* Language Toggle - Liquid Glass Button */}
            <div className="reading-mode-wrapper" style={{ display: 'flex', position: 'relative' }}>
              <button 
                className="toggle-button glass-btn" 
                onClick={toggleLanguageOptions}
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '7px 14px',
                  background: 'rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15), inset 0 1px 0 0 rgba(255, 255, 255, 0.5)',
                  borderRadius: '980px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#1d1d1f',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  letterSpacing: '-0.01em',
                  zIndex: 1
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="toggle-button-icon">
                  <path d="M4 7V4h16v3"/>
                  <path d="M9 20h6"/>
                  <path d="M12 4v16"/>
                </svg>
                {languageMode === 'advanced' ? 'Advanced' : 'Easy'}
              </button>
              
              {showLanguageOptions && (
                <div className="options-container">
                  <button 
                    className={`option-button easy-mode ${languageMode === 'b2' ? 'active' : ''}`}
                    onClick={() => setLanguage('b2')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="option-icon">
                      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>
                    <span className="option-text">Easy Read (B2)</span>
                  </button>
                  
                  <button 
                    className={`option-button normal-mode ${languageMode === 'advanced' ? 'active' : ''}`}
                    onClick={() => setLanguage('advanced')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="option-icon">
                      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <span className="option-text">Advanced News</span>
                  </button>
                </div>
              )}
            </div>

            <button className="action-btn" onClick={toggleTimeline}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              Timeline
            </button>
            
            <button className="action-btn" onClick={toggleDetails}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
              Details
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <div className="article-number">
              {article.rank || '01'}
            </div>
            
            <h1 className="article-title">
              {article.title || 'Article Title'}
            </h1>
            
            <p className="article-summary">
              {languageMode === 'b2' 
                ? (article.summary_b2 || article.summary || 'Article summary will appear here...')
                : (article.summary_news || article.summary || 'Article summary will appear here...')}
            </p>
            
            <div className="hero-actions">
              <button className="read-btn" onClick={startReading}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                Start Reading
              </button>
              
              <button className="external-btn" onClick={handleReadMore}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15,3 21,3 21,9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Read Full Article
              </button>
            </div>
          </div>
          
          {article.image && (
            <div className="hero-image">
              <img 
                src={article.image} 
                alt={article.title}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      </section>

      {/* Article Content */}
      <section className={`article-content ${isReading ? 'active' : ''}`}>
        <div className="content-wrapper">
          
          {/* Timeline Section */}
          {article.timeline && article.timeline.length > 0 && (
            <div className={`timeline-section ${showTimeline ? 'expanded' : ''}`}>
              <div className="section-header">
                <h2>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  Timeline
                </h2>
                <button className="toggle-btn" onClick={toggleTimeline}>
                  {showTimeline ? 'Hide' : 'Show'} Timeline
                </button>
              </div>
              
              {showTimeline && (
                <div className="timeline-content">
                  <div className="timeline-line"></div>
                  {article.timeline.map((event, index) => (
                    <div key={index} className="timeline-item">
                      <div className="timeline-dot"></div>
                      <div className="timeline-content-item">
                        <div className="timeline-date">{event.date}</div>
                        <div className="timeline-event">{event.event}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Details Section */}
          {article.details && article.details.length > 0 && (
            <div className={`details-section ${showDetails ? 'expanded' : ''}`}>
              <div className="section-header">
                <h2>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10,9 9,9 8,9"/>
                  </svg>
                  Key Details
                </h2>
                <button className="toggle-btn" onClick={toggleDetails}>
                  {showDetails ? 'Hide' : 'Show'} Details
                </button>
              </div>
              
              {showDetails && (
                <div className="details-content">
                  {article.details.map((detail, index) => (
                    <div key={index} className="detail-item">
                      <div className="detail-number">{index + 1}</div>
                      <div className="detail-text">{detail}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Article Meta */}
          <div className="article-meta-section">
            <div className="meta-grid">
              <div className="meta-item">
                <div className="meta-label">Category</div>
                <div className="meta-value">{article.category || 'General'}</div>
              </div>
              
              <div className="meta-item">
                <div className="meta-label">Source</div>
                <div className="meta-value">{article.source || 'Unknown'}</div>
              </div>
              
              <div className="meta-item">
                <div className="meta-label">Published</div>
                <div className="meta-value">
                  {new Date(article.publishedAt || Date.now()).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
              
              {article.final_score && (
                <div className="meta-item">
                  <div className="meta-label">Importance Score</div>
                  <div className="meta-value score-value">{article.final_score}/100</div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="article-actions">
            <button className="action-button primary" onClick={handleReadMore}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15,3 21,3 21,9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Read Full Article
            </button>
            
            <button className="action-button secondary" onClick={() => window.print()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6,9 6,2 18,2 18,9"/>
                <path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print Article
            </button>
            
            <button className="action-button secondary" onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: article.title,
                  text: article.summary,
                  url: window.location.href
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('Link copied to clipboard!');
              }
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="news-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <span className="logo-ten">TEN</span> NEWS
          </div>
          <div className="footer-text">
            Essential global news curated by AI
          </div>
          <button className="back-to-home" onClick={handleBack}>
            ← Back to All News
          </button>
        </div>
      </footer>

      <style jsx>{`
        /* Apple HIG - Page Base Styles */
        .single-news-page {
          min-height: 100vh;
          background: #f5f5f7;
          color: #1d1d1f;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Apple HIG - Loading State */
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: #f5f5f7;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(0, 0, 0, 0.08);
          border-top: 3px solid #1d1d1f;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        .loading-text {
          font-size: 17px;
          color: rgba(0, 0, 0, 0.56);
          font-weight: 400;
          letter-spacing: -0.022em;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-container {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: #F8F9FB;
        }

        .error-content {
          text-align: center;
          max-width: 400px;
          padding: 40px;
        }

        .error-content h1 {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 16px;
          color: #1d1d1f;
        }

        .error-content p {
          font-size: 16px;
          color: #86868b;
          margin-bottom: 24px;
        }

        .back-btn {
          padding: 12px 24px;
          background: #1d1d1f;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: #000;
          transform: translateY(-1px);
        }

        /* Apple HIG - Header */
        .news-header {
          position: sticky;
          top: 0;
          background: rgba(251, 251, 253, 0.8);
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
          z-index: 100;
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 12px max(env(safe-area-inset-left, 20px), 20px) 12px max(env(safe-area-inset-right, 20px), 20px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          min-height: 52px;
        }

        /* Apple HIG - Back Button */
        .back-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: none;
          border: none;
          border-radius: 980px;
          font-size: 14px;
          font-weight: 400;
          color: #1d1d1f;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.28, 0, 0.4, 1);
          letter-spacing: -0.01em;
        }

        .back-button:hover {
          background: rgba(0, 0, 0, 0.04);
        }

        .back-button:active {
          transform: scale(0.96);
          background: rgba(0, 0, 0, 0.06);
        }

        .header-info {
          flex: 1;
        }

        /* Apple HIG - Article Meta */
        .article-meta {
          display: flex;
          gap: 12px;
          font-size: 13px;
          color: rgba(0, 0, 0, 0.56);
          letter-spacing: -0.08px;
        }

        .article-meta span {
          font-weight: 400;
        }

        .category {
          background: #1d1d1f;
          color: #ffffff;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        /* Apple HIG - Header Actions */
        .header-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 14px;
          background: #007aff;
          border: none;
          border-radius: 980px;
          font-size: 14px;
          font-weight: 400;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.28, 0, 0.4, 1);
          letter-spacing: -0.01em;
        }

        .action-btn:hover {
          background: #0051d5;
        }

        .action-btn:active {
          transform: scale(0.96);
          background: #003ea7;
        }

        /* Apple HIG - Hero Section */
        .hero-section {
          padding: 48px max(env(safe-area-inset-left, 24px), 24px) 48px max(env(safe-area-inset-right, 24px), 24px);
          margin-top: calc(-1 * env(safe-area-inset-top));
          padding-top: calc(48px + env(safe-area-inset-top));
          background: #ffffff;
        }

        .hero-content {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 64px;
          align-items: center;
        }

        .hero-text {
          max-width: 640px;
        }

        /* Apple HIG - Article Number */
        .article-number {
          font-size: 13px;
          font-weight: 600;
          color: rgba(0, 0, 0, 0.56);
          letter-spacing: 0.8px;
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        /* Apple HIG - Article Title */
        .article-title {
          font-size: 48px;
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -1.2px;
          margin-bottom: 20px;
          color: #1d1d1f;
        }

        /* Apple HIG - Article Summary */
        .article-summary {
          font-size: 21px;
          line-height: 1.48;
          font-weight: 400;
          color: rgba(0, 0, 0, 0.72);
          margin-bottom: 32px;
          letter-spacing: -0.03em;
        }

        /* Apple HIG - Hero Actions */
        .hero-actions {
          display: flex;
          gap: 12px;
        }

        /* Apple HIG - Primary Button */
        .read-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: #007aff;
          color: #ffffff;
          border: none;
          border-radius: 980px;
          font-size: 17px;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.28, 0, 0.4, 1);
          letter-spacing: -0.022em;
        }

        .read-btn:hover {
          background: #0051d5;
        }

        .read-btn:active {
          transform: scale(0.96);
          background: #003ea7;
        }

        /* Apple HIG - Secondary Button */
        .external-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 12px 24px;
          background: transparent;
          color: #1d1d1f;
          border: none;
          border-radius: 980px;
          font-size: 17px;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.28, 0, 0.4, 1);
          letter-spacing: -0.022em;
        }

        .external-btn:hover {
          background: rgba(0, 0, 0, 0.04);
        }

        .external-btn:active {
          transform: scale(0.96);
          background: rgba(0, 0, 0, 0.06);
        }

        /* Apple HIG - Hero Image */
        .hero-image {
          position: relative;
          top: calc(-1 * env(safe-area-inset-top));
          margin-bottom: calc(-1 * env(safe-area-inset-top));
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        }

        .hero-image img {
          width: 100%;
          height: 300px;
          object-fit: cover;
        }

        /* Apple HIG - Article Content */
        .article-content {
          padding: 64px max(env(safe-area-inset-left, 24px), 24px) 64px max(env(safe-area-inset-right, 24px), 24px);
          background: #f5f5f7;
          transform: translateY(100px);
          opacity: 0;
          transition: all 0.5s cubic-bezier(0.28, 0, 0.4, 1);
        }

        .article-content.active {
          transform: translateY(0);
          opacity: 1;
        }

        .content-wrapper {
          max-width: 820px;
          margin: 0 auto;
        }

        .timeline-section,
        .details-section {
          margin-bottom: 48px;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.3s ease;
          background: #ffffff;
        }

        .timeline-section.expanded,
        .details-section.expanded {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: #f8f8f8;
          border-bottom: 1px solid #e5e5e5;
        }

        .section-header h2 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 600;
          color: #000000;
        }

        .toggle-btn {
          padding: 6px 12px;
          background: #000000;
          color: #ffffff;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .toggle-btn:hover {
          background: #333333;
        }

        .timeline-content {
          padding: 20px;
          position: relative;
          background: #ffffff;
        }

        .timeline-line {
          position: absolute;
          left: 20px;
          top: 0;
          bottom: 0;
          width: 1px;
          background: #cccccc;
        }

        .timeline-item {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          position: relative;
        }

        .timeline-item:last-child {
          margin-bottom: 0;
        }

        .timeline-dot {
          width: 8px;
          height: 8px;
          background: #000000;
          border-radius: 50%;
          margin-top: 6px;
          flex-shrink: 0;
          z-index: 1;
        }

        .timeline-content-item {
          flex: 1;
          padding-left: 8px;
        }

        .timeline-date {
          font-size: 11px;
          font-weight: 500;
          color: #666666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .timeline-event {
          font-size: 14px;
          color: #000000;
          line-height: 1.4;
          font-weight: 400;
        }

        .details-content {
          padding: 20px;
          background: #ffffff;
        }

        .detail-item {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          align-items: flex-start;
        }

        .detail-item:last-child {
          margin-bottom: 0;
        }

        .detail-number {
          width: 20px;
          height: 20px;
          background: #000000;
          color: #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .detail-text {
          font-size: 14px;
          color: #000000;
          line-height: 1.4;
          padding-top: 2px;
          font-weight: 400;
        }

        .article-meta-section {
          margin-bottom: 48px;
          padding: 24px;
          background: #f8f8f8;
          border-radius: 8px;
          border: 1px solid #e5e5e5;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }

        .meta-item {
          text-align: center;
          padding: 16px;
          background: #ffffff;
          border-radius: 6px;
          border: 1px solid #e5e5e5;
          transition: all 0.2s;
        }

        .meta-item:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .meta-label {
          font-size: 11px;
          font-weight: 500;
          color: #666666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .meta-value {
          font-size: 14px;
          font-weight: 600;
          color: #000000;
        }

        .score-value {
          color: #000000;
          font-weight: 700;
        }

        .article-actions {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .action-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-button.primary {
          background: #000000;
          color: #ffffff;
        }

        .action-button.primary:hover {
          background: #333333;
          transform: translateY(-1px);
        }

        .action-button.secondary {
          background: #ffffff;
          color: #000000;
          border: 1px solid #e5e5e5;
        }

        .action-button.secondary:hover {
          background: #f8f8f8;
          border-color: #cccccc;
        }

        .news-footer {
          background: #000000;
          color: #ffffff;
          padding: 32px 24px;
          text-align: center;
        }

        .footer-content {
          max-width: 800px;
          margin: 0 auto;
        }

        .footer-logo {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .logo-ten {
          color: #ffffff;
        }

        .footer-text {
          font-size: 13px;
          color: #cccccc;
          margin-bottom: 20px;
        }

        .back-to-home {
          padding: 10px 20px;
          background: #ffffff;
          color: #000000;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-to-home:hover {
          background: #f8f8f8;
          transform: translateY(-1px);
        }

        /* Reading Mode Toggle Styles - Liquid Glass Effect */
        .reading-mode-wrapper {
          position: relative;
        }

        /* Liquid Glass Toggle Button */
        .glass-btn {
          position: relative;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 14px;
          overflow: hidden;
          border: none;
          
          /* Liquid Glass Effect */
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15),
                      inset 0 1px 0 0 rgba(255, 255, 255, 0.5);
          
          border-radius: 980px;
          font-size: 14px;
          font-weight: 500;
          color: #1d1d1f;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          letter-spacing: -0.01em;
          z-index: 1;
          
          /* Gradient overlay */
          background-image: linear-gradient(135deg, 
            rgba(255, 255, 255, 0.35) 0%, 
            rgba(255, 255, 255, 0.15) 100%);
        }

        /* Content should be above shimmer */
        .glass-btn > * {
          position: relative;
          z-index: 2;
        }

        .glass-btn:hover {
          background: rgba(255, 255, 255, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.2),
                      inset 0 1px 0 0 rgba(255, 255, 255, 0.6);
          transform: translateY(-2px);
        }

        .glass-btn:active {
          transform: translateY(0) scale(0.98);
          background: rgba(255, 255, 255, 0.3);
        }

        .toggle-button-icon {
          width: 1rem;
          height: 1rem;
          transition: all 0.3s ease;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
        }

        /* Liquid Glass Dropdown Container */
        .options-container {
          position: absolute;
          top: calc(100% + 0.75rem);
          right: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          overflow: hidden;
          
          /* Liquid Glass Effect */
          background: rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: 0 12px 48px 0 rgba(31, 38, 135, 0.2),
                      inset 0 1px 0 0 rgba(255, 255, 255, 0.5);
          
          border-radius: 16px;
          padding: 0.5rem;
          min-width: 200px;
          animation: slideDown 0.3s ease-out forwards;
          z-index: 1000;
          
          /* Gradient overlay */
          background-image: linear-gradient(135deg, 
            rgba(255, 255, 255, 0.4) 0%, 
            rgba(255, 255, 255, 0.2) 100%);
        }

        /* Content above shimmer in dropdown */
        .options-container > * {
          position: relative;
          z-index: 2;
        }

        /* Glass Option Buttons */
        .option-button {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          
          /* Glass effect */
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          
          color: #1d1d1f;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.01em;
          box-shadow: 0 2px 8px rgba(31, 38, 135, 0.1);
        }

        .option-button:hover {
          transform: translateY(-2px) scale(1.02);
          background: rgba(255, 255, 255, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 4px 16px rgba(31, 38, 135, 0.15);
        }

        /* Easy Read Button - Blue Glass Active */
        .option-button.easy-mode:hover {
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .option-button.easy-mode.active {
          background: linear-gradient(135deg, 
            rgba(59, 130, 246, 0.85) 0%, 
            rgba(37, 99, 235, 0.9) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(59, 130, 246, 0.5);
          color: white;
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4),
                      inset 0 1px 0 0 rgba(255, 255, 255, 0.3);
        }

        /* Normal News Button - Dark Glass Active */
        .option-button.normal-mode:hover {
          background: rgba(51, 65, 85, 0.15);
          border: 1px solid rgba(51, 65, 85, 0.3);
        }

        .option-button.normal-mode.active {
          background: linear-gradient(135deg, 
            rgba(51, 65, 85, 0.9) 0%, 
            rgba(30, 41, 59, 0.95) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(51, 65, 85, 0.5);
          color: white;
          box-shadow: 0 4px 20px rgba(51, 65, 85, 0.4),
                      inset 0 1px 0 0 rgba(255, 255, 255, 0.2);
        }

        /* Option Icons and Text */
        .option-icon {
          width: 1.125rem;
          height: 1.125rem;
          flex-shrink: 0;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
        }

        .option-text {
          font-size: 0.875rem;
          font-weight: 500;
          white-space: nowrap;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        /* Animations */
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Shimmer effect on hover */
        .glass-btn::before,
        .options-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, 
            transparent, 
            rgba(255, 255, 255, 0.3), 
            transparent);
          transition: left 0.5s;
          border-radius: 980px;
          z-index: 1;
          pointer-events: none;
        }

        .glass-btn:hover::before {
          left: 100%;
        }

        .options-container::before {
          border-radius: 16px;
        }

        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            gap: 16px;
            align-items: stretch;
          }

          .header-actions {
            justify-content: center;
            flex-wrap: wrap;
          }

          .reading-mode-wrapper {
            width: 100%;
          }

          .glass-btn {
            width: 100%;
            justify-content: center;
          }

          .options-container {
            left: 50%;
            right: auto;
            transform: translateX(-50%);
          }

          .hero-content {
            grid-template-columns: 1fr;
            gap: 32px;
            text-align: center;
          }

          .article-title {
            font-size: 32px;
            letter-spacing: -1px;
          }

          .article-summary {
            font-size: 18px;
          }

          .hero-actions {
            justify-content: center;
            flex-wrap: wrap;
          }

          .hero-image {
            order: -1;
          }

          .hero-image img {
            height: 200px;
          }

          .meta-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .article-actions {
            flex-direction: column;
            align-items: center;
          }

          .action-button {
            width: 100%;
            max-width: 300px;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
