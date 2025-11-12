/**
 * Article Sorting Utilities
 * 
 * Sorts articles by score (descending) with date-based tie-breaking.
 * Used to ensure users always see the highest-quality content first.
 * 
 * Sorting Logic:
 * 1. Primary: Sort by final_score (highest first)
 * 2. Secondary: If scores are equal, sort by published date (most recent first)
 * 
 * Example:
 * Article A: Score 95, Date: Nov 12, 2025 10:00 AM
 * Article B: Score 95, Date: Nov 12, 2025 09:00 AM  
 * Article C: Score 87, Date: Nov 12, 2025 11:00 AM
 * 
 * Result Order: A (95, newest), B (95, older), C (87)
 */

/**
 * Get timestamp from article's date field
 * Handles multiple date formats and missing dates
 * 
 * @param {Object} article - Article object
 * @returns {number} Unix timestamp in milliseconds
 */
function getArticleTimestamp(article) {
  // Try to get date from various possible fields
  const dateValue = article.publishedAt || article.published_at || article.added_at;
  
  if (!dateValue) {
    console.warn('⚠️ Article missing date:', article.id || article.title);
    return 0; // Articles without dates go to the end
  }
  
  // If already a number (Unix timestamp)
  if (typeof dateValue === 'number') {
    // Check if seconds or milliseconds (timestamps after year 2000 in seconds are > 946684800)
    return dateValue > 10000000000 ? dateValue : dateValue * 1000;
  }
  
  // If string or Date object, parse it
  try {
    const date = new Date(dateValue);
    const timestamp = date.getTime();
    
    if (isNaN(timestamp)) {
      console.warn('⚠️ Invalid date format:', dateValue, 'for article:', article.id || article.title);
      return 0;
    }
    
    return timestamp;
  } catch (error) {
    console.error('❌ Error parsing date:', error, 'for article:', article.id || article.title);
    return 0;
  }
}

/**
 * Sort articles by score (descending) and date (descending for ties)
 * 
 * @param {Array} articles - Array of article objects with 'final_score' and date properties
 * @returns {Array} New sorted array (original array is not modified)
 * 
 * Usage:
 * const sorted = sortArticlesByScore(articles);
 * 
 * Properties used:
 * - final_score: Numeric score (higher is better)
 * - publishedAt / published_at / added_at: Date/timestamp
 */
export function sortArticlesByScore(articles) {
  // Handle edge cases
  if (!articles) {
    console.warn('⚠️ sortArticlesByScore: articles is null/undefined');
    return [];
  }
  
  if (!Array.isArray(articles)) {
    console.error('❌ sortArticlesByScore: Expected array, got:', typeof articles);
    return [];
  }
  
  if (articles.length === 0) {
    console.log('📊 sortArticlesByScore: Empty array, nothing to sort');
    return [];
  }
  
  console.log(`📊 Sorting ${articles.length} articles by score...`);
  
  // Create a copy to avoid mutating the original array
  const sortedArticles = [...articles];
  
  sortedArticles.sort((a, b) => {
    // Handle missing scores - default to 0
    const scoreA = typeof a.final_score === 'number' ? a.final_score : 0;
    const scoreB = typeof b.final_score === 'number' ? b.final_score : 0;
    
    // Primary sort: by score (highest first)
    if (scoreA !== scoreB) {
      return scoreB - scoreA; // Descending order
    }
    
    // Secondary sort: by date (most recent first)
    const dateA = getArticleTimestamp(a);
    const dateB = getArticleTimestamp(b);
    return dateB - dateA; // Descending order (recent first)
  });
  
  // Log results for debugging
  if (sortedArticles.length > 0) {
    console.log('📊 Sorting complete! Top 5 articles:');
    const top5 = sortedArticles.slice(0, 5).map((article, idx) => ({
      rank: idx + 1,
      score: article.final_score ?? 'N/A',
      title: article.title?.substring(0, 50) + '...' || 'No title',
      date: article.publishedAt || article.published_at || article.added_at || 'N/A'
    }));
    console.table(top5);
  }
  
  return sortedArticles;
}

/**
 * Check if articles need sorting (for optimization)
 * Returns true if articles are not already sorted by score
 * 
 * @param {Array} articles - Array of article objects
 * @returns {boolean} True if sorting is needed
 */
export function needsSorting(articles) {
  if (!articles || articles.length <= 1) return false;
  
  for (let i = 0; i < articles.length - 1; i++) {
    const currentScore = articles[i].final_score ?? 0;
    const nextScore = articles[i + 1].final_score ?? 0;
    
    if (currentScore < nextScore) {
      return true; // Found out-of-order articles
    }
  }
  
  return false;
}

// Debug helpers for browser console
if (typeof window !== 'undefined') {
  window.debugSorting = {
    /**
     * Show top N articles with their scores and dates
     */
    showTopArticles: (n = 10) => {
      // This will be populated by the main page component
      console.log('ℹ️ This function needs to be called from the page context');
      console.log('ℹ️ Try: debugSorting.testSorting() to see a demo');
    },
    
    /**
     * Test sorting with sample data
     */
    testSorting: () => {
      console.log('🧪 Testing sorting with sample data...\n');
      
      const testArticles = [
        { id: 1, final_score: 95, publishedAt: '2025-11-12T10:00:00Z', title: 'Article A - High score, recent' },
        { id: 2, final_score: 95, publishedAt: '2025-11-12T09:00:00Z', title: 'Article B - High score, older' },
        { id: 3, final_score: 87, publishedAt: '2025-11-12T11:00:00Z', title: 'Article C - Lower score' },
        { id: 4, final_score: 92, publishedAt: '2025-11-12T08:00:00Z', title: 'Article D - Medium score' },
        { id: 5, final_score: 95, publishedAt: '2025-11-12T11:00:00Z', title: 'Article E - High score, newest' }
      ];
      
      console.log('Before sorting:');
      console.table(testArticles.map(a => ({ 
        title: a.title, 
        score: a.final_score, 
        date: a.publishedAt 
      })));
      
      const sorted = sortArticlesByScore(testArticles);
      
      console.log('\nAfter sorting:');
      console.table(sorted.map(a => ({ 
        title: a.title, 
        score: a.final_score, 
        date: a.publishedAt 
      })));
      
      console.log('\n✅ Expected order: E (95, newest), A (95, middle), B (95, oldest), D (92), C (87)');
      console.log('✅ Actual order:', sorted.map(a => a.title.split(' - ')[0]).join(', '));
    },
    
    /**
     * Test edge cases
     */
    testEdgeCases: () => {
      console.log('🧪 Testing edge cases...\n');
      
      const edgeCases = [
        { id: 1, final_score: 90, publishedAt: '2025-11-12T10:00:00Z', title: 'Normal article' },
        { id: 2, publishedAt: '2025-11-12T11:00:00Z', title: 'Missing score' },
        { id: 3, final_score: 85, title: 'Missing date' },
        { id: 4, title: 'Missing both' },
        { id: 5, final_score: 100, publishedAt: 'invalid-date', title: 'Invalid date' }
      ];
      
      console.log('Test data:');
      console.table(edgeCases);
      
      try {
        const sorted = sortArticlesByScore(edgeCases);
        console.log('\n✅ Sorting handled edge cases successfully!');
        console.table(sorted.map(a => ({ 
          title: a.title, 
          score: a.final_score ?? 'N/A', 
          date: a.publishedAt ?? 'N/A' 
        })));
      } catch (error) {
        console.error('❌ Sorting failed:', error);
      }
    },
    
    /**
     * Check if current articles are sorted
     */
    checkIfSorted: () => {
      console.log('ℹ️ This function needs to be called from the page context');
      console.log('ℹ️ It will be available after the page loads');
    }
  };
  
  console.log('🐛 Sorting debug tools available: window.debugSorting');
  console.log('   Try: debugSorting.testSorting()');
  console.log('   Try: debugSorting.testEdgeCases()');
}

export default sortArticlesByScore;

