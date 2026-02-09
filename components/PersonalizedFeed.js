/**
 * PersonalizedFeed Component
 * Provides "Today" and "For You" feed tabs
 * Integrates with existing TodayPlus article display
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { COUNTRIES, TOPICS, PERSONALIZATION_CONFIG } from '../lib/personalization';

export default function PersonalizedFeed({ 
  onArticleSelect, 
  isVisible = true,
  existingArticles = [] // Articles already loaded by parent
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('today'); // 'today' or 'foryou'
  const [todayArticles, setTodayArticles] = useState([]);
  const [forYouArticles, setForYouArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userPrefs, setUserPrefs] = useState(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  // Check if user has completed onboarding
  useEffect(() => {
    try {
      const prefs = localStorage.getItem('todayplus_preferences');
      if (prefs) {
        const parsed = JSON.parse(prefs);
        if (parsed.onboarding_completed) {
          setUserPrefs(parsed);
          setHasOnboarded(true);
        }
      }
    } catch (e) {
      console.error('Error loading preferences:', e);
    }
  }, []);

  // Fetch Today feed
  const fetchTodayFeed = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/feed/today');
      if (response.ok) {
        const data = await response.json();
        setTodayArticles(data.articles || []);
      }
    } catch (e) {
      console.error('Error fetching today feed:', e);
      // Fallback to existing articles sorted by score
      const sorted = [...existingArticles]
        .filter(a => (a.ai_final_score || a.base_score || 0) >= PERSONALIZATION_CONFIG.TODAY_FEED_MIN_SCORE)
        .sort((a, b) => (b.ai_final_score || b.base_score || 0) - (a.ai_final_score || a.base_score || 0))
        .slice(0, PERSONALIZATION_CONFIG.TODAY_FEED_MAX_ARTICLES);
      setTodayArticles(sorted);
    } finally {
      setLoading(false);
    }
  }, [existingArticles]);

  // Fetch For You feed
  const fetchForYouFeed = useCallback(async () => {
    if (!userPrefs) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams({
        home_country: userPrefs.home_country,
        followed_countries: (userPrefs.followed_countries || []).join(','),
        followed_topics: (userPrefs.followed_topics || []).join(','),
        limit: '50',
      });
      
      if (userPrefs.user_id) {
        params.set('user_id', userPrefs.user_id);
      }
      
      const response = await fetch(`/api/feed/for-you?${params}`);
      if (response.ok) {
        const data = await response.json();
        setForYouArticles(data.articles || []);
      }
    } catch (e) {
      console.error('Error fetching for-you feed:', e);
    } finally {
      setLoading(false);
    }
  }, [userPrefs]);

  // Fetch on tab change
  useEffect(() => {
    if (activeTab === 'today') {
      fetchTodayFeed();
    } else if (activeTab === 'foryou' && hasOnboarded) {
      fetchForYouFeed();
    }
  }, [activeTab, fetchTodayFeed, fetchForYouFeed, hasOnboarded]);

  if (!isVisible) return null;

  const articles = activeTab === 'today' ? todayArticles : forYouArticles;

  return (
    <div style={styles.container}>
      {/* Tab Switcher */}
      <div style={styles.tabContainer}>
        <div style={styles.tabBar}>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'today' ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab('today')}
          >
            Today
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'foryou' ? styles.tabActive : {}),
            }}
            onClick={() => {
              if (!hasOnboarded) {
                router.push('/onboarding');
                return;
              }
              setActiveTab('foryou');
            }}
          >
            For You
          </button>
        </div>
        {/* Settings icon */}
        {hasOnboarded && (
          <button style={styles.settingsBtn} onClick={() => router.push('/settings')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Not onboarded prompt */}
      {activeTab === 'foryou' && !hasOnboarded && (
        <div style={styles.onboardingPrompt}>
          <h3 style={styles.promptTitle}>Personalize Your Feed</h3>
          <p style={styles.promptText}>
            Tell us your interests and we'll show you news that matters to you
          </p>
          <button style={styles.promptButton} onClick={() => router.push('/onboarding')}>
            Get Started
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingDot} />
          <div style={{...styles.loadingDot, animationDelay: '0.15s'}} />
          <div style={{...styles.loadingDot, animationDelay: '0.3s'}} />
        </div>
      )}

      {/* Article List */}
      {!loading && articles.length > 0 && (
        <div style={styles.articleList}>
          {articles.map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              index={index}
              showMatchReasons={activeTab === 'foryou'}
              userPrefs={userPrefs}
              onClick={() => onArticleSelect && onArticleSelect(article)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && articles.length === 0 && activeTab === 'today' && (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No top stories right now. Check back soon.</p>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Article Card Component
// ==========================================
function ArticleCard({ article, index, showMatchReasons, userPrefs, onClick }) {
  const timeAgo = getTimeAgo(article.published_at || article.created_at);
  const matchingTags = getMatchingTags(article, userPrefs);

  return (
    <div style={styles.card} onClick={onClick}>
      {/* Image */}
      {article.image_url && (
        <div style={styles.cardImageContainer}>
          <img 
            src={article.image_url} 
            alt="" 
            style={styles.cardImage}
            loading={index < 3 ? 'eager' : 'lazy'}
          />
        </div>
      )}
      
      {/* Content */}
      <div style={styles.cardContent}>
        {/* Meta line */}
        <div style={styles.cardMeta}>
          <span style={styles.cardCategory}>{article.category}</span>
          {article.source && (
            <>
              <span style={styles.cardDot}>&middot;</span>
              <span style={styles.cardSource}>{article.source}</span>
            </>
          )}
          <span style={styles.cardDot}>&middot;</span>
          <span style={styles.cardTime}>{timeAgo}</span>
        </div>
        
        {/* Title */}
        <h3 style={styles.cardTitle}>{article.title}</h3>
        
        {/* Match tags (For You feed only) */}
        {showMatchReasons && matchingTags.length > 0 && (
          <div style={styles.matchTags}>
            {matchingTags.map((tag, i) => (
              <span key={i} style={styles.matchTag}>{tag}</span>
            ))}
          </div>
        )}

        {/* Score badge */}
        {article.final_score && article.final_score !== article.base_score && (
          <div style={styles.boostBadge}>
            +{article.final_score - article.base_score} boost
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Helpers
// ==========================================
function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getMatchingTags(article, userPrefs) {
  if (!userPrefs) return [];
  const tags = [];
  
  const articleCountries = article.countries || [];
  const articleTopics = article.topics || [];
  
  // Check home country
  if (articleCountries.includes(userPrefs.home_country)) {
    const c = COUNTRIES.find(c => c.code === userPrefs.home_country);
    if (c) tags.push(`${c.flag} ${c.name}`);
  }
  
  // Check followed countries
  (userPrefs.followed_countries || []).forEach(code => {
    if (articleCountries.includes(code)) {
      const c = COUNTRIES.find(c => c.code === code);
      if (c) tags.push(`${c.flag} ${c.name}`);
    }
  });
  
  // Check topics
  (userPrefs.followed_topics || []).forEach(code => {
    if (articleTopics.includes(code)) {
      const t = TOPICS.find(t => t.code === code);
      if (t) tags.push(`${t.icon} ${t.name}`);
    }
  });
  
  return tags.slice(0, 3); // Max 3 tags shown
}

// ==========================================
// Styles
// ==========================================
const styles = {
  container: {
    width: '100%',
    minHeight: '100vh',
    background: '#f5f5f7',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
  },
  tabContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px 0',
    position: 'sticky',
    top: 0,
    zIndex: 40,
    background: 'rgba(245,245,247,0.9)',
    backdropFilter: 'blur(20px)',
  },
  tabBar: {
    display: 'flex',
    gap: '4px',
    background: '#e5e5ea',
    borderRadius: '10px',
    padding: '3px',
  },
  tab: {
    padding: '8px 20px',
    fontSize: '15px',
    fontWeight: '600',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    background: 'transparent',
    color: '#86868b',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: 'white',
    color: '#1d1d1f',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  settingsBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
  },
  onboardingPrompt: {
    margin: '20px 16px',
    padding: '24px',
    background: 'linear-gradient(135deg, #EBF3FE, #F5E6FF)',
    borderRadius: '16px',
    textAlign: 'center',
  },
  promptTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1d1d1f',
    margin: '0 0 8px',
  },
  promptText: {
    fontSize: '15px',
    color: '#86868b',
    margin: '0 0 16px',
    lineHeight: '1.4',
  },
  promptButton: {
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: '600',
    background: '#007AFF',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    padding: '40px',
  },
  loadingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#007AFF',
    animation: 'pulse 1s ease-in-out infinite',
  },
  articleList: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    transition: 'transform 0.15s ease',
  },
  cardImageContainer: {
    width: '100%',
    aspectRatio: '16/9',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cardContent: {
    padding: '14px 16px 16px',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
    fontSize: '12px',
    color: '#86868b',
  },
  cardCategory: {
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#007AFF',
    letterSpacing: '0.5px',
  },
  cardDot: {
    color: '#c7c7cc',
  },
  cardSource: {},
  cardTime: {},
  cardTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1d1d1f',
    lineHeight: '1.3',
    margin: 0,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  matchTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '10px',
  },
  matchTag: {
    fontSize: '12px',
    padding: '4px 10px',
    borderRadius: '12px',
    background: '#f2f2f7',
    color: '#636366',
    fontWeight: '500',
  },
  boostBadge: {
    display: 'inline-block',
    marginTop: '8px',
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '8px',
    background: '#EBF3FE',
    color: '#007AFF',
    fontWeight: '600',
  },
  emptyState: {
    padding: '60px 24px',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: '15px',
    color: '#86868b',
  },
};
