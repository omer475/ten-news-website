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
              {article.summary || 'Article summary will appear here...'}
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
        .single-news-page {
          min-height: 100vh;
          background: #ffffff;
          color: #1d1d1f;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: #F8F9FB;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #1d1d1f;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        .loading-text {
          font-size: 16px;
          color: #86868b;
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

        .news-header {
          position: sticky;
          top: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          z-index: 100;
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .back-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: none;
          border: 1px solid #e5e5e7;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #1d1d1f;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-button:hover {
          background: #f5f5f7;
          border-color: #d2d2d7;
        }

        .header-info {
          flex: 1;
        }

        .article-meta {
          display: flex;
          gap: 16px;
          font-size: 13px;
          color: #666666;
        }

        .article-meta span {
          font-weight: 500;
        }

        .category {
          background: #000000;
          color: #ffffff;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #000000;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: #333333;
          color: #ffffff;
        }

        .hero-section {
          padding: 40px 24px;
          margin-top: calc(-1 * env(safe-area-inset-top));
          padding-top: calc(40px + env(safe-area-inset-top));
          background: linear-gradient(135deg, #F8F9FB 0%, #ffffff 100%);
        }

        .hero-content {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 60px;
          align-items: center;
        }

        .hero-text {
          max-width: 600px;
        }

        .article-number {
          font-size: 14px;
          font-weight: 700;
          color: #86868b;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .article-title {
          font-size: 48px;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -1.5px;
          margin-bottom: 24px;
          color: #1d1d1f;
        }

        .article-summary {
          font-size: 20px;
          line-height: 1.6;
          color: #666;
          margin-bottom: 32px;
        }

        .hero-actions {
          display: flex;
          gap: 16px;
        }

        .read-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px 24px;
          background: #1d1d1f;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .read-btn:hover {
          background: #000;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        .external-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px 24px;
          background: white;
          color: #1d1d1f;
          border: 1px solid #e5e5e7;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .external-btn:hover {
          background: #f5f5f7;
          border-color: #d2d2d7;
          transform: translateY(-2px);
        }

        .hero-image {
          position: relative;
          top: calc(-1 * env(safe-area-inset-top));
          margin-bottom: calc(-1 * env(safe-area-inset-top));
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        .hero-image img {
          width: 100%;
          height: 300px;
          object-fit: cover;
        }

        .article-content {
          padding: 60px 24px;
          background: white;
          transform: translateY(100px);
          opacity: 0;
          transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .article-content.active {
          transform: translateY(0);
          opacity: 1;
        }

        .content-wrapper {
          max-width: 800px;
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

        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            gap: 16px;
            align-items: stretch;
          }

          .header-actions {
            justify-content: center;
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
