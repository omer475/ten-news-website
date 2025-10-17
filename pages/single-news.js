import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function SingleNewsPage() {
  const router = useRouter();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [fontSize, setFontSize] = useState('medium');
  const [darkMode, setDarkMode] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [relatedArticles, setRelatedArticles] = useState([]);

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
            
            // Load related articles (same category)
            const related = newsData.articles
              .filter(a => a.category === selectedArticle.category && a.id !== selectedArticle.id)
              .slice(0, 3);
            setRelatedArticles(related);
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

  // Reading progress tracking
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = (scrollTop / docHeight) * 100;
      setReadingProgress(scrollPercent);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    setTimeout(() => {
      const content = document.querySelector('.article-content');
      if (content) {
        content.scrollIntoView({ behavior: 'smooth' });
      }
    }, 500);
  };

  const toggleBookmark = () => {
    setBookmarked(!bookmarked);
    // Here you would save to localStorage or API
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    if (bookmarked) {
      const newBookmarks = bookmarks.filter(id => id !== article.id);
      localStorage.setItem('bookmarks', JSON.stringify(newBookmarks));
    } else {
      bookmarks.push(article.id);
      localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.summary,
          url: window.location.href
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      setShareModal(true);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareModal(false);
    // Show toast notification
  };

  const changeFontSize = (size) => {
    setFontSize(size);
    document.documentElement.style.setProperty('--font-size', size);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark-mode');
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
    <>
      <Head>
        <title>{article.title} | Ten News</title>
        <meta name="description" content={article.summary} />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.summary} />
        <meta property="og:image" content={article.image} />
        <meta property="og:url" content={window.location.href} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={article.summary} />
        <meta name="twitter:image" content={article.image} />
      </Head>

      <div className={`single-news-page ${darkMode ? 'dark-mode' : ''}`}>
        {/* Reading Progress Bar */}
        <div className="reading-progress">
          <div 
            className="progress-bar" 
            style={{ width: `${readingProgress}%` }}
          ></div>
        </div>

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
              <button 
                className={`action-btn ${bookmarked ? 'bookmarked' : ''}`} 
                onClick={toggleBookmark}
                title="Bookmark"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
              
              <button className="action-btn" onClick={handleShare} title="Share">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </button>

              <div className="font-size-controls">
                <button 
                  className={`font-btn ${fontSize === 'small' ? 'active' : ''}`}
                  onClick={() => changeFontSize('small')}
                  title="Small font"
                >
                  A
                </button>
                <button 
                  className={`font-btn ${fontSize === 'medium' ? 'active' : ''}`}
                  onClick={() => changeFontSize('medium')}
                  title="Medium font"
                >
                  A
                </button>
                <button 
                  className={`font-btn ${fontSize === 'large' ? 'active' : ''}`}
                  onClick={() => changeFontSize('large')}
                  title="Large font"
                >
                  A
                </button>
              </div>

              <button className="action-btn" onClick={toggleDarkMode} title="Dark mode">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
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

              <div className="article-stats">
                <div className="stat-item">
                  <span className="stat-label">Reading Time</span>
                  <span className="stat-value">5 min read</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Importance</span>
                  <span className="stat-value score">{article.final_score || '85'}/100</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Views</span>
                  <span className="stat-value">2.3k</span>
                </div>
              </div>
              
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
                <div className="image-overlay">
                  <div className="image-caption">
                    {article.title}
                  </div>
                </div>
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
              
              <button className="action-button secondary" onClick={handleShare}>
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

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <section className="related-articles">
            <div className="related-content">
              <h2>Related Articles</h2>
              <div className="related-grid">
                {relatedArticles.map((related, index) => (
                  <div key={index} className="related-item" onClick={() => {
                    router.push(`/news?id=${related.id}`);
                  }}>
                    <div className="related-image">
                      {related.image && (
                        <img src={related.image} alt={related.title} />
                      )}
                    </div>
                    <div className="related-text">
                      <h3>{related.title}</h3>
                      <p>{related.summary}</p>
                      <div className="related-meta">
                        <span className="related-source">{related.source}</span>
                        <span className="related-date">
                          {new Date(related.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

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

        {/* Share Modal */}
        {shareModal && (
          <div className="share-modal-overlay" onClick={() => setShareModal(false)}>
            <div className="share-modal" onClick={(e) => e.stopPropagation()}>
              <div className="share-modal-header">
                <h3>Share Article</h3>
                <button className="close-btn" onClick={() => setShareModal(false)}>×</button>
              </div>
              <div className="share-modal-body">
                <div className="share-options">
                  <button className="share-option" onClick={copyToClipboard}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy Link
                  </button>
                  <button className="share-option" onClick={() => {
                    const text = `${article.title} - ${window.location.href}`;
                    navigator.clipboard.writeText(text);
                    setShareModal(false);
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    Copy Text
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        :root {
          --font-size-small: 14px;
          --font-size-medium: 16px;
          --font-size-large: 18px;
          --font-size: var(--font-size-medium);
        }

        .single-news-page {
          min-height: 100vh;
          background: #ffffff;
          color: #1d1d1f;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          font-size: var(--font-size);
          line-height: 1.6;
        }

        .single-news-page.dark-mode {
          background: #1a1a1a;
          color: #ffffff;
        }

        /* Reading Progress */
        .reading-progress {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(0, 0, 0, 0.1);
          z-index: 1000;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          transition: width 0.1s ease;
        }

        /* Loading States */
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

        /* Error States */
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

        /* Header */
        .news-header {
          position: sticky;
          top: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          z-index: 100;
        }

        .dark-mode .news-header {
          background: rgba(26, 26, 26, 0.95);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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

        .dark-mode .back-button {
          border-color: #404040;
          color: #ffffff;
        }

        .back-button:hover {
          background: #f5f5f7;
          border-color: #d2d2d7;
        }

        .dark-mode .back-button:hover {
          background: #404040;
        }

        .header-info {
          flex: 1;
        }

        .article-meta {
          display: flex;
          gap: 16px;
          font-size: 13px;
          color: #86868b;
        }

        .article-meta span {
          font-weight: 500;
        }

        .category {
          color: #000000;
          font-weight: 700;
          background: #ffffff;
          padding: 4px 12px;
          border: 2px solid #000000;
          border-radius: 4px;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 1px;
        }

        .dark-mode .category {
          color: #ffffff;
        }

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #ffffff;
          border: 1px solid #333333;
          border-radius: 0;
          font-size: 11px;
          font-weight: 600;
          color: #333333;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .dark-mode .action-btn {
          border-color: #404040;
          color: #ffffff;
        }

        .action-btn:hover {
          background: #333333;
          color: #ffffff;
        }

        .dark-mode .action-btn:hover {
          background: #404040;
        }

        .action-btn.bookmarked {
          color: #f59e0b;
          border-color: #f59e0b;
        }

        .font-size-controls {
          display: flex;
          gap: 4px;
          border: 1px solid #e5e5e7;
          border-radius: 6px;
          padding: 2px;
        }

        .dark-mode .font-size-controls {
          border-color: #404040;
        }

        .font-btn {
          padding: 4px 8px;
          background: none;
          border: none;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 4px;
        }

        .font-btn.active {
          background: #1d1d1f;
          color: white;
        }

        .dark-mode .font-btn.active {
          background: #ffffff;
          color: #1d1d1f;
        }

        /* Hero Section */
        .hero-section {
          padding: 40px 24px;
          background: linear-gradient(135deg, #F8F9FB 0%, #ffffff 100%);
        }

        .dark-mode .hero-section {
          background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
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

        .dark-mode .article-title {
          color: #ffffff;
        }

        .article-summary {
          font-size: 20px;
          line-height: 1.6;
          color: #666;
          margin-bottom: 32px;
        }

        .dark-mode .article-summary {
          color: #cccccc;
        }

        .article-stats {
          display: flex;
          gap: 24px;
          margin-bottom: 32px;
        }

        .stat-item {
          text-align: center;
        }

        .stat-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .stat-value {
          display: block;
          font-size: 16px;
          font-weight: 700;
          color: #1d1d1f;
        }

        .dark-mode .stat-value {
          color: #ffffff;
        }

        .stat-value.score {
          color: #34c759;
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

        .dark-mode .external-btn {
          background: #2a2a2a;
          color: #ffffff;
          border-color: #404040;
        }

        .external-btn:hover {
          background: #f5f5f7;
          border-color: #d2d2d7;
          transform: translateY(-2px);
        }

        .dark-mode .external-btn:hover {
          background: #404040;
        }

        .hero-image {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        .hero-image img {
          width: 100%;
          height: 300px;
          object-fit: cover;
        }

        .image-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
          padding: 20px;
          color: white;
        }

        .image-caption {
          font-size: 14px;
          font-weight: 500;
          opacity: 0.9;
        }

        /* Article Content */
        .article-content {
          padding: 60px 24px;
          background: white;
          transform: translateY(100px);
          opacity: 0;
          transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .dark-mode .article-content {
          background: #1a1a1a;
        }

        .article-content.active {
          transform: translateY(0);
          opacity: 1;
        }

        .content-wrapper {
          max-width: 800px;
          margin: 0 auto;
        }

        /* Timeline Section */
        .timeline-section,
        .details-section {
          margin-bottom: 48px;
          border: 1px solid #e5e5e7;
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .dark-mode .timeline-section,
        .dark-mode .details-section {
          border-color: #404040;
        }

        .timeline-section.expanded,
        .details-section.expanded {
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          background: #f8f9fa;
          border-bottom: 1px solid #e5e5e7;
        }

        .dark-mode .section-header {
          background: #2a2a2a;
          border-bottom-color: #404040;
        }

        .section-header h2 {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 18px;
          font-weight: 700;
          color: #1d1d1f;
        }

        .dark-mode .section-header h2 {
          color: #ffffff;
        }

        .toggle-btn {
          padding: 8px 16px;
          background: #1d1d1f;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toggle-btn:hover {
          background: #000;
        }

        .timeline-content {
          padding: 24px;
          position: relative;
        }

        .timeline-line {
          position: absolute;
          left: 24px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #e5e5e7;
        }

        .dark-mode .timeline-line {
          background: #404040;
        }

        .timeline-item {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          position: relative;
        }

        .timeline-item:last-child {
          margin-bottom: 0;
        }

        .timeline-dot {
          width: 12px;
          height: 12px;
          background: #1d1d1f;
          border-radius: 50%;
          margin-top: 6px;
          flex-shrink: 0;
          z-index: 1;
        }

        .dark-mode .timeline-dot {
          background: #ffffff;
        }

        .timeline-content-item {
          flex: 1;
          padding-left: 8px;
        }

        .timeline-date {
          font-size: 12px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .timeline-event {
          font-size: 16px;
          color: #1d1d1f;
          line-height: 1.5;
        }

        .dark-mode .timeline-event {
          color: #ffffff;
        }

        /* Details Section */
        .details-content {
          padding: 24px;
        }

        .detail-item {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          align-items: flex-start;
        }

        .detail-item:last-child {
          margin-bottom: 0;
        }

        .detail-number {
          width: 24px;
          height: 24px;
          background: #1d1d1f;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .dark-mode .detail-number {
          background: #ffffff;
          color: #1d1d1f;
        }

        .detail-text {
          font-size: 16px;
          color: #1d1d1f;
          line-height: 1.6;
          padding-top: 2px;
        }

        .dark-mode .detail-text {
          color: #ffffff;
        }

        /* Article Meta */
        .article-meta-section {
          margin-bottom: 48px;
          padding: 32px;
          background: #f8f9fa;
          border-radius: 16px;
        }

        .dark-mode .article-meta-section {
          background: #2a2a2a;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 24px;
        }

        .meta-item {
          text-align: center;
        }

        .meta-label {
          font-size: 12px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .meta-value {
          font-size: 16px;
          font-weight: 600;
          color: #1d1d1f;
        }

        .dark-mode .meta-value {
          color: #ffffff;
        }

        .score-value {
          color: #34c759;
        }

        /* Actions */
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
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-button.primary {
          background: #1d1d1f;
          color: white;
        }

        .action-button.primary:hover {
          background: #000;
          transform: translateY(-1px);
        }

        .action-button.secondary {
          background: white;
          color: #1d1d1f;
          border: 1px solid #e5e5e7;
        }

        .dark-mode .action-button.secondary {
          background: #2a2a2a;
          color: #ffffff;
          border-color: #404040;
        }

        .action-button.secondary:hover {
          background: #f5f5f7;
          border-color: #d2d2d7;
        }

        .dark-mode .action-button.secondary:hover {
          background: #404040;
        }

        /* Related Articles */
        .related-articles {
          padding: 60px 24px;
          background: #f8f9fa;
        }

        .dark-mode .related-articles {
          background: #2a2a2a;
        }

        .related-content {
          max-width: 1200px;
          margin: 0 auto;
        }

        .related-content h2 {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 32px;
          color: #1d1d1f;
          text-align: center;
        }

        .dark-mode .related-content h2 {
          color: #ffffff;
        }

        .related-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }

        .related-item {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .dark-mode .related-item {
          background: #1a1a1a;
        }

        .related-item:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        .related-image {
          height: 200px;
          overflow: hidden;
        }

        .related-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .related-text {
          padding: 20px;
        }

        .related-text h3 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 8px;
          color: #1d1d1f;
          line-height: 1.3;
        }

        .dark-mode .related-text h3 {
          color: #ffffff;
        }

        .related-text p {
          font-size: 14px;
          color: #666;
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .dark-mode .related-text p {
          color: #cccccc;
        }

        .related-meta {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #86868b;
        }

        /* Footer */
        .news-footer {
          background: #1d1d1f;
          color: white;
          padding: 40px 24px;
          text-align: center;
        }

        .footer-content {
          max-width: 800px;
          margin: 0 auto;
        }

        .footer-logo {
          font-size: 24px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .logo-ten {
          color: white;
        }

        .footer-text {
          font-size: 14px;
          color: #86868b;
          margin-bottom: 24px;
        }

        .back-to-home {
          padding: 12px 24px;
          background: white;
          color: #1d1d1f;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-to-home:hover {
          background: #f5f5f7;
          transform: translateY(-1px);
        }

        /* Share Modal */
        .share-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }

        .share-modal {
          background: white;
          border-radius: 12px;
          padding: 24px;
          width: 400px;
          max-width: 90vw;
        }

        .dark-mode .share-modal {
          background: #2a2a2a;
        }

        .share-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .share-modal-header h3 {
          font-size: 20px;
          font-weight: 700;
          color: #1d1d1f;
        }

        .dark-mode .share-modal-header h3 {
          color: #ffffff;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #86868b;
        }

        .share-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .share-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #f8f9fa;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #1d1d1f;
          cursor: pointer;
          transition: all 0.2s;
        }

        .dark-mode .share-option {
          background: #404040;
          color: #ffffff;
        }

        .share-option:hover {
          background: #e5e5e7;
        }

        .dark-mode .share-option:hover {
          background: #505050;
        }

        /* Responsive Design */
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

          .article-stats {
            justify-content: center;
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

          .related-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .hero-section {
            padding: 24px 16px;
          }

          .article-content {
            padding: 40px 16px;
          }

          .article-title {
            font-size: 28px;
          }

          .article-summary {
            font-size: 16px;
          }

          .hero-actions {
            flex-direction: column;
          }

          .read-btn,
          .external-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}
