/**
 * ReadArticleTracker - localStorage-based article visibility tracking system
 * 
 * Automatically tracks which articles users have seen and prevents them from
 * seeing the same articles again within 24 hours. Works for all users without
 * requiring authentication.
 * 
 * Features:
 * - Marks articles as "read" when they become visible
 * - Filters out previously-read articles
 * - Automatic 24-hour expiration
 * - Error handling for localStorage failures
 * - Browser compatibility checks
 */

class ReadArticleTracker {
  constructor() {
    this.storageKey = 'tennews_read_articles';
    this.expirationHours = 24;
    this.observer = null;
    
    // Check if localStorage is available
    this.storageAvailable = this.checkStorageAvailable();
    
    if (!this.storageAvailable) {
      console.warn('localStorage not available - read tracking disabled');
    }
    
    // Initialize IntersectionObserver if available
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      this.initializeObserver();
    } else {
      console.warn('IntersectionObserver not supported - visibility tracking disabled');
    }
  }
  
  /**
   * Check if localStorage is available and working
   * @returns {boolean}
   */
  checkStorageAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Initialize IntersectionObserver for visibility tracking
   */
  initializeObserver() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const articleId = entry.target.dataset.articleId;
          if (articleId) {
            // Mark as read
            this.markAsRead(articleId);
            // Stop observing to prevent re-triggering
            this.observer.unobserve(entry.target);
            console.log('📖 Article marked as read via visibility:', articleId);
          }
        }
      });
    }, {
      root: null, // Use viewport as root
      rootMargin: '0px',
      threshold: 0.5 // Article is "read" when 50% visible
    });
  }
  
  /**
   * Mark an article as read
   * @param {string|number} articleId - Unique article identifier
   */
  markAsRead(articleId) {
    if (!this.storageAvailable || !articleId) return;
    
    // Convert to string for consistent storage
    const idStr = String(articleId);
    
    try {
      const readArticles = this.getReadArticles();
      readArticles[idStr] = Date.now();
      localStorage.setItem(this.storageKey, JSON.stringify(readArticles));
      console.log('✅ Article marked as read:', idStr);
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded - clearing old entries');
        this.clearOldEntries();
        // Try again after clearing
        try {
          const readArticles = this.getReadArticles();
          readArticles[idStr] = Date.now();
          localStorage.setItem(this.storageKey, JSON.stringify(readArticles));
        } catch (retryError) {
          console.error('Failed to mark article as read after clearing:', retryError);
        }
      } else {
        console.error('Error marking article as read:', error);
      }
    }
  }
  
  /**
   * Get all read articles and clean up expired ones
   * @returns {Object} Object with articleId as keys and timestamps as values
   */
  getReadArticles() {
    if (!this.storageAvailable) return {};
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return {};
      
      const readArticles = JSON.parse(stored);
      const now = Date.now();
      const expirationMs = this.expirationHours * 60 * 60 * 1000;
      
      // Clean up expired entries
      let cleanedCount = 0;
      const cleaned = {};
      
      for (const [articleId, timestamp] of Object.entries(readArticles)) {
        if (now - timestamp < expirationMs) {
          cleaned[articleId] = timestamp;
        } else {
          cleanedCount++;
        }
      }
      
      // Save cleaned data back if we removed any
      if (cleanedCount > 0) {
        localStorage.setItem(this.storageKey, JSON.stringify(cleaned));
        console.log(`🧹 Cleaned up ${cleanedCount} expired entries`);
      }
      
      return cleaned;
    } catch (error) {
      console.error('Error reading read articles:', error);
      // If data is corrupted, clear it
      this.clearHistory();
      return {};
    }
  }
  
  /**
   * Check if a specific article has been read
   * @param {string|number} articleId - Article identifier
   * @returns {boolean}
   */
  hasBeenRead(articleId) {
    if (!this.storageAvailable || !articleId) return false;
    
    const readArticles = this.getReadArticles();
    // Convert to string for consistent comparison (localStorage keys are always strings)
    const idStr = String(articleId);
    const isRead = idStr in readArticles;
    return isRead;
  }
  
  /**
   * Filter an array of articles to show only unread ones
   * @param {Array} articles - Array of article objects with 'id' property
   * @returns {Array} Filtered array containing only unread articles
   */
  filterUnreadArticles(articles) {
    if (!this.storageAvailable || !Array.isArray(articles)) {
      return articles;
    }
    
    const readArticles = this.getReadArticles();
    const filtered = articles.filter(article => {
      // Keep articles without IDs (shouldn't happen, but be safe)
      if (!article.id) return true;
      // Filter out read articles
      return !(article.id in readArticles);
    });
    
    const filteredCount = articles.length - filtered.length;
    if (filteredCount > 0) {
      console.log(`🔍 Filtered out ${filteredCount} read articles`);
    }
    
    return filtered;
  }
  
  /**
   * Set up visibility tracking for a single article element
   * @param {HTMLElement} articleElement - DOM element of the article
   * @param {string} articleId - Unique article ID
   */
  observeArticle(articleElement, articleId) {
    if (!this.observer || !articleElement || !articleId) return;
    
    // Add data attribute for identification
    articleElement.dataset.articleId = articleId;
    
    // Start observing
    this.observer.observe(articleElement);
  }
  
  /**
   * Set up tracking for multiple articles at once
   * @param {Array|NodeList} articleElements - Array or NodeList of article DOM elements
   */
  observeAllArticles(articleElements) {
    if (!this.observer || !articleElements) return;
    
    articleElements.forEach(element => {
      const articleId = element.dataset.articleId;
      if (articleId && !element.dataset.observed) {
        element.dataset.observed = 'true';
        this.observer.observe(element);
      }
    });
    
    console.log(`👀 Now observing ${articleElements.length} articles`);
  }
  
  /**
   * Clear only old entries (older than expiration time)
   */
  clearOldEntries() {
    if (!this.storageAvailable) return;
    
    const readArticles = this.getReadArticles(); // This already cleans up
    console.log('🧹 Old entries cleared');
  }
  
  /**
   * Clear all reading history
   */
  clearHistory() {
    if (!this.storageAvailable) return;
    
    try {
      localStorage.removeItem(this.storageKey);
      console.log('🗑️ Reading history cleared');
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }
  
  /**
   * Get count of read articles
   * @returns {number}
   */
  getReadCount() {
    const readArticles = this.getReadArticles();
    return Object.keys(readArticles).length;
  }
  
  /**
   * Disconnect the observer (cleanup)
   */
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Debug helpers for browser console
if (typeof window !== 'undefined') {
  window.debugReadTracker = {
    showReadArticles: () => {
      const tracker = new ReadArticleTracker();
      const articles = tracker.getReadArticles();
      console.table(
        Object.entries(articles).map(([id, timestamp]) => ({
          'Article ID': id,
          'Read At': new Date(timestamp).toLocaleString(),
          'Hours Ago': ((Date.now() - timestamp) / (1000 * 60 * 60)).toFixed(1)
        }))
      );
      console.log(`📊 Total read articles: ${Object.keys(articles).length}`);
      return articles;
    },
    
    clearHistory: () => {
      const tracker = new ReadArticleTracker();
      tracker.clearHistory();
      console.log('✅ History cleared. Refresh page to see all articles.');
    },
    
    markArticleAsRead: (id) => {
      const tracker = new ReadArticleTracker();
      tracker.markAsRead(id);
      console.log('✅ Marked as read:', id);
    },
    
    setOldTimestamp: (id) => {
      // Set article to 25 hours ago for testing expiration
      try {
        const stored = localStorage.getItem('tennews_read_articles');
        const articles = stored ? JSON.parse(stored) : {};
        articles[id] = Date.now() - (25 * 60 * 60 * 1000);
        localStorage.setItem('tennews_read_articles', JSON.stringify(articles));
        console.log('⏰ Set old timestamp (25 hours ago) for:', id);
        console.log('🔄 Refresh page - this article should reappear');
      } catch (error) {
        console.error('Error setting old timestamp:', error);
      }
    },
    
    testStorage: () => {
      const tracker = new ReadArticleTracker();
      if (tracker.storageAvailable) {
        console.log('✅ localStorage is available and working');
        console.log('📊 Current read count:', tracker.getReadCount());
      } else {
        console.error('❌ localStorage is not available');
      }
    },
    
    testObserver: () => {
      if ('IntersectionObserver' in window) {
        console.log('✅ IntersectionObserver is supported');
      } else {
        console.error('❌ IntersectionObserver is not supported');
      }
      
      const articles = document.querySelectorAll('[data-article-id]');
      console.log('📰 Total articles on page:', articles.length);
      if (articles.length > 0) {
        console.log('📰 First article ID:', articles[0]?.dataset.articleId);
      }
    },
    
    simulateMarkingAll: () => {
      const tracker = new ReadArticleTracker();
      const articles = document.querySelectorAll('[data-article-id]');
      articles.forEach(article => {
        const id = article.dataset.articleId;
        if (id) tracker.markAsRead(id);
      });
      console.log(`✅ Marked ${articles.length} articles as read`);
      console.log('🔄 Refresh page to see them filtered out');
    }
  };
  
  console.log('🐛 Debug tools available: window.debugReadTracker');
  console.log('   Try: debugReadTracker.showReadArticles()');
}

export default ReadArticleTracker;

